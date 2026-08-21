// Relative Path: src/app/api/partner/auth/reset-password/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { PartnerAuditService } from "@/lib/accounting/partnerAuditService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "Reset token and new password are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const partner = await prisma.partner.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: "This password reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
        tempPasswordHash: null,
        mustChangePassword: false,
      },
    });

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
