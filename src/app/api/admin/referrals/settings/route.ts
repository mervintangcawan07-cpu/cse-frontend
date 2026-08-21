// Relative Path: src/app/api/admin/referrals/settings/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { ReferralService } from "@/lib/referral/referralService";
import { getClientIp } from "@/lib/ratelimit";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const config = await ReferralService.getProgramConfig();
    const auditLogs = await prisma.referralAuditLog.findMany({
      where: { action: "REFERRAL_SETTINGS_UPDATED" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ success: true, config, auditLogs });
  } catch (error) {
    console.error("[ADMIN_SETTINGS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const clientIp = getClientIp(request);

    const updatedConfig = await ReferralService.updateProgramConfig({
      config: body,
      adminUserId: user.id,
      clientIp,
    });

    return NextResponse.json({
      success: true,
      config: updatedConfig,
      message: "Referral program settings saved successfully!",
    });
  } catch (error) {
    console.error("[ADMIN_SETTINGS_PUT_ERROR]", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
