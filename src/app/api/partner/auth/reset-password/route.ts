// Relative Path: src/app/api/partner/auth/reset-password/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { PartnerAuditService } from "@/lib/accounting/partnerAuditService";
import { canUsePartnerPasswordRecovery } from "@/lib/accounting/partnerService";
import {
  AUTH_LIMITER,
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from "@/lib/ratelimit";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitKey = `partner:reset-password:${clientIp}`;

    const rateResult = await checkRateLimit(AUTH_LIMITER, rateLimitKey);
    if (!rateResult.success) {
      return createRateLimitResponse(
        rateResult,
        "Too many password reset attempts. Please wait a moment before trying again."
      );
    }

    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "Reset token and new password are required." },
        { status: 400 }
      );
    }

    if (String(newPassword).length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const lookupTime = new Date();
    const partner = await prisma.partner.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: lookupTime },
      },
      select: {
        id: true,
        status: true,
        passwordHash: true,
        tempPasswordHash: true,
      },
    });

    if (!partner || !canUsePartnerPasswordRecovery(partner)) {
      return NextResponse.json(
        { error: "This password reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const consumptionTime = new Date();

    const consumed = await prisma.partner.updateMany({
      where: {
        id: partner.id,
        resetToken: token,
        resetTokenExpires: { gt: consumptionTime },
        status: "ACTIVE",
        OR: [
          { passwordHash: { not: null } },
          { tempPasswordHash: { not: null } },
        ],
      },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
        setupToken: null,
        setupTokenExpires: null,
        tempPasswordHash: null,
        mustChangePassword: false,
      },
    });
    if (consumed.count !== 1) {
      return NextResponse.json(
        { error: "This password reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    await PartnerAuditService.logEvent({
      action: "PARTNER_PASSWORD_CHANGED",
      partnerId: partner.id,
      reason: "Reset via email reset token",
    });

    return NextResponse.json({
      success: true,
      message: "Password reset successfully! You can now sign in with your new password.",
    });
  } catch (error) {
    console.error("[PARTNER_RESET_PASSWORD_ERROR]", error);
    return NextResponse.json({ error: "Failed to reset password." }, { status: 500 });
  }
}
