// Relative Path: src/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Temporary production cleanup quiescence guard.
  // When explicitly enabled, block every API request except the two
  // read-only health probes needed to verify production availability.
  const cleanupLockEnabled =
    process.env.PRODUCTION_CLEANUP_LOCK === "YES";

  const cleanupHealthProbe =
    ["GET", "HEAD"].includes(request.method) &&
    (
      pathname === "/api/health/readiness" ||
      pathname === "/api/health/liveness"
    );

  const cleanupApiLock =
    cleanupLockEnabled &&
    pathname.startsWith("/api") &&
    !cleanupHealthProbe;

  if (cleanupApiLock) {
    return NextResponse.json(
      {
        error: "Service temporarily unavailable during scheduled maintenance.",
        code: "PRODUCTION_CLEANUP_LOCK",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "3600",
        },
      },
    );
  }

  // 1. Static files, Next internals, public assets, API routes, and webhooks bypass proxy
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2. Read session token from cookies
  const token = request.cookies.get("cse_session")?.value;
  const session = token ? await verifyJWT(token) : null;

  // 3. Admin Routes Protection (/admin and /admin/*)
  if (pathname.startsWith("/admin")) {
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (session.role !== "ADMIN") {
      // Non-admin trying to access /admin -> redirect to user dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  // 4. Protected User Routes
  const protectedUserPrefixes = [
    "/dashboard",
    "/practice",
    "/mock-exam",
    "/social",
    "/profile",
    "/settings",
    "/mistakes",
    "/drills",
    "/duels",
    "/flashcards",
    "/appointments",
    "/badges",
    "/bookmarks",
  ];

  const isProtectedUserRoute = protectedUserPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isProtectedUserRoute && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Auth pages (redirect to dashboard if already logged in)
  if ((pathname === "/login" || pathname === "/register" || pathname === "/signup") && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/practice/:path*",
    "/mock-exam/:path*",
    "/social/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/mistakes/:path*",
    "/drills/:path*",
    "/duels/:path*",
    "/flashcards/:path*",
    "/appointments/:path*",
    "/badges/:path*",
    "/bookmarks/:path*",
    "/login",
    "/register",
    "/signup",
  ],
};
