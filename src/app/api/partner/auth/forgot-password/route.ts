// Relative Path: src/app/api/partner/auth/forgot-password/route.ts
import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PartnerService } from "@/lib/accounting/partnerService";
import { sendPartnerPasswordResetEmail } from "@/lib/email";
import { PartnerAuditService } from "@/lib/accounting/partnerAuditService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier } = body;

    const genericSuccessResponse = NextResponse.json({
      success: true,
      message:
        "If an eligible partner account matches the information provided, password reset instructions will be sent to the registered email.",
    });

    if (!identifier) {
      return genericSuccessResponse;
    }

    const partner = await PartnerService.resolvePartnerByIdentifier(String(identifier).trim());

    if (!partner || !partner.contactEmail || partner.status !== "ACTIVE") {
      // Return generic response without revealing non-existence
      return genericSuccessResponse;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = new Date();
    resetTokenExpires.setHours(resetTokenExpires.getHours() + 1); // 1 hour validity

    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        resetToken,
        resetTokenExpires,
      },
    });

    await PartnerAuditService.logEvent({
      action: "PARTNER_PASSWORD_RESET",
      partnerId: partner.id,
      metadata: { initiatedBy: identifier },
    });

    // Send reset instructions strictly to the verified registered contact email
    await sendPartnerPasswordResetEmail({
      toEmail: partner.contactEmail,
      partnerName: partner.name,
      partnerId: partner.partnerId || partner.code,
      resetToken,
    });

    return genericSuccessResponse;
  } catch (error) {
    console.error("[PARTNER_FORGOT_PASSWORD_ERROR]", error);
    return NextResponse.json({
      success: true,
      message:
        "If an eligible partner account matches the information provided, password reset instructions will be sent to the registered email.",
    });
  }
}
