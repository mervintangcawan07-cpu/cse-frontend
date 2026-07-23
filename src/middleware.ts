import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("cse_session")?.value;
  const { pathname } = request.nextUrl;

  const session = token ? await verifyJWT(token) : null;

  // Protect Admin Routes
  if (pathname.startsWith("/admin")) {
    if (!session || session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Protect Examinee Routes
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/exam") || pathname.startsWith("/modules")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Prevent Admins from accessing student views unnecessarily
    if (session.role === "ADMIN" && pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/admin/questions", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/exam/:path*", "/modules/:path*", "/admin/:path*"],
};