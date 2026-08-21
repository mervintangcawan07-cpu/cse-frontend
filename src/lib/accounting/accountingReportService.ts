// Relative Path: src/lib/accounting/accountingReportService.ts
import { prisma } from "@/lib/prisma";
import { formatCentavosToPesos } from "./money";
import { WaterfallEngine } from "./waterfallEngine";

export class AccountingReportService {
  /**
   * Generates CSV export for general journal ledger entries.
   */
  static async exportLedgerCSV(): Promise<string> {
    const entries = await prisma.financialLedgerEntry.findMany({
      orderBy: { effectiveDate: "desc" },
      take: 1000,
    });

    const headers = [
      "Entry Number",
      "Effective Date",
      "Transaction Type",
      "Account Category",
      "Entry Type",
      "Amount Centavos",
      "Formatted PHP",
      "Source Entity",
      "Source ID",
      "Description",
    ];

    const rows = entries.map((e) => [
      e.entryNumber,
      e.effectiveDate.toISOString(),
      e.transactionType,
      e.accountCategory,
      e.entryType,
      e.amountCentavos,
      formatCentavosToPesos(e.amountCentavos),
      e.sourceEntity,
      e.sourceId,
      `"${(e.description || "").replace(/"/g, '""')}"`,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  /**
   * Generates CSV export for customer transactions and waterfall breakdown.
   */
  static async exportTransactionsCSV(): Promise<string> {
    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: {
        user: { select: { name: true, email: true } },
        referralReward: true,
        partnerCommission: true,
      },
    });

    const headers = [
      "Transaction ID",
      "Date",
      "Customer Name",
      "Customer Email",
      "Plan Type",
      "Gross Price PHP",
      "Discount PHP",
      "Actual Paid PHP",
      "PayMongo Fee PHP",
      "Referral Reward PHP",
      "Partner Commission PHP",
      "Status",
    ];

    const rows = transactions.map((t) => {
      const paymentCentavos = t.amount > 5000 ? t.amount : t.amount * 100;
      const discountCentavos = t.discountAmountCentavos || 0;
      const grossCentavos = t.grossAmountCentavos || paymentCentavos + discountCentavos;
      const feeCentavos = t.feeAmountCentavos || 0;
      const referralCentavos = t.referralReward?.rewardAmountCentavos || 0;
      const partnerCentavos = t.partnerCommission?.commissionAmountCentavos || 0;

      return [
        t.id,
        t.createdAt.toISOString(),
        `"${(t.user?.name || "").replace(/"/g, '""')}"`,
        t.user?.email || "",
        t.planType,
        formatCentavosToPesos(grossCentavos),
        formatCentavosToPesos(discountCentavos),
        formatCentavosToPesos(paymentCentavos),
        formatCentavosToPesos(feeCentavos),
        formatCentavosToPesos(referralCentavos),
        formatCentavosToPesos(partnerCentavos),
        t.status,
      ];
    });

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  /**
   * Computes comparative periodic reports (This Month vs Last Month).
   */
  static async getPeriodicComparison() {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [thisMonthWaterfall, lastMonthWaterfall] = await Promise.all([
      WaterfallEngine.computeWaterfall({ startDate: startOfThisMonth }),
      WaterfallEngine.computeWaterfall({ startDate: startOfLastMonth, endDate: endOfLastMonth }),
    ]);

    return {
      thisMonth: thisMonthWaterfall,
      lastMonth: lastMonthWaterfall,
    };
  }
}
