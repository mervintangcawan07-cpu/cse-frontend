// Relative Path: src/app/api/partner/portal/overview/route.ts
import { NextResponse } from "next/server";
import { requirePartnerAuth } from "@/lib/partnerAuth";
import { prisma } from "@/lib/prisma";
import { formatCentavosToPesos } from "@/lib/accounting/money";

export async function GET(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();

    const [dbPartner, commissions, payouts, totalAttributionsCount] = await Promise.all([
      prisma.partner.findUnique({
        where: { id: partner.id },
        select: {
          id: true,
          code: true,
          slug: true,
          name: true,
          type: true,
          tagline: true,
          badgeText: true,
          commissionModel: true,
          commissionRate: true,
          holdingPeriodDays: true,
          minPayoutCentavos: true,
          payoutMethod: true,
          accountName: true,
          bankName: true,
        },
      }),
      prisma.partnerCommission.findMany({
        where: { partnerId: partner.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.partnerPayout.findMany({
        where: { partnerId: partner.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.partnerAttribution.count({
        where: { partnerId: partner.id },
      }),
    ]);

    if (!dbPartner) {
      return NextResponse.json({ error: "Partner record not found" }, { status: 404 });
    }

    let totalRevenueCentavos = 0;
    let totalCommissionsCentavos = 0;
    let availableBalanceCentavos = 0;
    let pendingCommissionsCentavos = 0;
    let paidCommissionsCentavos = 0;
    let reversedCommissionsCentavos = 0;

    commissions.forEach((c) => {
      totalRevenueCentavos += c.purchaseAmountCentavos;

      if (c.status === "PAID") {
        totalCommissionsCentavos += c.commissionAmountCentavos;
        paidCommissionsCentavos += c.commissionAmountCentavos;
      } else if (
        c.status === "AVAILABLE" ||
        (c.status === "PENDING" && c.holdingUntil && c.holdingUntil <= now)
      ) {
        totalCommissionsCentavos += c.commissionAmountCentavos;
        availableBalanceCentavos += c.commissionAmountCentavos;
      } else if (c.status === "PENDING") {
        totalCommissionsCentavos += c.commissionAmountCentavos;
        pendingCommissionsCentavos += c.commissionAmountCentavos;
      } else if (c.status === "REVERSED" || c.status === "CANCELLED") {
        reversedCommissionsCentavos += c.commissionAmountCentavos;
      }
    });

    let totalPayoutsDisbursedCentavos = 0;
    let pendingPayoutRequestsCentavos = 0;

    const channelMap: Record<
      string,
      { count: number; revenueCentavos: number; commissionCentavos: number }
    > = {};

    commissions.forEach((c) => {
      const src = c.campaignSource || "direct";
      if (!channelMap[src]) {
        channelMap[src] = { count: 0, revenueCentavos: 0, commissionCentavos: 0 };
      }
      channelMap[src].count += 1;
      channelMap[src].revenueCentavos += c.purchaseAmountCentavos;
      channelMap[src].commissionCentavos += c.commissionAmountCentavos;
    });

    const channelBreakdown = Object.entries(channelMap).map(([channel, data]) => ({
      channel,
      count: data.count,
      revenueCentavos: data.revenueCentavos,
      commissionCentavos: data.commissionCentavos,
      formattedRevenue: formatCentavosToPesos(data.revenueCentavos),
      formattedCommission: formatCentavosToPesos(data.commissionCentavos),
    }));

    payouts.forEach((p) => {
      if (p.status === "PAID") {
        totalPayoutsDisbursedCentavos += p.amountCentavos;
      } else if (p.status === "REQUESTED" || p.status === "APPROVED") {
        pendingPayoutRequestsCentavos += p.amountCentavos;
      }
    });

    // Net available after pending payout requests
    const netAvailableCentavos = Math.max(0, availableBalanceCentavos - pendingPayoutRequestsCentavos);

    const referralSlugOrCode = dbPartner.slug || dbPartner.code;
    const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || "https://govstudyx.com"}/p/${referralSlugOrCode}`;

    return NextResponse.json({
      success: true,
      partner: dbPartner,
      accounting: {
        totalAttributionsCount,
        totalPurchasesCount: commissions.length,
        totalRevenueCentavos,
        formattedTotalRevenue: formatCentavosToPesos(totalRevenueCentavos),

        commissionModel: dbPartner.commissionModel,
        commissionRate: dbPartner.commissionRate,

        totalCommissionsCentavos,
        formattedTotalCommissions: formatCentavosToPesos(totalCommissionsCentavos),

        availableBalanceCentavos: netAvailableCentavos,
        formattedAvailableBalance: formatCentavosToPesos(netAvailableCentavos),

        pendingCommissionsCentavos,
        formattedPendingCommissions: formatCentavosToPesos(pendingCommissionsCentavos),

        paidCommissionsCentavos: totalPayoutsDisbursedCentavos,
        formattedPaidCommissions: formatCentavosToPesos(totalPayoutsDisbursedCentavos),

        pendingPayoutRequestsCentavos,
        formattedPendingPayouts: formatCentavosToPesos(pendingPayoutRequestsCentavos),

        holdingPeriodDays: dbPartner.holdingPeriodDays,
        minPayoutCentavos: dbPartner.minPayoutCentavos,
        formattedMinPayout: formatCentavosToPesos(dbPartner.minPayoutCentavos),
        channelBreakdown,
      },
      referralDetails: {
        code: dbPartner.code,
        slug: dbPartner.slug,
        link: referralLink,
      },
      calculationExplanation: {
        formula: `Partner Commission = Qualifying Customer Purchase × ${dbPartner.commissionRate}%`,
        rule: `Commissions are accrued immediately upon student payment and held for ${dbPartner.holdingPeriodDays} days to ensure financial settlement. Minimum cash payout threshold is ${formatCentavosToPesos(dbPartner.minPayoutCentavos)}.`,
      },
    });
  } catch (error) {
    console.error("[PARTNER_PORTAL_OVERVIEW_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch partner overview" }, { status: 500 });
  }
}
