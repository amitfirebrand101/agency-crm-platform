import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const user = await requireUser();

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^["']|["']$/g, "").trimEnd().replace(/\/$/, "") ??
    "http://localhost:3000";

  if (!clientId) {
    redirect("/settings/integrations/stripe?error=not_configured" as never);
  }

  const redirectUri = encodeURIComponent(
    `${appUrl}/api/oauth/stripe/callback`
  );

  const state = encodeURIComponent(
    `${user.agencyId}:${user.subAccountId ?? ""}`
  );

  const oauthUrl =
    `https://connect.stripe.com/oauth/authorize` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&scope=read_write` +
    `&redirect_uri=${redirectUri}` +
    `&state=${state}`;

  redirect(oauthUrl as never);
}
