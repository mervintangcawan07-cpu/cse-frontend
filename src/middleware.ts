import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("cse_session")?.value;

  // Verify token using Edge-compatible Jose helper
  const session = token ? await verifyJWT(token) : null;

  // 1. Auto-Redirect Logged-In Users away from Landing & Auth Pages
  const isAuthOrLandingPage =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/signup";

  if (isAuthOrLandingPage && session) {
    if (session.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 2. Protect Admin Routes
  if (pathname.startsWith("/admin")) {
    if (!session || session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // 3. Protect Examinee / Student Routes (Including newly added modules)
  const isStudentRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/exam") ||
    pathname.startsWith("/mock-exam") ||
    pathname.startsWith("/drills") ||
    pathname.startsWith("/flashcards") ||
    pathname.startsWith("/bookmarks") ||
    pathname.startsWith("/readiness-card") ||
    pathname.startsWith("/reviewer") ||
    pathname.startsWith("/reading-materials") ||
    pathname.startsWith("/modules") ||
    pathname.startsWith("/profile");

  if (isStudentRoute) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Redirect Admins away from standard student dashboard to Admin Center
    if (session.role === "ADMIN" && pathname === "/dashboard") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
  }

  // 4. Prepare response and enforce Security Headers
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/signup",
    "/dashboard/:path*",
    "/exam/:path*",
    "/mock-exam/:path*",
    "/drills/:path*",
    "/flashcards/:path*",
    "/bookmarks/:path*",
    "/readiness-card/:path*",
    "/reviewer/:path*",
    "/reading-materials/:path*",
    "/modules/:path*",
    "/profile/:path*",
    "/admin/:path*",
  ],
};