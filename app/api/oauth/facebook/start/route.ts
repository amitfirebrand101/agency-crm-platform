import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ERROR_REDIRECT = "/settings/integrations/facebook?error=not_configured";

export async function GET(_req: NextRequest) {
  const user = await requireUser();

  const appId = process.env.FACEBOOK_APP_ID;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^["']|["']$/g, "").trimEnd().replace(/\/$/, "") ??
    "http://localhost:3000";

  if (!appId) {
    console.error("[facebook-oauth-start] FACEBOOK_APP_ID is not set");
    redirect(ERROR_REDIRECT as never);
  }

  const redirectUri = `${appUrl}/api/oauth/facebook/callback`;

  // state carries agencyId:subAccountId so the callback can restore context
  const state = `${user.agencyId}:${user.subAccountId ?? ""}`;

  const oauthUrl =
    `https://www.facebook.com/v19.0/dialog/oauth` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=pages_show_list,pages_read_engagement,leads_retrieval,ads_management` +
    `&state=${encodeURIComponent(state)}`;

  redirect(oauthUrl as never);
}
