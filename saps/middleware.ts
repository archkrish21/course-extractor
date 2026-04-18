import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request so expired access tokens
 * are transparently replaced using the refresh token. Without this middleware,
 * users would get silently logged out when their access token expires (1 hour
 * default) even though their refresh token is still valid.
 *
 * Runs on all routes except static assets (see matcher below).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Triggers token refresh if the access token is expired but the refresh
  // token is still valid. The returned user isn't used here — route handlers
  // call requireAuth() separately to get the authenticated user.
  await supabase.auth.getUser();

  // Prevent browser from caching authenticated pages (e.g. dashboard, settings)
  // so the back button doesn't show stale content after logout or account deletion.
  const pathname = request.nextUrl.pathname;
  const isAppRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/planner") ||
    pathname.startsWith("/progress") ||
    pathname.startsWith("/transcript") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/plans") ||
    pathname.startsWith("/join") ||
    pathname.startsWith("/year-end");

  if (isAppRoute) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - monitoring (Sentry tunnel route — must not be intercepted)
     * - image file extensions (svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
