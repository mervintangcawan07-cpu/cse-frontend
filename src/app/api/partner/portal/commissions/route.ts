// Relative Path: src/app/api/partner/portal/commissions/route.ts
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

    let totalEarnedCentavos = 0;
    let pendingCentavos = 0;
    let availableCentavos = 0;
    let paidCentavos = 0;
    let reversedCentavos = 0;

    const allCommissions = await prisma.partnerCommission.findMany({
      where: { partnerId: partner.id },
      select: {
        commissionAmountCentavos: true,
        status: true,
        holdingUntil: true,
      },
    });

    allCommissions.forEach((c) => {
      if (c.status === "PAID") {
        totalEarnedCentavos += c.commissionAmountCentavos;
        paidCentavos += c.commissionAmountCentavos;
      } else if (
        c.status === "AVAILABLE" ||
        (c.status === "PENDING" && c.holdingUntil && c.holdingUntil <= now)
      ) {
        totalEarnedCentavos += c.commissionAmountCentavos;
        availableCentavos += c.commissionAmountCentavos;
      } else if (c.status === "PENDING") {
        totalEarnedCentavos += c.commissionAmountCentavos;
        pendingCentavos += c.commissionAmountCentavos;
      } else if (c.status === "REVERSED" || c.status === "CANCELLED") {
        reversedCentavos += c.commissionAmountCentavos;
      }
    });

    const items = commissions.map((c) => {
      let displayStatus = c.status as string;
      if (c.status === "PENDING" && c.holdingUntil && c.holdingUntil <= now) {
        displayStatus = "AVAILABLE";
      }

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
        formattedPurchase: formatCentavosToPesos(c.purchaseAmountCentavos),
        effectiveRate: c.effectiveRate,
        commissionAmountCentavos: c.commissionAmountCentavos,
        formattedCommission: formatCentavosToPesos(c.commissionAmountCentavos),
        status: displayStatus,
        campaignSource: c.campaignSource || "direct",
        holdingUntil: c.holdingUntil?.toISOString() || null,
        calculation: {
          basis: "Customer Payment",
          purchaseAmountPesos: formatCentavosToPesos(c.purchaseAmountCentavos),
          ratePercent: `${c.effectiveRate}%`,
          formula: `${formatCentavosToPesos(c.purchaseAmountCentavos)} × ${c.effectiveRate}%`,
          commissionPesos: formatCentavosToPesos(c.commissionAmountCentavos),
          currencyRepresentation: "Integer Centavos (Server-Side Exact)",
        },
      };
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalEarnedCentavos,
        formattedTotalEarned: formatCentavosToPesos(totalEarnedCentavos),
        pendingCentavos,
        formattedPending: formatCentavosToPesos(pendingCentavos),
        availableCentavos,
        formattedAvailable: formatCentavosToPesos(availableCentavos),
        paidCentavos,
        formattedPaid: formatCentavosToPesos(paidCentavos),
        reversedCentavos,
        formattedReversed: formatCentavosToPesos(reversedCentavos),
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      items,
    });
  } catch (error) {
    console.error("[PARTNER_PORTAL_COMMISSIONS_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch partner commissions" }, { status: 500 });
  }
}
