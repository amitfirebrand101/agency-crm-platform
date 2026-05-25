import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code  = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const next  = url.searchParams.get("next") ?? "/dashboard";
  const type  = url.searchParams.get("type"); // "recovery" for password reset

  // Supabase sent back an explicit error (e.g. magic link expired)
  if (error) {
    logger.warn("Auth callback received error from Supabase", { error, errorDescription });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", errorDescription ?? error);
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    // No code and no error — unexpected state, send to login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    logger.warn("Auth code exchange failed", { error: exchangeError.message });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", exchangeError.message);
    return NextResponse.redirect(loginUrl);
  }

  // Password recovery flow — redirect to the reset-password page
  if (type === "recovery") {
    return NextResponse.redirect(new URL("/reset-password", request.url));
  }

  // Validate the `next` redirect to prevent open redirects
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return NextResponse.redirect(new URL(safeNext, request.url));
}
