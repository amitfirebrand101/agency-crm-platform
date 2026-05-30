import { createHmac, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptObject } from "@/lib/crypto";
import type { EncryptedBlob } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// Facebook sends the raw body — we must NOT let Next.js parse it before
// we compute the HMAC. This runtime config keeps the route on Node.js
// (not Edge) so we can use the crypto module.
export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type FbWebhookBody = {
  object: string;
  entry: Array<{
    id:      string;
    changes: Array<{
      field: string;
      value: {
        leadgen_id: string;
        page_id:    string;
        form_id:    string;
        ad_id?:     string;
        created_time?: number;
      };
    }>;
  }>;
};

type FbLeadData = {
  id:         string;
  field_data: Array<{ name: string; values: string[] }>;
};

type FacebookCredential = {
  userAccessToken: string;
  pageId:          string;
  pageAccessToken: string;
  pageName:        string;
  pages:           Array<{ id: string; name: string }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// CRM field mapping keys
// ─────────────────────────────────────────────────────────────────────────────

const CRM_FIELDS = new Set([
  "firstName",
  "lastName",
  "email",
  "phone",
  "companyName",
  "source",
]);

// ─────────────────────────────────────────────────────────────────────────────
// GET — Facebook webhook verification challenge
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe") {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error("[facebook-webhook] FACEBOOK_VERIFY_TOKEN is not set");
    return new NextResponse("Server configuration error", { status: 500 });
  }

  if (!token || !challenge) {
    return new NextResponse("Missing verification parameters", { status: 400 });
  }

  if (token !== verifyToken) {
    console.warn("[facebook-webhook] Verification token mismatch");
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge, { status: 200 });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Receive lead events
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Read raw body ──────────────────────────────────────────────────────
  const rawBody = await req.text();

  // ── 2. Verify HMAC-SHA256 signature ──────────────────────────────────────
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appSecret) {
    console.error("[facebook-webhook] FACEBOOK_APP_SECRET is not set");
    // Respond 200 so Facebook doesn't disable the endpoint, but take no action
    return NextResponse.json({ success: true });
  }

  const sigHeader = req.headers.get("x-hub-signature-256");
  if (!sigHeader || !sigHeader.startsWith("sha256=")) {
    console.warn("[facebook-webhook] Missing or malformed X-Hub-Signature-256");
    return new NextResponse("Forbidden", { status: 403 });
  }

  const expectedSig = sigHeader.slice("sha256=".length);
  const computedSig = createHmac("sha256", appSecret).update(rawBody).digest("hex");

  let sigValid: boolean;
  try {
    sigValid = timingSafeEqual(
      Buffer.from(computedSig, "hex"),
      Buffer.from(expectedSig, "hex"),
    );
  } catch {
    // Buffer lengths differ → invalid hex / wrong length → reject
    sigValid = false;
  }

  if (!sigValid) {
    console.warn("[facebook-webhook] Signature verification failed");
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ── 3. Parse payload ──────────────────────────────────────────────────────
  let body: FbWebhookBody;
  try {
    body = JSON.parse(rawBody) as FbWebhookBody;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  // ── 4. Process each leadgen change asynchronously ─────────────────────────
  // Respond immediately (Facebook requires < 20 s)
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === "leadgen") {
        void processLeadEvent(change.value);
      }
    }
  }

  return NextResponse.json({ success: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lead processing (async, best-effort)
// ─────────────────────────────────────────────────────────────────────────────

async function processLeadEvent(value: FbWebhookBody["entry"][number]["changes"][number]["value"]) {
  const { leadgen_id, page_id, form_id } = value;

  // Look up the FacebookLeadForm for this page + form
  const leadForm = await prisma.facebookLeadForm.findFirst({
    where: { fbFormId: form_id, fbPageId: page_id, active: true },
  });

  if (!leadForm) {
    console.warn("[facebook-webhook] No active FacebookLeadForm found", { form_id, page_id });
    return;
  }

  const { agencyId, subAccountId, fbFormName } = leadForm;
  const fieldMappings = (leadForm.fieldMappings ?? {}) as Record<string, string>;

  // Retrieve the page access token
  const cred = await prisma.providerCredential.findUnique({
    where: {
      agencyId_subAccountId_provider: {
        agencyId,
        subAccountId,
        provider: "facebook",
      },
    },
  });

  if (!cred) {
    console.error("[facebook-webhook] No Facebook credential found", { agencyId, subAccountId });
    return;
  }

  let credential: FacebookCredential;
  try {
    credential = decryptObject<FacebookCredential>({
      encryptedData: cred.encryptedData,
      iv:            cred.iv,
      authTag:       cred.authTag,
    } as EncryptedBlob);
  } catch (err) {
    console.error("[facebook-webhook] Failed to decrypt credential", err);
    return;
  }

  // Fetch the lead's field data from the Graph API
  const leadUrl =
    `https://graph.facebook.com/v19.0/${encodeURIComponent(leadgen_id)}` +
    `?access_token=${encodeURIComponent(credential.pageAccessToken)}` +
    `&fields=field_data`;

  let leadData: FbLeadData;
  try {
    const res = await fetch(leadUrl);
    if (!res.ok) {
      const body = await res.text();
      console.error("[facebook-webhook] Failed to fetch lead data", {
        leadgen_id,
        status: res.status,
        body,
      });
      return;
    }
    leadData = await res.json();
  } catch (err) {
    console.error("[facebook-webhook] Lead data fetch threw", err);
    return;
  }

  // Build a flat map: FB field name → first value
  const fbFields: Record<string, string> = {};
  for (const field of leadData.field_data ?? []) {
    fbFields[field.name] = field.values[0] ?? "";
  }

  // Apply field mappings: fieldMappings = { crmField: fbFieldName }
  // e.g. { "email": "email", "firstName": "first_name", ... }
  const contactData: Record<string, string> = {};
  for (const [crmField, fbFieldName] of Object.entries(fieldMappings)) {
    if (CRM_FIELDS.has(crmField) && fbFieldName && fbFields[fbFieldName] !== undefined) {
      contactData[crmField] = fbFields[fbFieldName] ?? "";
    }
  }

  // Require at minimum one identifying field
  if (!contactData.email && !contactData.phone && !contactData.firstName) {
    console.warn("[facebook-webhook] Lead has no usable contact data", { leadgen_id, fbFields });
    return;
  }

  try {
    await prisma.contact.create({
      data: {
        agencyId,
        subAccountId,
        firstName:   contactData.firstName ?? "Facebook Lead",
        lastName:    contactData.lastName  ?? null,
        email:       contactData.email     ?? null,
        phone:       contactData.phone     ?? null,
        companyName: contactData.companyName ?? null,
        source:      `Facebook Lead Ad — ${fbFormName}`,
        status:      "LEAD",
      },
    });

    console.info("[facebook-webhook] Contact created from lead", { leadgen_id, agencyId, subAccountId });
  } catch (err) {
    console.error("[facebook-webhook] Failed to create contact", { leadgen_id, err });
  }
}
