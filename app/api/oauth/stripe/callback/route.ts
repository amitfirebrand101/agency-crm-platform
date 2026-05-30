import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptObject } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const SUCCESS_REDIRECT = "/settings/integrations/stripe?connected=1";
const ERROR_REDIRECT   = "/settings/integrations/stripe?error=1";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    console.error("[stripe-oauth-callback] Missing params or upstream error", { error, code: !!code, state });
    redirect(ERROR_REDIRECT as never);
  }

  // state = "<agencyId>:<subAccountId>"
  const [agencyId, rawSubAccountId] = state.split(":");
  const subAccountId = rawSubAccountId && rawSubAccountId.length > 0 ? rawSubAccountId : null;

  if (!agencyId) {
    console.error("[stripe-oauth-callback] Invalid state parameter", { state });
    redirect(ERROR_REDIRECT as never);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error("[stripe-oauth-callback] STRIPE_SECRET_KEY is not set");
    redirect(ERROR_REDIRECT as never);
  }

  // Exchange the authorisation code for an access token
  let tokenData: {
    access_token: string;
    stripe_publishable_key: string;
    stripe_user_id: string;
    livemode: boolean;
    token_type: string;
  };

  try {
    const response = await fetch("https://connect.stripe.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${secretKey}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
      }).toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[stripe-oauth-callback] Token exchange failed", { status: response.status, body });
      redirect(ERROR_REDIRECT as never);
    }

    tokenData = await response.json();
  } catch (err) {
    console.error("[stripe-oauth-callback] Token exchange threw", err);
    redirect(ERROR_REDIRECT as never);
  }

  const { access_token, stripe_publishable_key, stripe_user_id, livemode } = tokenData;

  if (!access_token || !stripe_user_id) {
    console.error("[stripe-oauth-callback] Token response missing required fields");
    redirect(ERROR_REDIRECT as never);
  }

  const blob = encryptObject({
    stripeAccountId: stripe_user_id,
    accessToken:     access_token,
    publishableKey:  stripe_publishable_key,
    livemode,
  });

  try {
    const existing = await prisma.providerCredential.findFirst({
      where: { agencyId, subAccountId: subAccountId ?? null, provider: "stripe_connect" },
      select: { id: true },
    });
    if (existing) {
      await prisma.providerCredential.update({
        where: { id: existing.id },
        data: { encryptedData: blob.encryptedData, iv: blob.iv, authTag: blob.authTag },
      });
    } else {
      await prisma.providerCredential.create({
        data: {
          agencyId,
          subAccountId,
          provider:      "stripe_connect",
          encryptedData: blob.encryptedData,
          iv:            blob.iv,
          authTag:       blob.authTag,
        },
      });
    }
  } catch (err) {
    console.error("[stripe-oauth-callback] Failed to persist credential", err);
    redirect(ERROR_REDIRECT as never);
  }

  redirect(SUCCESS_REDIRECT as never);
}
