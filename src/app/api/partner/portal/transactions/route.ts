// Relative Path: src/app/api/partner/portal/transactions/route.ts
import { NextResponse } from "next/server";
import { requirePartnerAuth } from "@/lib/partnerAuth";
import { prisma } from "@/lib/prisma";
import { formatCentavosToPesos } from "@/lib/accounting/money";

export async function GET(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const [total, commissions] = await Promise.all([
      prisma.partnerCommission.count({ where: { partnerId: partner.id } }),
      prisma.partnerCommission.findMany({
        where: { partnerId: partner.id },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          transaction: {
            include: {
              user: { select: { name: true, email: true } },
            },
          },
        },
      }),
    ]);

    const now = new Date();

    const items = commissions.map((c) => {
      let displayStatus = c.status as string;
      if (c.status === "PENDING" && c.holdingUntil && c.holdingUntil <= now) {
        displayStatus = "AVAILABLE";
      }

      // Mask student email for student privacy: jo***@gmail.com
      const rawEmail = c.transaction?.user?.email;
      const maskedEmail = rawEmail
        ? rawEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3")
        : "Student";

      return {
        id: c.id,
        date: c.createdAt.toISOString(),
        planType: c.transaction?.planType || "PRO_SUBSCRIPTION",
        studentName: c.transaction?.user?.name || "Student",
        studentEmailMasked: maskedEmail,
        purchaseAmountCentavos: c.purchaseAmountCentavos,
        formattedPurchaseAmount: formatCentavosToPesos(c.purchaseAmountCentavos),
        effectiveRate: c.effectiveRate,
        commissionAmountCentavos: c.commissionAmountCentavos,
        formattedCommissionAmount: formatCentavosToPesos(c.commissionAmountCentavos),
        status: displayStatus,
        holdingUntil: c.holdingUntil?.toISOString() || null,
      };
    });

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    });
  } catch (error) {
    console.error("[PARTNER_PORTAL_TRANSACTIONS_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch partner transactions" }, { status: 500 });
  }
}
