import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptObject } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const SUCCESS_REDIRECT = "/settings/integrations/facebook?connected=1";
const ERROR_REDIRECT   = "/settings/integrations/facebook?error=1";

const FB_GRAPH = "https://graph.facebook.com/v19.0";

// ─────────────────────────────────────────────────────────────────────────────
// Facebook Graph API response shapes
// ─────────────────────────────────────────────────────────────────────────────

type TokenResponse = {
  access_token: string;
  token_type:   string;
  expires_in?:  number;
};

type FbPage = {
  id:           string;
  name:         string;
  access_token: string;
};

type AccountsResponse = {
  data: FbPage[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const code      = searchParams.get("code");
  const state     = searchParams.get("state");
  const fbError   = searchParams.get("error");

  if (fbError || !code || !state) {
    console.error("[facebook-oauth-callback] Missing params or upstream error", {
      fbError,
      hasCode:  !!code,
      hasState: !!state,
    });
    redirect(ERROR_REDIRECT as never);
  }

  const [agencyId, rawSubAccountId] = decodeURIComponent(state).split(":");
  const subAccountId = rawSubAccountId && rawSubAccountId.length > 0 ? rawSubAccountId : null;

  if (!agencyId) {
    console.error("[facebook-oauth-callback] Invalid state — missing agencyId", { state });
    redirect(ERROR_REDIRECT as never);
  }

  const appId     = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const appUrl    =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^["']|["']$/g, "").trimEnd().replace(/\/$/, "") ??
    "http://localhost:3000";

  if (!appId || !appSecret) {
    console.error("[facebook-oauth-callback] FACEBOOK_APP_ID or FACEBOOK_APP_SECRET is not set");
    redirect(ERROR_REDIRECT as never);
  }

  const redirectUri = `${appUrl}/api/oauth/facebook/callback`;

  // ── Step 1: Exchange code for short-lived user access token ──────────────

  let shortLivedToken: string;

  try {
    const tokenUrl =
      `${FB_GRAPH}/oauth/access_token` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&code=${encodeURIComponent(code)}`;

    const res = await fetch(tokenUrl);
    if (!res.ok) {
      const body = await res.text();
      console.error("[facebook-oauth-callback] Short-lived token exchange failed", {
        status: res.status,
        body,
      });
      redirect(ERROR_REDIRECT as never);
    }

    const data: TokenResponse = await res.json();
    shortLivedToken = data.access_token;
  } catch (err) {
    console.error("[facebook-oauth-callback] Short-lived token exchange threw", err);
    redirect(ERROR_REDIRECT as never);
  }

  // ── Step 2: Exchange for long-lived user access token ────────────────────

  let userAccessToken: string;

  try {
    const longLivedUrl =
      `${FB_GRAPH}/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`;

    const res = await fetch(longLivedUrl);
    if (!res.ok) {
      const body = await res.text();
      console.error("[facebook-oauth-callback] Long-lived token exchange failed", {
        status: res.status,
        body,
      });
      redirect(ERROR_REDIRECT as never);
    }

    const data: TokenResponse = await res.json();
    userAccessToken = data.access_token;
  } catch (err) {
    console.error("[facebook-oauth-callback] Long-lived token exchange threw", err);
    redirect(ERROR_REDIRECT as never);
  }

  // ── Step 3: Fetch managed pages ──────────────────────────────────────────

  let pages: FbPage[];

  try {
    const accountsUrl =
      `${FB_GRAPH}/me/accounts?access_token=${encodeURIComponent(userAccessToken)}`;

    const res = await fetch(accountsUrl);
    if (!res.ok) {
      const body = await res.text();
      console.error("[facebook-oauth-callback] Fetching pages failed", {
        status: res.status,
        body,
      });
      redirect(ERROR_REDIRECT as never);
    }

    const data: AccountsResponse = await res.json();
    pages = data.data ?? [];
  } catch (err) {
    console.error("[facebook-oauth-callback] Fetching pages threw", err);
    redirect(ERROR_REDIRECT as never);
  }

  if (pages.length === 0) {
    console.error("[facebook-oauth-callback] No pages returned for this user");
    redirect(ERROR_REDIRECT as never);
  }

  // We use the first page. The settings UI can let users switch later.
  const firstPage = pages[0];
  const { id: pageId, name: pageName, access_token: pageAccessToken } = firstPage;

  // ── Step 4: Persist encrypted credential ─────────────────────────────────

  const blob = encryptObject({
    userAccessToken,
    pageId,
    pageAccessToken,
    pageName,
    pages: pages.map((p) => ({ id: p.id, name: p.name })),
  });

  try {
    await prisma.providerCredential.upsert({
      where: {
        agencyId_subAccountId_provider: {
          agencyId,
          subAccountId: subAccountId ?? "",
          provider:     "facebook",
        },
      },
      update: {
        encryptedData: blob.encryptedData,
        iv:            blob.iv,
        authTag:       blob.authTag,
      },
      create: {
        agencyId,
        subAccountId:  subAccountId ?? "",
        provider:      "facebook",
        encryptedData: blob.encryptedData,
        iv:            blob.iv,
        authTag:       blob.authTag,
      },
    });
  } catch (err) {
    console.error("[facebook-oauth-callback] Failed to persist ProviderCredential", err);
    redirect(ERROR_REDIRECT as never);
  }

  // ── Step 5: Subscribe page to leadgen webhooks ───────────────────────────

  try {
    const subscribeUrl =
      `${FB_GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps` +
      `?subscribed_fields=leadgen` +
      `&access_token=${encodeURIComponent(pageAccessToken)}`;

    const res = await fetch(subscribeUrl, { method: "POST" });
    if (!res.ok) {
      const body = await res.text();
      // Non-fatal: credential is already stored. Log and proceed to success.
      console.error("[facebook-oauth-callback] Page subscription failed", {
        status: res.status,
        body,
      });
    }
  } catch (err) {
    // Non-fatal: subscription can be retried from the settings page.
    console.error("[facebook-oauth-callback] Page subscription threw", err);
  }

  redirect(SUCCESS_REDIRECT as never);
}
