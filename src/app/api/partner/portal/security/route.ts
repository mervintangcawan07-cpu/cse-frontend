// Relative Path: src/app/api/partner/portal/security/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requirePartnerAuth, signPartnerJWT } from "@/lib/partnerAuth";
import { prisma } from "@/lib/prisma";
import { PartnerAuditService } from "@/lib/accounting/partnerAuditService";

export async function GET(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const auditLogs = await PartnerAuditService.getPartnerAuditLogs(partner.id, 25);

    const formattedLogs = auditLogs.map((l) => ({
      id: l.id,
      action: l.action,
      createdAt: l.createdAt.toISOString(),
      reason: l.reason,
      metadata: l.metadata,
      ipAddress: l.ipAddress ? `${l.ipAddress.slice(0, 7)}***` : "—",
    }));

    return NextResponse.json({
      success: true,
      partnerId: partner.partnerId || partner.code,
      email: partner.contactEmail,
      auditLogs: formattedLogs,
    });
  } catch (error) {
    console.error("[PARTNER_SECURITY_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch security logs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const dbPartner = await prisma.partner.findUnique({
      where: { id: partner.id },
    });

    if (!dbPartner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    let isCurrentValid = false;
    if (dbPartner.passwordHash) {
      isCurrentValid = await bcrypt.compare(currentPassword, dbPartner.passwordHash);
    } else if (dbPartner.tempPasswordHash) {
      isCurrentValid = await bcrypt.compare(currentPassword, dbPartner.tempPasswordHash);
    }

    if (!isCurrentValid) {
      return NextResponse.json(
        { error: "The current password entered is incorrect." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        passwordHash,
        tempPasswordHash: null,
        mustChangePassword: false,
        updatedAt: new Date(),
      },
    });

    await PartnerAuditService.logEvent({
      action: "PARTNER_PASSWORD_CHANGED",
      partnerId: partner.id,
      reason: "User initiated password update from Security tab",
    });

    const displayId = partner.partnerId || partner.code;
    const updatedToken = await signPartnerJWT(partner.id, displayId);

    const response = NextResponse.json({
      success: true,
      message: "Password updated successfully!",
    });

    response.cookies.set("cse_partner_session", updatedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[PARTNER_SECURITY_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
}
