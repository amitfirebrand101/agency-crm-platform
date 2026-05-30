import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptObject } from "@/lib/crypto";
import type { GoogleTokenBlob } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

const SUCCESS_REDIRECT = "/settings/integrations/google?connected=1";
const ERROR_REDIRECT   = "/settings/integrations/google?error=1";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const code  = searchParams.get("code");
  const state = searchParams.get("state"); // userId
  const error = searchParams.get("error");

  if (error || !code || !state) {
    console.error("[google-oauth-callback] Missing params or upstream error", {
      error,
      hasCode: !!code,
      hasState: !!state,
    });
    redirect(ERROR_REDIRECT as never);
  }

  const userId = state;

  const clientId     = process.env.GOOGLE_CLIENT_ID?.replace(/^["']|["']$/g, "");
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.replace(/^["']|["']$/g, "");
  const appUrl       = (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^["']|["']$/g, "").trimEnd().replace(/\/$/, "") ??
    "http://localhost:3000"
  );

  if (!clientId || !clientSecret) {
    console.error("[google-oauth-callback] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured");
    redirect(ERROR_REDIRECT as never);
  }

  const redirectUri = `${appUrl}/api/oauth/google/callback`;

  // ── Exchange authorisation code for tokens ───────────────────────────────
  let tokenData: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    id_token?: string;
  };

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  redirectUri,
        client_id:     clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("[google-oauth-callback] Token exchange failed", tokenRes.status, body);
      redirect(ERROR_REDIRECT as never);
    }

    tokenData = await tokenRes.json();
  } catch (err) {
    console.error("[google-oauth-callback] Token exchange threw", err);
    redirect(ERROR_REDIRECT as never);
  }

  const { access_token, refresh_token, expires_in } = tokenData;

  if (!access_token) {
    console.error("[google-oauth-callback] Token response missing access_token");
    redirect(ERROR_REDIRECT as never);
  }

  // ── Fetch the user's email via userinfo ──────────────────────────────────
  let email = "";
  try {
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (infoRes.ok) {
      const info = (await infoRes.json()) as { email?: string };
      email = info.email ?? "";
    } else {
      console.error("[google-oauth-callback] userinfo request failed", infoRes.status);
    }
  } catch (err) {
    console.error("[google-oauth-callback] userinfo threw", err);
  }

  // ── Encrypt and persist the token ───────────────────────────────────────
  const blob: GoogleTokenBlob = {
    accessToken:  access_token,
    refreshToken: refresh_token ?? null,
    expiresAt:    Date.now() + expires_in * 1000,
    email,
    calendarId:   "primary",
  };

  const encrypted = encryptObject(blob);

  try {
    await prisma.userOAuthToken.upsert({
      where: {
        userId_provider: { userId, provider: "google_calendar" },
      },
      update: {
        encryptedData: encrypted.encryptedData,
        iv:            encrypted.iv,
        authTag:       encrypted.authTag,
        expiresAt:     new Date(blob.expiresAt),
        metadata:      { email, calendarId: "primary" },
      },
      create: {
        userId,
        provider:      "google_calendar",
        encryptedData: encrypted.encryptedData,
        iv:            encrypted.iv,
        authTag:       encrypted.authTag,
        expiresAt:     new Date(blob.expiresAt),
        metadata:      { email, calendarId: "primary" },
      },
    });
  } catch (err) {
    console.error("[google-oauth-callback] Failed to persist token", err);
    redirect(ERROR_REDIRECT as never);
  }

  redirect(SUCCESS_REDIRECT as never);
}
