import { NextResponse, type NextRequest } from "next/server";
import { parseDefinition } from "@/lib/automations/schema";
import { enrollAndRun } from "@/lib/automations/engine";
import { validateWebhookUrl } from "@/lib/automations/ssrf-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_BODY_BYTES = 65_536; // 64 KB

async function handleWebhook(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;

    // Validate id format
    if (!/^[0-9a-f-]{36}$/.test(id)) {
      return NextResponse.json({ error: "Invalid workflow ID." }, { status: 400 });
    }

    const automation = await prisma.automation.findUnique({ where: { id } });

    if (!automation || automation.status !== "published") {
      return NextResponse.json({ error: "Workflow not found or not published." }, { status: 404 });
    }

    const definition = parseDefinition(automation.definition);
    const webhookTrigger = definition.triggers.find((t) => t.type === "INBOUND_WEBHOOK");
    if (!webhookTrigger) {
      return NextResponse.json(
        { error: "Workflow does not have an inbound webhook trigger." },
        { status: 400 }
      );
    }

    // Token verification (constant-time safe enough for HTTP comparison)
    const expectedToken = webhookTrigger.config.token;
    const providedToken = req.nextUrl.searchParams.get("token");
    if (expectedToken && expectedToken !== providedToken) {
      return NextResponse.json({ error: "Invalid webhook token." }, { status: 401 });
    }

    // Payload extraction with size limit
    let payload: Record<string, unknown> = {};
    if (req.method !== "GET") {
      const contentLength = Number(req.headers.get("content-length") ?? 0);
      if (contentLength > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Payload too large." }, { status: 413 });
      }
      const text = await req.text();
      if (text.length > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Payload too large." }, { status: 413 });
      }
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
      }
    } else {
      payload = Object.fromEntries(req.nextUrl.searchParams);
    }

    // Idempotency key from header (for deduplication)
    const idempotencyKey =
      req.headers.get("idempotency-key") ??
      `webhook:${id}:${Date.now()}`;

    // Load latest published version
    let versionId: string | null = null;
    try {
      const version = await prisma.automationVersion.findFirst({
        where: { automationId: id, status: "PUBLISHED" },
        orderBy: { versionNumber: "desc" },
        select: { id: true },
      });
      versionId = version?.id ?? null;
    } catch { /* tables not migrated yet */ }

    await enrollAndRun({
      automationId: automation.id,
      versionId,
      agencyId: automation.agencyId,
      subAccountId: automation.subAccountId,
      triggerType: "INBOUND_WEBHOOK",
      payload,
      idempotencyKey,
      definition,
    });

    return NextResponse.json({ ok: true, accepted: true });
  } catch (err) {
    console.error("[webhook] error:", err);
    // Never leak stack traces
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export const GET = (req: NextRequest, ctx: RouteContext) => handleWebhook(req, ctx);
export const POST = (req: NextRequest, ctx: RouteContext) => handleWebhook(req, ctx);
export const PUT = (req: NextRequest, ctx: RouteContext) => handleWebhook(req, ctx);
