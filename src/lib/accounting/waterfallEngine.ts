// Relative Path: src/lib/accounting/waterfallEngine.ts
import { prisma } from "@/lib/prisma";
import { WaterfallSummary, CalculationExplanation } from "./types";
import { formatCentavosToPesos } from "./money";

export interface WaterfallFilterParams {
  startDate?: Date;
  endDate?: Date;
  periodId?: string;
}

export class WaterfallEngine {
  /**
   * Derives the authoritative financial waterfall from verified records.
   * All math is executed strictly server-side using integer centavos.
   */
  static async computeWaterfall(params: WaterfallFilterParams = {}): Promise<WaterfallSummary> {
    const { startDate, endDate } = params;

    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = startDate;
      if (endDate) dateFilter.createdAt.lte = endDate;
    }

    // 1. Transactions Aggregation
    const [paidTransactions, refundedTransactions, failedTransactions] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          status: "PAID",
          ...(startDate || endDate ? dateFilter : {}),
        },
        select: {
          id: true,
          amount: true,
          grossAmountCentavos: true,
          discountAmountCentavos: true,
          feeAmountCentavos: true,
          netSettlementCentavos: true,
        },
      }),
      prisma.transaction.findMany({
        where: {
          status: "REFUNDED",
          ...(startDate || endDate ? dateFilter : {}),
        },
        select: {
          id: true,
          amount: true,
          grossAmountCentavos: true,
          feeAmountCentavos: true,
        },
      }),
      prisma.transaction.findMany({
        where: {
          status: "FAILED",
          ...(startDate || endDate ? dateFilter : {}),
        },
        select: { id: true },
      }),
    ]);

    let grossPremiumSalesCentavos = 0;
    let discountsCentavos = 0;
    let customerPaymentsCentavos = 0;
    let paymongoFeesCentavos = 0;

    paidTransactions.forEach((t) => {
      // Amount in Transaction: either in pesos (<=1000) or centavos (>1000)
      const actualPaymentCentavos = t.amount > 5000 ? t.amount : t.amount * 100;
      const discount = t.discountAmountCentavos || 0;
      const gross = t.grossAmountCentavos || actualPaymentCentavos + discount;
      const fee = t.feeAmountCentavos || (t.netSettlementCentavos ? actualPaymentCentavos - t.netSettlementCentavos : 0);

      grossPremiumSalesCentavos += gross;
      discountsCentavos += discount;
      customerPaymentsCentavos += actualPaymentCentavos;
      paymongoFeesCentavos += fee;
    });

    let refundsCentavos = 0;
    refundedTransactions.forEach((t) => {
      const amtCentavos = t.amount > 5000 ? t.amount : t.amount * 100;
      refundsCentavos += amtCentavos;
    });

    // 2. Referral Rewards Aggregation
    const referralRewards = await prisma.referralReward.findMany({
      where: {
        ...(startDate || endDate ? dateFilter : {}),
      },
      select: {
        id: true,
        rewardAmountCentavos: true,
        status: true,
      },
    });

    let referralRewardsCentavos = 0;
    let paidReferralRewardsCentavos = 0;
    let pendingReferralLiabilitiesCentavos = 0;

    referralRewards.forEach((r) => {
      if (r.status !== "REVERSED" && r.status !== "REFUNDED" && r.status !== "CANCELLED") {
        referralRewardsCentavos += r.rewardAmountCentavos;
        if (r.status === "PAID") {
          paidReferralRewardsCentavos += r.rewardAmountCentavos;
        } else {
          pendingReferralLiabilitiesCentavos += r.rewardAmountCentavos;
        }
      }
    });

    // 3. Partner Commissions Aggregation
    const partnerCommissions = await prisma.partnerCommission.findMany({
      where: {
        ...(startDate || endDate ? dateFilter : {}),
      },
      select: {
        id: true,
        commissionAmountCentavos: true,
        status: true,
      },
    });

    let partnerCommissionsCentavos = 0;
    let paidPartnerCommissionsCentavos = 0;
    let pendingPartnerLiabilitiesCentavos = 0;

    partnerCommissions.forEach((p) => {
      if (p.status !== "REVERSED" && p.status !== "CANCELLED") {
        partnerCommissionsCentavos += p.commissionAmountCentavos;
        if (p.status === "PAID") {
          paidPartnerCommissionsCentavos += p.commissionAmountCentavos;
        } else {
          pendingPartnerLiabilitiesCentavos += p.commissionAmountCentavos;
        }
      }
    });

    // 4. Tax Provisions Aggregation
    const taxRecords = await prisma.taxRecord.findMany({
      where: {
        ...(startDate || endDate ? dateFilter : {}),
      },
      select: {
        id: true,
        taxAmountCentavos: true,
        status: true,
      },
    });

    let taxProvisionsCentavos = 0;
    taxRecords.forEach((tr) => {
      if (tr.status !== "REVERSED") {
        taxProvisionsCentavos += tr.taxAmountCentavos;
      }
    });

    // 5. Other Deductions / Expenses Aggregation
    const otherDeductions = await prisma.financialDeduction.findMany({
      where: {
        status: "RECORDED",
        ...(startDate || endDate ? { date: dateFilter.createdAt } : {}),
      },
      select: {
        id: true,
        amountCentavos: true,
      },
    });

    let otherDeductionsCentavos = 0;
    otherDeductions.forEach((d) => {
      otherDeductionsCentavos += d.amountCentavos;
    });

    // 6. Pending Payout Requests
    const [pendingReferralPayouts, pendingPartnerPayouts, unreconciledCount] = await Promise.all([
      prisma.referralPayout.aggregate({
        _sum: { amountCentavos: true },
        where: { status: { in: ["REQUESTED", "UNDER_REVIEW", "PROCESSING"] } },
      }),
      prisma.partnerPayout.aggregate({
        _sum: { amountCentavos: true },
        where: { status: { in: ["REQUESTED", "UNDER_REVIEW", "PROCESSING"] } },
      }),
      prisma.reconciliationRecord.count({
        where: { status: { in: ["MISMATCHED", "MISSING", "DUPLICATE", "PENDING"] } },
      }),
    ]);

    const pendingPayoutsCentavos =
      (pendingReferralPayouts._sum.amountCentavos || 0) +
      (pendingPartnerPayouts._sum.amountCentavos || 0);

    // 7. Net Accounting Result Calculation
    // NET = Customer Payments - PayMongo Fees - Referral Liabilities - Partner Commissions - Tax Provisions - Other Deductions
    const netAccountingResultCentavos =
      customerPaymentsCentavos -
      paymongoFeesCentavos -
      referralRewardsCentavos -
      partnerCommissionsCentavos -
      taxProvisionsCentavos -
      otherDeductionsCentavos;

    // Available cash balance = Customer payments - PayMongo fees - Paid referral rewards - Paid partner commissions - Other deductions
    const availableBalanceCentavos = Math.max(
      0,
      customerPaymentsCentavos -
        paymongoFeesCentavos -
        paidReferralRewardsCentavos -
        paidPartnerCommissionsCentavos -
        otherDeductionsCentavos
    );

    const pendingLiabilitiesCentavos =
      pendingReferralLiabilitiesCentavos + pendingPartnerLiabilitiesCentavos + taxProvisionsCentavos;

    return {
      grossPremiumSalesCentavos,
      grossSalesCount: paidTransactions.length,

      discountsCentavos,
      discountCount: paidTransactions.filter((t) => (t.discountAmountCentavos || 0) > 0).length,

      customerPaymentsCentavos,
      customerPaymentCount: paidTransactions.length,

      paymongoFeesCentavos,
      paymongoFeeCount: paidTransactions.length,

      refundsCentavos,
      refundCount: refundedTransactions.length,

      chargebacksCentavos: 0,
      chargebackCount: 0,

      referralRewardsCentavos,
      referralRewardCount: referralRewards.length,

      partnerCommissionsCentavos,
      partnerCommissionCount: partnerCommissions.length,

      taxProvisionsCentavos,
      taxRecordCount: taxRecords.length,

      otherDeductionsCentavos,
      otherDeductionCount: otherDeductions.length,

      netAccountingResultCentavos,

      availableBalanceCentavos,
      pendingLiabilitiesCentavos,
      paidReferralRewardsCentavos,
      paidPartnerCommissionsCentavos,
      pendingPayoutsCentavos,
      unreconciledTransactionsCount: unreconciledCount,

      currency: "PHP",
    };
  }

  /**
   * Provides detailed "How was this calculated?" explanation for any financial metric.
   */
  static getCalculationExplanation(
    metricKey: string,
    summary: WaterfallSummary
  ): CalculationExplanation {
    switch (metricKey) {
      case "gross_sales":
        return {
          itemName: "Gross Premium Sales",
          amountCentavos: summary.grossPremiumSalesCentavos,
          formattedAmount: formatCentavosToPesos(summary.grossPremiumSalesCentavos),
          formula: "Gross Premium Sales = Sum of all published list prices for purchased Premium subscriptions",
          ruleExplanation:
            "Represents total nominal subscription value prior to the application of discount vouchers or promotional rebates.",
          underlyingRecordsCount: summary.grossSalesCount,
          drillDownEndpoint: "/api/admin/accounting/drilldown?type=gross_sales",
        };

      case "discounts":
        return {
          itemName: "Discounts & Promotional Rebates",
          amountCentavos: summary.discountsCentavos,
          formattedAmount: formatCentavosToPesos(summary.discountsCentavos),
          formula: "Discounts = Sum of all promotional coupons and price reductions applied at checkout",
          ruleExplanation:
            "Discounts directly reduce the customer payment base for all referral and partner calculations.",
          underlyingRecordsCount: summary.discountCount,
          drillDownEndpoint: "/api/admin/accounting/drilldown?type=discounts",
        };

      case "customer_payments":
        return {
          itemName: "Customer Payments (Collected)",
          amountCentavos: summary.customerPaymentsCentavos,
          formattedAmount: formatCentavosToPesos(summary.customerPaymentsCentavos),
          formula: "Customer Payments = Gross Premium Sales - Discounts (Actual Cash Charged)",
          ruleExplanation:
            "The authoritative qualifying base for all referral rewards (20%) and partner percentage commissions.",
          underlyingRecordsCount: summary.customerPaymentCount,
          drillDownEndpoint: "/api/admin/accounting/drilldown?type=customer_payments",
        };

      case "paymongo_fees":
        return {
          itemName: "PayMongo Processing Fees",
          amountCentavos: summary.paymongoFeesCentavos,
          formattedAmount: formatCentavosToPesos(summary.paymongoFeesCentavos),
          formula: "PayMongo Fees = Sum of payment gateway transaction processing charges",
          ruleExplanation:
            "PayMongo fees are operational platform expenses. By rule, they are EXCLUDED from reducing the referral calculation base.",
          underlyingRecordsCount: summary.paymongoFeeCount,
          drillDownEndpoint: "/api/admin/accounting/drilldown?type=paymongo_fees",
        };

      case "referral_rewards":
        return {
          itemName: "Referral Rewards Liability",
          amountCentavos: summary.referralRewardsCentavos,
          formattedAmount: formatCentavosToPesos(summary.referralRewardsCentavos),
          formula: "Referral Reward = Qualifying Customer Payment × 20.0% (Deterministic Math.round)",
          ruleExplanation:
            "Earned by students who invite peers. Held for 7 days before becoming available for ₱150 minimum cash payout.",
          underlyingRecordsCount: summary.referralRewardCount,
          drillDownEndpoint: "/api/admin/accounting/drilldown?type=referral_rewards",
        };

      case "partner_commissions":
        return {
          itemName: "Partner Commissions Liability",
          amountCentavos: summary.partnerCommissionsCentavos,
          formattedAmount: formatCentavosToPesos(summary.partnerCommissionsCentavos),
          formula: "Partner Commission = Qualifying Customer Payment × Configured Partner Rate %",
          ruleExplanation:
            "Commissions accrued to registered Facebook Pages, content creators, schools, and institutional collaborators.",
          underlyingRecordsCount: summary.partnerCommissionCount,
          drillDownEndpoint: "/api/admin/accounting/drilldown?type=partner_commissions",
        };

      case "tax_provisions":
        return {
          itemName: "Tax Provisions & Reserves",
          amountCentavos: summary.taxProvisionsCentavos,
          formattedAmount: formatCentavosToPesos(summary.taxProvisionsCentavos),
          formula: "Tax Provision = Configured Tax Base × Applied Tax Rate %",
          ruleExplanation:
            "Estimated accounting reserves configured under Admin Taxes according to professional bookkeeping policies.",
          underlyingRecordsCount: summary.taxRecordCount,
          drillDownEndpoint: "/api/admin/accounting/drilldown?type=taxes",
        };

      case "other_deductions":
        return {
          itemName: "Operational Deductions & Expenses",
          amountCentavos: summary.otherDeductionsCentavos,
          formattedAmount: formatCentavosToPesos(summary.otherDeductionsCentavos),
          formula: "Other Deductions = Sum of approved operational expenses (Hosting, Marketing, Admin)",
          ruleExplanation: "Recorded operating expenses and authorized manual debit adjustments.",
          underlyingRecordsCount: summary.otherDeductionCount,
          drillDownEndpoint: "/api/admin/accounting/drilldown?type=deductions",
        };

      case "net_result":
      default:
        return {
          itemName: "Net Accounting Result",
          amountCentavos: summary.netAccountingResultCentavos,
          formattedAmount: formatCentavosToPesos(summary.netAccountingResultCentavos),
          formula:
            "Net Accounting Result = Customer Payments - PayMongo Fees - Referral Liabilities - Partner Commissions - Tax Provisions - Other Deductions",
          ruleExplanation:
            "Comprehensive management accounting balance derived from all verified financial records.",
          underlyingRecordsCount: summary.customerPaymentCount,
          drillDownEndpoint: "/api/admin/accounting/drilldown?type=waterfall_all",
        };
    }
  }
}
