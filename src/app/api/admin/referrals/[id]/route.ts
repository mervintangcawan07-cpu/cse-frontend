// Relative Path: src/app/api/admin/referrals/[id]/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { ReferralService } from "@/lib/referral/referralService";
import { getClientIp } from "@/lib/ratelimit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const referral = await prisma.referral.findUnique({
      where: { id },
      include: {
        inviter: { select: { id: true, name: true, email: true, createdAt: true, isBanned: true } },
        referredUser: { select: { id: true, name: true, email: true, isPaid: true, planType: true, paidUntil: true, createdAt: true } },
        referralCode: true,
        reward: true,
      },
    });

    if (!referral) {
      return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    }

    const auditLogs = await prisma.referralAuditLog.findMany({
      where: { targetId: referral.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ success: true, referral, auditLogs });
  } catch (error) {
    console.error("[ADMIN_REFERRAL_DETAIL_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch referral details" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body;

    const validActions = ["APPROVE", "REJECT", "FLAG_SUSPICIOUS", "RESOLVE_RISK"];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const result = await ReferralService.adminActionReferral({
      referralId: id,
      action,
      reason: reason || `Admin performed ${action}`,
      adminUserId: user.id,
      clientIp,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Action failed" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Referral successfully updated: ${action}` });
  } catch (error) {
    console.error("[ADMIN_REFERRAL_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Failed to update referral" }, { status: 500 });
  }
}
