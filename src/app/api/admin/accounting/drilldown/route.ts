// Relative Path: src/app/api/admin/accounting/drilldown/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { WaterfallEngine } from "@/lib/accounting/waterfallEngine";
import { formatCentavosToPesos } from "@/lib/accounting/money";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const metricType = searchParams.get("type") || "gross_sales";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const waterfall = await WaterfallEngine.computeWaterfall();
    const explanation = WaterfallEngine.getCalculationExplanation(metricType, waterfall);

    let items: any[] = [];
    let total = 0;

    if (metricType === "gross_sales" || metricType === "customer_payments" || metricType === "discounts" || metricType === "paymongo_fees") {
      const where: any = { status: "PAID" };
      if (metricType === "discounts") {
        where.discountAmountCentavos = { gt: 0 };
      }

      [total, items] = await Promise.all([
        prisma.transaction.count({ where }),
        prisma.transaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { name: true, email: true } },
            referralReward: true,
            partnerCommission: true,
          },
        }),
      ]);

      items = items.map((t) => {
        const paymentCentavos = t.amount > 5000 ? t.amount : t.amount * 100;
        const discountCentavos = t.discountAmountCentavos || 0;
        const grossCentavos = t.grossAmountCentavos || paymentCentavos + discountCentavos;
        const feeCentavos = t.feeAmountCentavos || 0;

        let displayAmountCentavos = grossCentavos;
        if (metricType === "customer_payments") displayAmountCentavos = paymentCentavos;
        else if (metricType === "discounts") displayAmountCentavos = discountCentavos;
        else if (metricType === "paymongo_fees") displayAmountCentavos = feeCentavos;

        return {
          id: t.id,
          date: t.createdAt.toISOString(),
          reference: t.checkoutSessionId,
          description: `${t.planType} Subscription`,
          customerName: t.user?.name || "Student",
          customerEmailMasked: t.user?.email ? t.user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3") : "—",
          amountCentavos: displayAmountCentavos,
          formattedAmount: formatCentavosToPesos(displayAmountCentavos),
          grossCentavos,
          discountCentavos,
          actualPaymentCentavos: paymentCentavos,
          feeCentavos,
          status: t.status,
        };
      });
    } else if (metricType === "referral_rewards") {
      [total, items] = await Promise.all([
        prisma.referralReward.count(),
        prisma.referralReward.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            inviter: { select: { name: true, email: true } },
            referredUser: { select: { name: true, email: true } },
            transaction: true,
          },
        }),
      ]);

      items = items.map((r) => ({
        id: r.id,
        date: r.createdAt.toISOString(),
        reference: `REF-RWD-${r.id.substring(0, 8).toUpperCase()}`,
        description: `20% Referral Commission (${r.effectiveRate}%)`,
        inviterName: r.inviter?.name || "Student Inviter",
        inviterEmailMasked: r.inviter?.email ? r.inviter.email.replace(/(.{2})(.*)(@.*)/, "$1***$3") : "—",
        referredUserName: r.referredUser?.name || "Referred Student",
        amountCentavos: r.rewardAmountCentavos,
        formattedAmount: formatCentavosToPesos(r.rewardAmountCentavos),
        qualifyingPurchaseCentavos: r.purchaseAmountCentavos,
        effectiveRate: r.effectiveRate,
        status: r.status,
        holdingUntil: r.holdingUntil?.toISOString() || null,
      }));
    } else if (metricType === "partner_commissions") {
      [total, items] = await Promise.all([
        prisma.partnerCommission.count(),
        prisma.partnerCommission.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            partner: { select: { name: true, code: true, type: true } },
            transaction: {
              include: { user: { select: { name: true, email: true } } },
            },
          },
        }),
      ]);

      items = items.map((p) => ({
        id: p.id,
        date: p.createdAt.toISOString(),
        reference: `PTR-COMM-${p.id.substring(0, 8).toUpperCase()}`,
        description: `Partner Commission (${p.partner?.name})`,
        partnerName: p.partner?.name || "Partner",
        partnerCode: p.partner?.code || "PTR",
        amountCentavos: p.commissionAmountCentavos,
        formattedAmount: formatCentavosToPesos(p.commissionAmountCentavos),
        qualifyingPurchaseCentavos: p.purchaseAmountCentavos,
        effectiveRate: p.effectiveRate,
        status: p.status,
        holdingUntil: p.holdingUntil?.toISOString() || null,
      }));
    } else if (metricType === "taxes") {
      [total, items] = await Promise.all([
        prisma.taxRecord.count(),
        prisma.taxRecord.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { taxConfig: true },
        }),
      ]);

      items = items.map((tr) => ({
        id: tr.id,
        date: tr.createdAt.toISOString(),
        reference: `TAX-${tr.id.substring(0, 8).toUpperCase()}`,
        description: `${tr.taxConfig?.name} (${tr.appliedRate}%)`,
        taxName: tr.taxConfig?.name,
        taxType: tr.taxConfig?.taxType,
        taxableAmountCentavos: tr.taxableAmountCentavos,
        amountCentavos: tr.taxAmountCentavos,
        formattedAmount: formatCentavosToPesos(tr.taxAmountCentavos),
        appliedRate: tr.appliedRate,
        status: tr.status,
      }));
    } else if (metricType === "deductions") {
      [total, items] = await Promise.all([
        prisma.financialDeduction.count(),
        prisma.financialDeduction.findMany({
          skip,
          take: limit,
          orderBy: { date: "desc" },
        }),
      ]);

      items = items.map((d) => ({
        id: d.id,
        date: d.date.toISOString(),
        reference: d.reference || `DED-${d.id.substring(0, 8).toUpperCase()}`,
        description: d.description,
        category: d.category,
        amountCentavos: d.amountCentavos,
        formattedAmount: formatCentavosToPesos(d.amountCentavos),
        status: d.status,
      }));
    }

    return NextResponse.json({
      success: true,
      metricType,
      explanation,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    });
  } catch (error) {
    console.error("[ADMIN_DRILLDOWN_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to drill down metric" }, { status: 500 });
  }
}
