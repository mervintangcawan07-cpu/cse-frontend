// Relative Path: src/app/api/partner/auth/setup/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { PartnerService } from "@/lib/accounting/partnerService";
import { signPartnerJWT } from "@/lib/partnerAuth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Setup token is required." }, { status: 400 });
    }

    const partner = await prisma.partner.findFirst({
      where: {
        setupToken: token,
        setupTokenExpires: { gt: new Date() },
      },
      select: {
        id: true,
        partnerId: true,
        code: true,
        name: true,
        contactEmail: true,
        type: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: "This setup link is invalid or has expired. Please contact GovStudyX Admin." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      partner: {
        partnerId: partner.partnerId || partner.code,
        name: partner.name,
        email: partner.contactEmail,
        type: partner.type,
      },
    });
  } catch (error) {
    console.error("[PARTNER_SETUP_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to verify setup token" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Setup token and password are required." },
        { status: 400 }
      );
    }

    const res = await PartnerService.activatePartnerWithSetupToken({
      token,
      password,
    });

    if (!res.success || !res.partner) {
      return NextResponse.json({ error: res.error || "Setup failed" }, { status: 400 });
    }

    const displayId = res.partner.partnerId || res.partner.code;
    const sessionToken = await signPartnerJWT(res.partner.id, displayId);

    const cookieStore = await cookies();
    cookieStore.set("cse_partner_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return NextResponse.json({
      success: true,
      message: "Your partner account has been successfully activated!",
      partnerId: displayId,
    });
  } catch (error) {
    console.error("[PARTNER_SETUP_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to activate partner account" }, { status: 500 });
  }
}
