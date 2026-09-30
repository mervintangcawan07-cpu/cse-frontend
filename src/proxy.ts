// Relative Path: src/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { verifyPartnerJWT } from "@/lib/partnerAuth";
import { isStudyTogetherEnabled, isDuelEnabled } from "@/lib/config/features";

const STATIC_ASSET_REGEX =
  /\.(?:png|jpe?g|gif|webp|svg|ico|css|js(?!on)|map|woff2?|ttf|eot|mp4|webm|webmanifest)$/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Static files & Next.js internal paths bypass immediately
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    STATIC_ASSET_REGEX.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Production cleanup maintenance lock
  const cleanupLockEnabled = process.env.PRODUCTION_CLEANUP_LOCK === "YES";
  const isHealthProbe =
    ["GET", "HEAD"].includes(request.method) &&
    (pathname === "/api/health/readiness" || pathname === "/api/health/liveness");

  if (cleanupLockEnabled && !isHealthProbe) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        {
          error: "Service temporarily unavailable during scheduled maintenance.",
          code: "PRODUCTION_CLEANUP_LOCK",
        },
        {
          status: 503,
          headers: { "Cache-Control": "no-store", "Retry-After": "3600" },
        }
      );
    }
    return new NextResponse("Maintenance in progress. Please retry shortly.", {
      status: 503,
      headers: { "Retry-After": "3600" },
    });
  }

  // 3. Feature Flags: Study Together & 1v1 Duels
  if (!isStudyTogetherEnabled()) {
    if (pathname === "/api/social/rooms" || pathname.startsWith("/api/social/rooms/")) {
      return NextResponse.json(
        { error: "Study Together is temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (pathname === "/social" || pathname.startsWith("/social/")) {
      const redirectUrl = new URL("/dashboard", request.url);
      redirectUrl.searchParams.set("notice", "feature_unavailable");
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (!isDuelEnabled()) {
    if (pathname === "/api/duels" || pathname.startsWith("/api/duels/")) {
      return NextResponse.json(
        { error: "Duels are temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (pathname === "/duels" || pathname.startsWith("/duels/")) {
      const redirectUrl = new URL("/dashboard", request.url);
      redirectUrl.searchParams.set("notice", "feature_unavailable");
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 4. Session Tokens
  const userToken = request.cookies.get("cse_session")?.value;
  const session = userToken ? await verifyJWT(userToken) : null;

  // 5. Edge Gate for Admin API Endpoints
  if (pathname.startsWith("/api/admin")) {
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }
    if (session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Administrator role required." },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  // 6. Partner Portal Protection
  if (pathname.startsWith("/partner-portal")) {
    const isPublicPartnerRoute =
      pathname === "/partner-portal/login" ||
      pathname === "/partner-portal/setup" ||
      pathname === "/partner-portal/forgot-password" ||
      pathname === "/partner-portal/reset-password";

    const partnerToken = request.cookies.get("cse_partner_session")?.value;
    const partnerSession = partnerToken ? await verifyPartnerJWT(partnerToken) : null;

    if (isPublicPartnerRoute) {
      if (pathname === "/partner-portal/login" && partnerSession) {
        return NextResponse.redirect(new URL("/partner-portal/dashboard", request.url));
      }
      return NextResponse.next();
    }

    if (!partnerSession) {
      return NextResponse.redirect(
        new URL(`/partner-portal/login?redirect=${encodeURIComponent(pathname)}`, request.url)
      );
    }
    return NextResponse.next();
  }

  // 7. Admin UI Routes
  if (pathname.startsWith("/admin")) {
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // 8. Protected User Routes
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

  if (protectedUserPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 9. Auth Guest Pages
  if (
    (pathname === "/login" || pathname === "/register" || pathname === "/signup") &&
    session
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};