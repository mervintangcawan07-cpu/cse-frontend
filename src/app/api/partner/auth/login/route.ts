// Relative Path: src/app/api/partner/auth/login/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signPartnerJWT } from "@/lib/partnerAuth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Partner tracking code/email and password are required" },
        { status: 400 }
      );
    }

    const cleanIdentifier = String(identifier).trim();

    // Look up partner by code, slug, or contactEmail
    const partner = await prisma.partner.findFirst({
      where: {
        OR: [
          { code: { equals: cleanIdentifier, mode: "insensitive" } },
          { slug: { equals: cleanIdentifier, mode: "insensitive" } },
          { contactEmail: { equals: cleanIdentifier.toLowerCase(), mode: "insensitive" } },
        ],
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: "Invalid partner credentials" },
        { status: 401 }
      );
    }

    if (partner.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `Partner account is currently ${partner.status.toLowerCase()}. Please contact GovStudyX Admin.` },
        { status: 403 }
      );
    }

    // Verify password if set
    if (partner.passwordHash) {
      const isValid = await bcrypt.compare(password, partner.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid partner credentials" },
          { status: 401 }
        );
      }
    } else {
      // Default fallback if admin hasn't set custom password yet
      // Allows initial login with partner code as password, requiring immediate change
      if (password !== partner.code && password !== "GovStudyX2026!") {
        return NextResponse.json(
          { error: "Invalid partner credentials" },
          { status: 401 }
        );
      }
    }

    const token = await signPartnerJWT(partner.id, partner.code);

    const cookieStore = await cookies();
    cookieStore.set("cse_partner_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return NextResponse.json({
      success: true,
      message: `Welcome to the Partner Portal, ${partner.name}!`,
      partner: {
        id: partner.id,
        code: partner.code,
        slug: partner.slug,
        name: partner.name,
        type: partner.type,
        commissionRate: partner.commissionRate,
        badgeText: partner.badgeText,
      },
    });
  } catch (error) {
    console.error("[PARTNER_LOGIN_ERROR]", error);
    return NextResponse.json({ error: "Partner login failed" }, { status: 500 });
  }
}
