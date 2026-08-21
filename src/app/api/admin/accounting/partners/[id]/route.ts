// Relative Path: src/app/api/admin/accounting/partners/[id]/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { PartnerService } from "@/lib/accounting/partnerService";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const statement = await PartnerService.getPartnerStatement(id);

    return NextResponse.json({ success: true, data: statement });
  } catch (error) {
    console.error("[ADMIN_PARTNER_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch partner statement" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { commissionModel, commissionRate, fixedCommissionCentavos, reason, status, notes } = body;

    if (status) {
      await prisma.partner.update({
        where: { id },
        data: { status, notes },
      });
    }

    if (commissionRate !== undefined && commissionModel) {
      await PartnerService.updatePartnerRate({
        partnerId: id,
        commissionModel,
        commissionRate,
        fixedCommissionCentavos: fixedCommissionCentavos ? Math.round(fixedCommissionCentavos * 100) : 0,
        reason: reason || "Admin rate update",
        adminUserId: user.id,
      });
    }

    const updated = await PartnerService.getPartnerStatement(id);
    return NextResponse.json({
      success: true,
      message: "Partner updated successfully with historical rate version saved!",
      data: updated,
    });
  } catch (error: any) {
    console.error("[ADMIN_PARTNER_PUT_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to update partner" }, { status: 500 });
  }
}
