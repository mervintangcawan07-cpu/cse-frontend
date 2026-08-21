// Relative Path: src/lib/accounting/reconciliationService.ts
import { prisma } from "@/lib/prisma";
import { ReconciliationStatus } from "./types";

export class ReconciliationService {
  /**
   * Reconciles an internal transaction with gateway events and ledger entries.
   */
  static async reconcileTransaction(transactionId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        ledgerEntries: true,
        referralReward: true,
        partnerCommission: true,
      },
    });

    if (!transaction) return null;

    const expectedPaymentCentavos = transaction.amount > 5000 ? transaction.amount : transaction.amount * 100;

    // Check payment ledger entries
    const paymentDebit = transaction.ledgerEntries.find(
      (e) => e.transactionType === "PAYMENT_RECEIVED" && e.entryType === "DEBIT"
    );
    const paymentCredit = transaction.ledgerEntries.find(
      (e) => e.transactionType === "PAYMENT_RECEIVED" && e.entryType === "CREDIT"
    );

    let status: ReconciliationStatus = "MATCHED";
    let discrepancyCentavos = 0;
    let discrepancyNotes = "Matched with verified ledger entries.";

    if (!paymentDebit || !paymentCredit) {
      status = "MISSING";
      discrepancyNotes = "Missing balanced payment ledger entries.";
    } else if (
      paymentDebit.amountCentavos !== expectedPaymentCentavos ||
      paymentCredit.amountCentavos !== expectedPaymentCentavos
    ) {
      status = "MISMATCHED";
      discrepancyCentavos = Math.abs(paymentDebit.amountCentavos - expectedPaymentCentavos);
      discrepancyNotes = `Amount mismatch: Expected ${expectedPaymentCentavos}, got ${paymentDebit.amountCentavos}`;
    }

    const record = await prisma.reconciliationRecord.upsert({
      where: { id: `rec_${transaction.id}` },
      update: {
        status,
        discrepancyCentavos,
        discrepancyNotes,
      },
      create: {
        id: `rec_${transaction.id}`,
        sourceType: "INTERNAL_TRANSACTION",
        sourceId: transaction.id,
        matchedTransactionId: transaction.id,
        status,
        discrepancyCentavos,
        discrepancyNotes,
      },
    });

    return record;
  }

  /**
   * Runs batch reconciliation across recent transactions.
   */
  static async runBatchReconciliation() {
    const transactions = await prisma.transaction.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const results = [];
    for (const t of transactions) {
      const res = await this.reconcileTransaction(t.id);
      if (res) results.push(res);
    }

    return results;
  }
}
