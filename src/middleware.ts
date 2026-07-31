import { NextResponse, type NextRequest } from "next/server";
import { verifyJWT } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("cse_session")?.value;

  // Verify token using Edge-compatible Jose helper
  const session = token ? await verifyJWT(token) : null;
  const isAdmin = session?.role === "ADMIN";

  // 1. Check Maintenance Mode Status
  let isMaintenance = false;
  try {
    const statusRes = await fetch(new URL("/api/maintenance/status", request.url));
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      isMaintenance = !!statusData.isMaintenance;
    }
  } catch (err) {
    console.error("Middleware maintenance check failed:", err);
  }

  // Handle Maintenance Mode Routing
  if (isMaintenance) {
    // Non-admins are redirected to maintenance page unless accessing auth or maintenance endpoint
    if (!isAdmin) {
      const isExemptDuringMaintenance =
        pathname === "/maintenance" ||
        pathname === "/login" ||
        pathname.startsWith("/api/auth");

      if (!isExemptDuringMaintenance) {
        return NextResponse.redirect(new URL("/maintenance", request.url));
      }
    }
  } else {
    // If maintenance is OFF, redirect users away from the /maintenance break page
    if (pathname === "/maintenance") {
      if (isAdmin) {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }
      return NextResponse.redirect(new URL(session ? "/dashboard" : "/login", request.url));
    }
  }

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
    // If maintenance is active for students, direct them to maintenance instead of dashboard
    if (isMaintenance) {
      return NextResponse.redirect(new URL("/maintenance", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 3. Protect Admin Routes
  if (pathname.startsWith("/admin")) {
    if (!session || !isAdmin) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // 4. Protect Examinee / Student Routes (Including support module)
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
    pathname.startsWith("/support"); // Added /support route protection

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
    "/",
    "/login",
    "/register",
    "/signup",
    "/maintenance",
    "/dashboard/:path*",
    "/exam/:path*",
    "/mock-exam/:path*",
    "/drills/:path*",
    "/duels/:path*",
    "/flashcards/:path*",
    "/bookmarks/:path*",
    "/readiness-card/:path*",
    "/reviewer/:path*",
    "/reading-materials/:path*",
    "/modules/:path*",
    "/profile/:path*",
    "/support/:path*", // Added /support to Next.js matcher
    "/admin/:path*",
  ],
};