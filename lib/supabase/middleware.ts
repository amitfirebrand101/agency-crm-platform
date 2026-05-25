import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Public routes that never require authentication
const PUBLIC_PATH_PREFIXES = [
  "/p/",           // public site pages
  "/book/",        // public booking pages
  "/invite/",      // invite acceptance pages
  "/auth",         // Supabase auth callbacks
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api/book/",    // public booking API
  "/api/sms/",     // Twilio webhooks
  "/api/health",   // health check (no auth)
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// ─────────────────────────────────────────────────────────────────────────────
// Security headers applied to every response
// ─────────────────────────────────────────────────────────────────────────────

function applySecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  // Prevent MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Referrer leakage control
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Disable browser features not needed by the app
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  // Strip sensitive headers going upstream (prevents header injection)
  response.headers.delete("X-Powered-By");
  return response;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session refresh middleware
// ─────────────────────────────────────────────────────────────────────────────

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // AUTH_DISABLED is only respected in non-production (enforced in lib/auth.ts)
  const authDisabled =
    process.env.AUTH_DISABLED?.replace(/^["']|["']$/g, "").toLowerCase() === "true";

  const { pathname } = request.nextUrl;

  // Always pass through Next.js internals and static assets
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next({ request });
  }

  // In dev-only auth-disabled mode, skip session validation entirely
  if (authDisabled) {
    const response = NextResponse.next({ request });
    return applySecurityHeaders(response);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Supabase not configured — can't authenticate anyone
    const response = NextResponse.next({ request });
    return applySecurityHeaders(response);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh session — this keeps the Supabase token alive and is required by
  // @supabase/ssr. Do NOT remove even if the result is unused here.
  const { data: { user } } = await supabase.auth.getUser();

  const isPublic    = isPublicPath(pathname);
  const isProtected = !isPublic && pathname !== "/";

  // Unauthenticated user accessing a protected route → redirect to login
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve the intended destination so we redirect back after login
    url.searchParams.set("next", pathname);
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  // Authenticated user hitting auth pages → send to dashboard
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  return applySecurityHeaders(response);
}
