import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar",
].join(" ");

export async function GET(_req: NextRequest) {
  const user = await requireUser();

  const clientId = process.env.GOOGLE_CLIENT_ID?.replace(/^["']|["']$/g, "");
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^["']|["']$/g, "").trimEnd().replace(/\/$/, "") ??
    "http://localhost:3000"
  );

  if (!clientId) {
    redirect("/settings/integrations/google?error=not_configured" as never);
  }

  const redirectUri = `${appUrl}/api/oauth/google/callback`;

  const oauthUrl =
    "https://accounts.google.com/o/oauth2/v2/auth" +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${encodeURIComponent(user.id)}`;

  redirect(oauthUrl as never);
}
