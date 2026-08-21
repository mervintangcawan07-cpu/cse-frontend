// Relative Path: src/app/api/partner/auth/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("cse_partner_session");

    return NextResponse.json({
      success: true,
      message: "Partner logged out successfully",
    });
  } catch (error) {
    console.error("[PARTNER_LOGOUT_ERROR]", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
