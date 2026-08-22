// Relative Path: src/app/api/partner/auth/login/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signPartnerJWT } from "@/lib/partnerAuth";
import { PartnerService } from "@/lib/accounting/partnerService";
import { PartnerAuditService } from "@/lib/accounting/partnerAuditService";
import {
  AUTH_LIMITER,
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from "@/lib/ratelimit";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitKey = `partner:login:${clientIp}`;

    // 🔒 Limit: 5 partner login attempts per 10 seconds per IP
    const rateResult = await checkRateLimit(AUTH_LIMITER, rateLimitKey);
    if (!rateResult.success) {
      return createRateLimitResponse(
        rateResult,
        "Too many partner login attempts. Please wait a moment before trying again."
      );
    }

    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Invalid partner credentials" },
        { status: 400 }
      );
    }

    const cleanIdentifier = String(identifier).trim();
    const partner = await PartnerService.resolvePartnerByIdentifier(cleanIdentifier);

    // Generic error responses prevent identifier enumeration
    if (!partner) {
      return NextResponse.json(
        { error: "Invalid partner credentials" },
        { status: 401 }
      );
    }

    if (partner.status !== "ACTIVE" && partner.status !== "PENDING") {
      await PartnerAuditService.logEvent({
        action: "PARTNER_LOGIN_FAILED",
        partnerId: partner.id,
        reason: `Account status is ${partner.status}`,
      });
      return NextResponse.json(
        { error: "Invalid partner credentials or account suspended." },
        { status: 403 }
      );
    }

    // Verify Password strictly against cryptographic hashes (no static/code fallbacks)
    let isPasswordValid = false;

    if (partner.passwordHash) {
      isPasswordValid = await bcrypt.compare(password, partner.passwordHash);
    } else if (partner.tempPasswordHash) {
      isPasswordValid = await bcrypt.compare(password, partner.tempPasswordHash);
    }

    if (!isPasswordValid) {
      await PartnerAuditService.logEvent({
        action: "PARTNER_LOGIN_FAILED",
        partnerId: partner.id,
        reason: "Incorrect password or unactivated account",
      });
      return NextResponse.json(
        { error: "Invalid partner credentials" },
        { status: 401 }
      );
    }

    const displayId = partner.partnerId || partner.code;
    const token = await signPartnerJWT(partner.id, displayId);

    const cookieStore = await cookies();
    cookieStore.set("cse_partner_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    await PartnerAuditService.logEvent({
      action: "PARTNER_LOGIN_SUCCESS",
      partnerId: partner.id,
      metadata: { partnerId: displayId, identifierUsed: cleanIdentifier },
    });

    return NextResponse.json({
      success: true,
      message: `Welcome to the Partner Portal, ${partner.name}!`,
      partner: {
        id: partner.id,
        partnerId: displayId,
        code: partner.code,
        slug: partner.slug,
        name: partner.name,
        type: partner.type,
        contactEmail: partner.contactEmail,
        commissionRate: partner.commissionRate,
        badgeText: partner.badgeText,
        mustChangePassword: partner.mustChangePassword,
      },
    });
  } catch (error) {
    console.error("[PARTNER_LOGIN_ERROR]", error);
    return NextResponse.json({ error: "Partner login failed" }, { status: 500 });
  }
}
