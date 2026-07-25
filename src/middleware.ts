import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("cse_session")?.value;

  // Verify token using Edge-compatible Jose helper
  const session = token ? await verifyJWT(token) : null;

  // 1. Protect Admin Routes
  if (pathname.startsWith("/admin")) {
    if (!session || session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // 2. Protect Examinee / Student Routes
  const isStudentRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/exam") ||
    pathname.startsWith("/mock-exam") ||
    pathname.startsWith("/drills") || // ⚡ Added: Protects Drills & Elimination Trainer
    pathname.startsWith("/reading-materials") ||
    pathname.startsWith("/reviewer") ||
    pathname.startsWith("/modules");

  if (isStudentRoute) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Redirect Admins away from student dashboard
    if (session.role === "ADMIN" && pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/admin/questions", request.url));
    }
  }

  // 3. Prepare response and enforce Security Headers
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/exam/:path*",
    "/mock-exam/:path*",
    "/drills/:path*", // ⚡ Added: Matches all drill sub-routes
    "/reading-materials/:path*",
    "/reviewer/:path*",
    "/modules/:path*",
    "/admin/:path*",
  ],
};