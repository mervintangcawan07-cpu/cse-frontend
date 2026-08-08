// Relative Path: src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { verifyJWT } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. ALWAYS Bypass API Routes (let API route handlers enforce auth & return structured JSON)
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("cse_session")?.value;

  // Verify token using Edge-compatible Jose helper
  const session = token ? await verifyJWT(token) : null;
  const isAdmin = session?.role === "ADMIN";

  // 2. Auto-Redirect Logged-In Users away from Landing & Auth Pages
  const isAuthOrLandingPage =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/signup";

  if (isAuthOrLandingPage && session) {
    if (isAdmin) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 3. Protect Admin Routes
  if (pathname.startsWith("/admin")) {
    if (!session || !isAdmin) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // 4. Protect Examinee / Student Routes (Including Social & Support modules)
  const isStudentRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/exam") ||
    pathname.startsWith("/mock-exam") ||
    pathname.startsWith("/drills") ||
    pathname.startsWith("/duels") ||
    pathname.startsWith("/flashcards") ||
    pathname.startsWith("/bookmarks") ||
    pathname.startsWith("/readiness-card") ||
    pathname.startsWith("/reviewer") ||
    pathname.startsWith("/reading-materials") ||
    pathname.startsWith("/modules") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/social") ||
    pathname.startsWith("/support");

  if (isStudentRoute) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Redirect Admins away from standard student dashboard to Admin Center
    if (isAdmin && pathname === "/dashboard") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
  }

  // 5. Prepare response and enforce Security Headers
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};