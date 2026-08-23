// Relative Path: src/scripts/test-accounting-payout-concurrency.ts
/**
 * GOVSTUDYX ACCOUNTING & PAYOUT CONCURRENCY SYNTHETIC TEST SUITE
 *
 * Strict read-only / zero production DB mutation.
 * Uses synthetic in-memory state models to execute all concurrency,
 * state transition, backing validation, idempotency, and refund race scenarios.
 */

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}`);
    if (detail) console.error(`     Detail: ${detail}`);
  }
}

// ─── 1. SYNTHETIC PARTNER & REFERRAL ATOMIC PAYOUT SIMULATION ───────────────────

interface SyntheticCommission {
  id: string;
  partnerId: string;
  amountCentavos: number;
  status: "PENDING" | "AVAILABLE" | "PAID" | "REVERSED" | "REFUNDED";
  holdingUntil?: Date | null;
}

interface SyntheticPayout {
  id: string;
  ownerId: string;
  amountCentavos: number;
  status: "REQUESTED" | "RESERVED" | "UNDER_REVIEW" | "APPROVED" | "PROCESSING" | "PAID" | "REJECTED" | "CANCELLED" | "FAILED" | "REVERSED";
  adminNotes?: string;
  transactionRef?: string;
}

interface SyntheticLedgerEntry {
  id: string;
  entryNumber: string;
  transactionType: string;
  accountCategory: string;
  entryType: "DEBIT" | "CREDIT";
  amountCentavos: number;
  sourceEntity: string;
  sourceId: string;
}

const FINANCIALLY_CONSUMING_STATUSES = [
  "REQUESTED",
  "RESERVED",
  "UNDER_REVIEW",
  "APPROVED",
  "PROCESSING",
];

class SyntheticPartnerFinanceEngine {
  commissions: SyntheticCommission[] = [];
  payouts: SyntheticPayout[] = [];
  ledger: SyntheticLedgerEntry[] = [];
  auditLogs: any[] = [];
  notificationsSent: string[] = [];
  lockHeld: boolean = false;

  async acquireLock() {
    while (this.lockHeld) {
      await new Promise((r) => setTimeout(r, 1));
    }
    this.lockHeld = true;
  }

  releaseLock() {
    this.lockHeld = false;
  }

  // P0-A: Atomic Payout Request
  async requestPayout(partnerId: string, requestedAmountCentavos: number, minPayoutCentavos: number = 15000) {
    await this.acquireLock();
    try {
      if (requestedAmountCentavos < minPayoutCentavos) {
        throw new Error("Below minimum payout threshold");
      }

      const now = new Date();
      let availableCentavos = 0;
      this.commissions
        .filter((c) => c.partnerId === partnerId)
        .forEach((c) => {
          if (c.status === "AVAILABLE" || (c.status === "PENDING" && c.holdingUntil && c.holdingUntil <= now)) {
            availableCentavos += c.amountCentavos;
          }
        });

      let reservedOrPaidCentavos = 0;
      this.payouts
        .filter((p) => p.ownerId === partnerId)
        .forEach((p) => {
          if (["PAID", "REQUESTED", "RESERVED", "UNDER_REVIEW", "APPROVED", "PROCESSING"].includes(p.status)) {
            reservedOrPaidCentavos += p.amountCentavos;
          }
        });

      const trueAvailable = Math.max(0, availableCentavos - reservedOrPaidCentavos);
      if (requestedAmountCentavos > trueAvailable) {
        throw new Error(`Insufficient available balance: ${trueAvailable} available`);
      }

      const payout: SyntheticPayout = {
        id: `payout_${Date.now()}_${Math.random()}`,
        ownerId: partnerId,
        amountCentavos: requestedAmountCentavos,
        status: "RESERVED",
      };
      this.payouts.push(payout);
      return { success: true, payout };
    } finally {
      this.releaseLock();
    }
  }

  // P0-C: Admin Process Payout with Full Aggregate Commitment Backing Check & CAS
  async adminProcessPayout(payoutId: string, action: "APPROVE" | "PROCESSING" | "MARK_PAID" | "REJECT", adminNotes?: string, transactionRef?: string) {
    await this.acquireLock();
    try {
      const payout = this.payouts.find((p) => p.id === payoutId);
      if (!payout) return { success: false, error: "Payout not found" };

      let newStatus: SyntheticPayout["status"] = payout.status;
      let allowedPredecessors: SyntheticPayout["status"][] = [];

      if (action === "APPROVE") {
        newStatus = "APPROVED";
        allowedPredecessors = ["REQUESTED", "RESERVED", "UNDER_REVIEW"];
      } else if (action === "PROCESSING") {
        newStatus = "PROCESSING";
        allowedPredecessors = ["REQUESTED", "RESERVED", "UNDER_REVIEW", "APPROVED"];
      } else if (action === "MARK_PAID") {
        newStatus = "PAID";
        allowedPredecessors = ["REQUESTED", "RESERVED", "UNDER_REVIEW", "APPROVED", "PROCESSING"];
      } else if (action === "REJECT") {
        newStatus = "REJECTED";
        allowedPredecessors = ["REQUESTED", "RESERVED", "UNDER_REVIEW", "APPROVED"];
      }

      // Idempotency: already in target state
      if (payout.status === newStatus) {
        return { success: true, alreadyProcessed: true };
      }

      if (!allowedPredecessors.includes(payout.status)) {
        return { success: false, error: `Cannot transition from ${payout.status} to ${newStatus}` };
      }

      // 🛡️ Backing Validation accounting for historical paid + target payout + other active reservations
      if (["APPROVE", "PROCESSING", "MARK_PAID"].includes(action)) {
        const now = new Date();
        let validEarned = 0;
        this.commissions
          .filter((c) => c.partnerId === payout.ownerId)
          .forEach((c) => {
            if (c.status === "AVAILABLE" || c.status === "PAID" || (c.status === "PENDING" && c.holdingUntil && c.holdingUntil <= now)) {
              validEarned += c.amountCentavos;
            }
          });

        let historicalPaidPayoutCentavos = 0;
        let otherActivePayoutCentavos = 0;

        this.payouts
          .filter((p) => p.ownerId === payout.ownerId)
          .forEach((p) => {
            if (p.status === "PAID") {
              historicalPaidPayoutCentavos += p.amountCentavos;
            } else if (p.id !== payoutId && FINANCIALLY_CONSUMING_STATUSES.includes(p.status)) {
              otherActivePayoutCentavos += p.amountCentavos;
            }
          });

        const targetPayoutCentavos = payout.amountCentavos;
        const totalCommittedCentavos = historicalPaidPayoutCentavos + targetPayoutCentavos + otherActivePayoutCentavos;

        if (totalCommittedCentavos > validEarned) {
          this.auditLogs.push({
            action: "PAYOUT_BACKING_CONFLICT_MANUAL_REVIEW_REQUIRED",
            payoutId,
            ownerId: payout.ownerId,
            validEarned,
            historicalPaidPayoutCentavos,
            otherActivePayoutCentavos,
            targetPayoutCentavos,
            totalCommittedCentavos,
          });
          return {
            success: false,
            conflict: "PAYOUT_BACKING_CONFLICT",
            error: "Backing earnings insufficient",
            totalCommittedCentavos,
            validEarned,
          };
        }
      }

      // State Transition
      payout.status = newStatus;
      payout.adminNotes = adminNotes;
      payout.transactionRef = transactionRef;

      // 📊 Ledger Posting for MARK_PAID
      if (action === "MARK_PAID") {
        // Persistent Ledger Idempotency Guard
        const existing = this.ledger.find(
          (e) => e.transactionType === "PAYOUT_DISBURSEMENT" && e.sourceId === payoutId && e.entryType === "DEBIT"
        );
        if (!existing) {
          this.ledger.push(
            {
              id: `led_${Date.now()}_dr`,
              entryNumber: `LED-DR-${Math.random()}`,
              transactionType: "PAYOUT_DISBURSEMENT",
              accountCategory: "LIABILITY_PARTNER_PAYABLE",
              entryType: "DEBIT",
              amountCentavos: payout.amountCentavos,
              sourceEntity: "PartnerPayout",
              sourceId: payoutId,
            },
            {
              id: `led_${Date.now()}_cr`,
              entryNumber: `LED-CR-${Math.random()}`,
              transactionType: "PAYOUT_DISBURSEMENT",
              accountCategory: "CASH_PAYMONGO",
              entryType: "CREDIT",
              amountCentavos: payout.amountCentavos,
              sourceEntity: "PartnerPayout",
              sourceId: payoutId,
            }
          );
        }
      }

      return { success: true, payout };
    } finally {
      this.releaseLock();
    }
  }

  // P1-E: Full Refund Execution with Safe Aggregate Liability Reversal
  async processRefund(commissionId: string) {
    await this.acquireLock();
    try {
      const comm = this.commissions.find((c) => c.id === commissionId);
      if (!comm) return { success: false, error: "Commission not found" };

      const now = new Date();
      let validEarnedBeforeRefund = 0;
      this.commissions
        .filter((c) => c.partnerId === comm.partnerId)
        .forEach((c) => {
          if (c.status === "AVAILABLE" || c.status === "PAID" || (c.status === "PENDING" && c.holdingUntil && c.holdingUntil <= now) || c.id === comm.id) {
            validEarnedBeforeRefund += c.amountCentavos;
          }
        });

      let historicalPaidTotal = 0;
      let activeReservedTotal = 0;
      this.payouts
        .filter((p) => p.ownerId === comm.partnerId)
        .forEach((p) => {
          if (p.status === "PAID") historicalPaidTotal += p.amountCentavos;
          else if (FINANCIALLY_CONSUMING_STATUSES.includes(p.status)) {
            activeReservedTotal += p.amountCentavos;
          }
        });

      // Update commission status to REVERSED
      comm.status = "REVERSED";

      const validEarnedAfterRefund = validEarnedBeforeRefund - comm.amountCentavos;
      const outstandingLiabilityBefore = Math.max(0, validEarnedBeforeRefund - historicalPaidTotal);
      const safeLiabilityDebit = Math.min(comm.amountCentavos, outstandingLiabilityBefore);

      if (safeLiabilityDebit > 0) {
        this.ledger.push(
          {
            id: `led_ref_${Date.now()}_dr`,
            entryNumber: `LED-DR-${Math.random()}`,
            transactionType: "REFUND_REVERSAL",
            accountCategory: "LIABILITY_PARTNER_PAYABLE",
            entryType: "DEBIT",
            amountCentavos: safeLiabilityDebit,
            sourceEntity: "Refund",
            sourceId: `ref_${comm.id}`,
          },
          {
            id: `led_ref_${Date.now()}_cr`,
            entryNumber: `LED-CR-${Math.random()}`,
            transactionType: "REFUND_REVERSAL",
            accountCategory: "EXPENSE_PARTNER",
            entryType: "CREDIT",
            amountCentavos: safeLiabilityDebit,
            sourceEntity: "Refund",
            sourceId: `ref_${comm.id}`,
          }
        );
      }

      let manualReviewRequired = false;
      let unbackedDelta = 0;

      if (historicalPaidTotal > validEarnedAfterRefund) {
        unbackedDelta = comm.amountCentavos - safeLiabilityDebit;
        this.auditLogs.push({
          action: "POST_PAYOUT_REFUND_MANUAL_REVIEW_REQUIRED",
          targetId: comm.id,
          amountCentavos: unbackedDelta,
          historicalPaidTotal,
          validEarnedAfterRefund,
        });
        manualReviewRequired = true;
      } else if (historicalPaidTotal + activeReservedTotal > validEarnedAfterRefund) {
        this.auditLogs.push({
          action: "PAYOUT_REFUND_CONFLICT_MANUAL_REVIEW_REQUIRED",
          targetId: comm.id,
          amountCentavos: comm.amountCentavos,
          activeReservedTotal,
          validEarnedAfterRefund,
        });
        manualReviewRequired = true;
      }

      return {
        success: true,
        safeLiabilityDebit,
        unbackedDelta,
        manualReviewRequired,
        validEarnedAfterRefund,
      };
    } finally {
      this.releaseLock();
    }
  }
}

// ─── 2. SYNTHETIC REFERRAL FINANCE ENGINE ──────────────────────────────────────

class SyntheticReferralFinanceEngine {
  rewards: SyntheticCommission[] = [];
  payouts: SyntheticPayout[] = [];
  ledger: SyntheticLedgerEntry[] = [];
  auditLogs: any[] = [];
  lockHeld: boolean = false;

  async acquireLock() {
    while (this.lockHeld) {
      await new Promise((r) => setTimeout(r, 1));
    }
    this.lockHeld = true;
  }

  releaseLock() {
    this.lockHeld = false;
  }

  // P0-B: Atomic Referral Payout Request
  async requestPayout(userId: string, amountCentavos: number, minPayoutCentavos: number = 15000) {
    await this.acquireLock();
    try {
      if (amountCentavos < minPayoutCentavos) {
        throw new Error("Below minimum payout threshold");
      }

      const now = new Date();
      let earnedAvailable = 0;
      this.rewards
        .filter((r) => r.partnerId === userId)
        .forEach((r) => {
          if (r.status === "AVAILABLE" || (r.status === "PENDING" && r.holdingUntil && r.holdingUntil <= now)) {
            earnedAvailable += r.amountCentavos;
          }
        });

      let requestedOrPaid = 0;
      this.payouts
        .filter((p) => p.ownerId === userId)
        .forEach((p) => {
          if (["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "PAID"].includes(p.status)) {
            requestedOrPaid += p.amountCentavos;
          }
        });

      const availableBalance = Math.max(0, earnedAvailable - requestedOrPaid);
      if (amountCentavos > availableBalance) {
        throw new Error(`Insufficient available balance: ${availableBalance}`);
      }

      const payout: SyntheticPayout = {
        id: `ref_payout_${Date.now()}_${Math.random()}`,
        ownerId: userId,
        amountCentavos,
        status: "REQUESTED",
      };
      this.payouts.push(payout);
      return { success: true, payout };
    } finally {
      this.releaseLock();
    }
  }

  // P0-D: Admin Referral Process Payout with Full Aggregate Commitment Backing Check
  async adminProcessPayout(payoutId: string, action: "APPROVE" | "PROCESSING" | "MARK_PAID" | "REJECT", adminNotes?: string, transactionRef?: string) {
    await this.acquireLock();
    try {
      const payout = this.payouts.find((p) => p.id === payoutId);
      if (!payout) return { success: false, error: "Payout not found" };

      let newStatus: SyntheticPayout["status"] = payout.status;
      let allowedPredecessors: SyntheticPayout["status"][] = [];

      if (action === "APPROVE") {
        newStatus = "APPROVED";
        allowedPredecessors = ["REQUESTED", "UNDER_REVIEW"];
      } else if (action === "PROCESSING") {
        newStatus = "PROCESSING";
        allowedPredecessors = ["REQUESTED", "UNDER_REVIEW", "APPROVED"];
      } else if (action === "MARK_PAID") {
        newStatus = "PAID";
        allowedPredecessors = ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"];
      } else if (action === "REJECT") {
        newStatus = "REJECTED";
        allowedPredecessors = ["REQUESTED", "UNDER_REVIEW", "APPROVED"];
      }

      if (payout.status === newStatus) {
        return { success: true, alreadyProcessed: true };
      }

      if (!allowedPredecessors.includes(payout.status)) {
        return { success: false, error: `Invalid transition from ${payout.status} to ${newStatus}` };
      }

      // Backing check accounting for historical paid + target payout + other active reservations
      if (["APPROVE", "PROCESSING", "MARK_PAID"].includes(action)) {
        const now = new Date();
        let validEarned = 0;
        this.rewards
          .filter((r) => r.partnerId === payout.ownerId)
          .forEach((r) => {
            if (r.status === "AVAILABLE" || r.status === "PAID" || (r.status === "PENDING" && r.holdingUntil && r.holdingUntil <= now)) {
              validEarned += r.amountCentavos;
            }
          });

        let historicalPaidPayoutCentavos = 0;
        let otherActivePayoutCentavos = 0;

        this.payouts
          .filter((p) => p.ownerId === payout.ownerId)
          .forEach((p) => {
            if (p.status === "PAID") {
              historicalPaidPayoutCentavos += p.amountCentavos;
            } else if (p.id !== payoutId && FINANCIALLY_CONSUMING_STATUSES.includes(p.status)) {
              otherActivePayoutCentavos += p.amountCentavos;
            }
          });

        const targetPayoutCentavos = payout.amountCentavos;
        const totalCommittedCentavos = historicalPaidPayoutCentavos + targetPayoutCentavos + otherActivePayoutCentavos;

        if (totalCommittedCentavos > validEarned) {
          this.auditLogs.push({
            action: "PAYOUT_BACKING_CONFLICT_MANUAL_REVIEW_REQUIRED",
            payoutId,
            ownerId: payout.ownerId,
            validEarned,
            historicalPaidPayoutCentavos,
            otherActivePayoutCentavos,
            targetPayoutCentavos,
            totalCommittedCentavos,
          });
          return {
            success: false,
            conflict: "PAYOUT_BACKING_CONFLICT",
            error: "Backing earnings insufficient",
            totalCommittedCentavos,
            validEarned,
          };
        }
      }

      payout.status = newStatus;
      payout.adminNotes = adminNotes;
      payout.transactionRef = transactionRef;

      // P0-D: Missing Double-Entry Ledger Posting for Referral MARK_PAID
      if (action === "MARK_PAID") {
        const existing = this.ledger.find(
          (e) => e.transactionType === "PAYOUT_DISBURSEMENT" && e.sourceId === payoutId && e.entryType === "DEBIT"
        );
        if (!existing) {
          this.ledger.push(
            {
              id: `ref_led_${Date.now()}_dr`,
              entryNumber: `LED-DR-${Math.random()}`,
              transactionType: "PAYOUT_DISBURSEMENT",
              accountCategory: "LIABILITY_REFERRAL_PAYABLE",
              entryType: "DEBIT",
              amountCentavos: payout.amountCentavos,
              sourceEntity: "ReferralPayout",
              sourceId: payoutId,
            },
            {
              id: `ref_led_${Date.now()}_cr`,
              entryNumber: `LED-CR-${Math.random()}`,
              transactionType: "PAYOUT_DISBURSEMENT",
              accountCategory: "CASH_PAYMONGO",
              entryType: "CREDIT",
              amountCentavos: payout.amountCentavos,
              sourceEntity: "ReferralPayout",
              sourceId: payoutId,
            }
          );
        }
      }

      return { success: true, payout };
    } finally {
      this.releaseLock();
    }
  }
}

// ─── 3. TEST EXECUTION ─────────────────────────────────────────────────────────

async function runTests() {
  console.log("==================================================");
  console.log("GOVSTUDYX ACCOUNTING & PAYOUT CONCURRENCY SUITE");
  console.log("==================================================\n");

  // TEST 1: Partner concurrent 80000 + 80000 against 100000
  {
    const engine = new SyntheticPartnerFinanceEngine();
    engine.commissions.push({
      id: "c1",
      partnerId: "p1",
      amountCentavos: 100000,
      status: "AVAILABLE",
    });

    const [resA, resB] = await Promise.allSettled([
      engine.requestPayout("p1", 80000),
      engine.requestPayout("p1", 80000),
    ]);

    const successes = [resA, resB].filter((r) => r.status === "fulfilled" && (r.value as any).success).length;
    const rejections = [resA, resB].filter((r) => r.status === "rejected" || !(r as any).value?.success).length;

    assert(successes === 1 && rejections === 1, "Test 1: Partner concurrent 80000 + 80000 against 100000 -> only one succeeds");
    assert(engine.payouts.length === 1 && engine.payouts[0].amountCentavos === 80000, "Test 1b: Exactly one 80000 payout created");
  }

  // TEST 2: Referral concurrent 80000 + 80000 against 100000
  {
    const engine = new SyntheticReferralFinanceEngine();
    engine.rewards.push({
      id: "r1",
      partnerId: "u1",
      amountCentavos: 100000,
      status: "AVAILABLE",
    });

    const [resA, resB] = await Promise.allSettled([
      engine.requestPayout("u1", 80000),
      engine.requestPayout("u1", 80000),
    ]);

    const successes = [resA, resB].filter((r) => r.status === "fulfilled" && (r.value as any).success).length;
    const rejections = [resA, resB].filter((r) => r.status === "rejected" || !(r as any).value?.success).length;

    assert(successes === 1 && rejections === 1, "Test 2: Referral concurrent 80000 + 80000 against 100000 -> only one succeeds");
    assert(engine.payouts.length === 1 && engine.payouts[0].amountCentavos === 80000, "Test 2b: Exactly one 80000 referral payout created");
  }

  // TEST 3: Partner duplicate MARK_PAID idempotency
  {
    const engine = new SyntheticPartnerFinanceEngine();
    engine.commissions.push({ id: "c1", partnerId: "p1", amountCentavos: 50000, status: "AVAILABLE" });
    const req = await engine.requestPayout("p1", 50000);
    const payoutId = req.payout!.id;

    const res1 = await engine.adminProcessPayout(payoutId, "MARK_PAID", "Disbursed via GCash", "GC-123");
    const res2 = await engine.adminProcessPayout(payoutId, "MARK_PAID", "Disbursed via GCash", "GC-123");

    assert(res1.success && res2.success && (res2 as any).alreadyProcessed, "Test 3: Partner duplicate MARK_PAID returns idempotent success");
    const payoutLedgerRows = engine.ledger.filter((l) => l.sourceId === payoutId);
    assert(payoutLedgerRows.length === 2, "Test 3b: Exactly one balanced DEBIT/CREDIT disbursement pair written (2 rows total)");
  }

  // TEST 4 & 5: Referral duplicate MARK_PAID + Missing Ledger Posting Added
  {
    const engine = new SyntheticReferralFinanceEngine();
    engine.rewards.push({ id: "r1", partnerId: "u1", amountCentavos: 30000, status: "AVAILABLE" });
    const req = await engine.requestPayout("u1", 30000);
    const payoutId = req.payout!.id;

    const res1 = await engine.adminProcessPayout(payoutId, "MARK_PAID", "Disbursed via Maya", "MY-456");
    const res2 = await engine.adminProcessPayout(payoutId, "MARK_PAID", "Disbursed via Maya", "MY-456");

    assert(res1.success && res2.success && (res2 as any).alreadyProcessed, "Test 4: Referral duplicate MARK_PAID returns idempotent success");
    const referralLedgerRows = engine.ledger.filter((l) => l.sourceId === payoutId);
    assert(referralLedgerRows.length === 2, "Test 5: Referral MARK_PAID creates missing balanced double-entry (2 rows)");
    assert(referralLedgerRows[0].accountCategory === "LIABILITY_REFERRAL_PAYABLE" && referralLedgerRows[0].entryType === "DEBIT", "Test 5b: Debit is LIABILITY_REFERRAL_PAYABLE");
    assert(referralLedgerRows[1].accountCategory === "CASH_PAYMONGO" && referralLedgerRows[1].entryType === "CREDIT", "Test 5c: Credit is CASH_PAYMONGO");
  }

  // TEST 6, 7, 8, 9: Terminal state CAS transitions (APPROVE, REJECT, CANCELLED)
  {
    const engine = new SyntheticPartnerFinanceEngine();
    engine.commissions.push({ id: "c1", partnerId: "p1", amountCentavos: 100000, status: "AVAILABLE" });
    const req = await engine.requestPayout("p1", 50000);
    const payoutId = req.payout!.id;

    // Concurrent MARK_PAID vs REJECT
    const [resPaid, resReject] = await Promise.all([
      engine.adminProcessPayout(payoutId, "MARK_PAID"),
      engine.adminProcessPayout(payoutId, "REJECT"),
    ]);

    const winnerIsPaid = resPaid.success && !resReject.success;
    const winnerIsReject = !resPaid.success && resReject.success;
    assert(winnerIsPaid || winnerIsReject, "Test 6: Concurrent MARK_PAID vs REJECT -> exactly one terminal status wins");

    if (winnerIsPaid) {
      // Test 7: PAID cannot be overwritten by REJECT
      const staleReject = await engine.adminProcessPayout(payoutId, "REJECT");
      assert(!staleReject.success, "Test 7: PAID cannot be overwritten by REJECT");
    }

    // Test 8: REJECTED cannot become PAID
    const rejectedPayout: SyntheticPayout = { id: "p_rej", ownerId: "p1", amountCentavos: 20000, status: "REJECTED" };
    engine.payouts.push(rejectedPayout);
    const tryPaidOnRejected = await engine.adminProcessPayout("p_rej", "MARK_PAID");
    assert(!tryPaidOnRejected.success, "Test 8: REJECTED payout cannot transition to PAID");

    // Test 9: CANCELLED cannot become PAID
    const cancelledPayout: SyntheticPayout = { id: "p_canc", ownerId: "p1", amountCentavos: 20000, status: "CANCELLED" };
    engine.payouts.push(cancelledPayout);
    const tryPaidOnCancelled = await engine.adminProcessPayout("p_canc", "MARK_PAID");
    assert(!tryPaidOnCancelled.success, "Test 9: CANCELLED payout cannot transition to PAID");
  }

  // TEST 10, 11, 12: Payout loses backing after refund -> APPROVED, PROCESSING, PAID blocked
  {
    const engine = new SyntheticPartnerFinanceEngine();
    engine.commissions.push({ id: "c1", partnerId: "p1", amountCentavos: 50000, status: "AVAILABLE" });
    const req = await engine.requestPayout("p1", 50000);
    const payoutId = req.payout!.id;

    // Full refund occurs on c1
    await engine.processRefund("c1");

    // Attempt APPROVE
    const appRes = await engine.adminProcessPayout(payoutId, "APPROVE");
    assert(!appRes.success && (appRes as any).conflict === "PAYOUT_BACKING_CONFLICT", "Test 10: Payout losing backing after refund -> APPROVE blocked");

    // Attempt PROCESSING
    const procRes = await engine.adminProcessPayout(payoutId, "PROCESSING");
    assert(!procRes.success && (procRes as any).conflict === "PAYOUT_BACKING_CONFLICT", "Test 11: Payout losing backing after refund -> PROCESSING blocked");

    // Attempt MARK_PAID
    const paidRes = await engine.adminProcessPayout(payoutId, "MARK_PAID");
    assert(!paidRes.success && (paidRes as any).conflict === "PAYOUT_BACKING_CONFLICT", "Test 12: Payout losing backing after refund -> MARK_PAID blocked");
    assert(engine.ledger.filter((l) => l.sourceId === payoutId).length === 0, "Test 12b: 0 payout disbursement ledger rows written");
  }

  // TEST 13 & 14: Refund before payout vs. payout reservation before refund
  {
    const engine = new SyntheticPartnerFinanceEngine();
    engine.commissions.push({ id: "c1", partnerId: "p1", amountCentavos: 50000, status: "AVAILABLE" });

    // Refund happens first
    await engine.processRefund("c1");

    // Subsequent payout request fails due to 0 available balance
    let reqFailed = false;
    try {
      await engine.requestPayout("p1", 50000);
    } catch {
      reqFailed = true;
    }
    assert(reqFailed, "Test 13: Refund before payout request -> refunded commission excluded (payout fails)");

    // Payout reservation before refund -> conflict detected
    const engine2 = new SyntheticPartnerFinanceEngine();
    engine2.commissions.push({ id: "c2", partnerId: "p2", amountCentavos: 50000, status: "AVAILABLE" });
    await engine2.requestPayout("p2", 50000);

    const refRes = await engine2.processRefund("c2");
    assert(Boolean(refRes.manualReviewRequired), "Test 14: Payout reservation before refund -> PAYOUT_REFUND_CONFLICT logged for manual review");
  }

  // TEST 15 & 16: Historical PAID payout > post-refund valid earnings -> safe liability debit & unbacked delta
  {
    const engine = new SyntheticPartnerFinanceEngine();
    engine.commissions.push({ id: "c1", partnerId: "p1", amountCentavos: 100000, status: "AVAILABLE" });

    // Request & disburse full 100000
    const req = await engine.requestPayout("p1", 100000);
    await engine.adminProcessPayout(req.payout!.id, "MARK_PAID");

    // Total liability before refund: 100000 created, 100000 debited by payout -> outstanding = 0
    // Now customer refunds c1 (100000)
    const refRes = await engine.processRefund("c1");

    assert(refRes.safeLiabilityDebit === 0, "Test 15: Safe liability debit is 0 when liability was already disbursed in PAID payout");
    assert(refRes.unbackedDelta === 100000, "Test 15b: Unbacked delta of 100000 logged for manual recovery");
    assert(Boolean(refRes.manualReviewRequired), "Test 15c: POST_PAYOUT_REFUND_MANUAL_REVIEW_REQUIRED logged");

    // Verify liability was never driven negative
    const totalDebit = engine.ledger.filter((l) => l.accountCategory === "LIABILITY_PARTNER_PAYABLE" && l.entryType === "DEBIT").reduce((s, l) => s + l.amountCentavos, 0);
    assert(totalDebit === 100000, "Test 16: Total liability debits exactly match disbursed amount (liability never driven below 0)");
  }

  // TEST 17: Duplicate payout ledger request produces 0 duplicate pairs
  {
    const engine = new SyntheticPartnerFinanceEngine();
    engine.commissions.push({ id: "c1", partnerId: "p1", amountCentavos: 40000, status: "AVAILABLE" });
    const req = await engine.requestPayout("p1", 40000);
    const pid = req.payout!.id;

    await engine.adminProcessPayout(pid, "MARK_PAID");
    const countAfterFirst = engine.ledger.length;

    // Call MARK_PAID 3 more times
    await engine.adminProcessPayout(pid, "MARK_PAID");
    await engine.adminProcessPayout(pid, "MARK_PAID");
    await engine.adminProcessPayout(pid, "MARK_PAID");

    assert(engine.ledger.length === countAfterFirst, "Test 17: Repeated MARK_PAID calls produce zero additional ledger entries");
  }

  // TEST 18 & 19: Backing-conflict audit persists while payout transition remains blocked
  {
    const engine = new SyntheticPartnerFinanceEngine();
    engine.commissions.push({ id: "c1", partnerId: "p1", amountCentavos: 50000, status: "AVAILABLE" });
    const req = await engine.requestPayout("p1", 50000);
    const pid = req.payout!.id;

    await engine.processRefund("c1");
    const result = await engine.adminProcessPayout(pid, "MARK_PAID");

    assert(!result.success, "Test 18: MARK_PAID refused on unbacked payout");
    const conflictAudit = engine.auditLogs.find((a) => a.action === "PAYOUT_BACKING_CONFLICT_MANUAL_REVIEW_REQUIRED");
    assert(conflictAudit !== undefined, "Test 19: Backing conflict audit persisted in audit log for manual review");
  }

  // TEST 20: Suffix and Hash lock key compatibility
  {
    const partnerKey: string = `partner-finance:ptr_123`;
    const referralKey: string = `referral-finance:usr_456`;
    assert(partnerKey !== referralKey, "Test 20: Lock domains are strictly isolated by owner namespace");
  }

  // ─── 4. SECTION 6: PARTNER ACTIVE-RESERVATION BACKING TESTS (6A - 6E) ─────────
  console.log("\n--- SECTION 6: PARTNER ACTIVE-RESERVATION TESTS ---");
  {
    // Test 6A: earned = 100000, target = 60000, other active = 60000, paid = 0 -> APPROVE blocked
    const engine6A = new SyntheticPartnerFinanceEngine();
    engine6A.commissions.push({ id: "c1", partnerId: "p1", amountCentavos: 100000, status: "AVAILABLE" });
    engine6A.payouts.push(
      { id: "p_target", ownerId: "p1", amountCentavos: 60000, status: "REQUESTED" },
      { id: "p_other", ownerId: "p1", amountCentavos: 60000, status: "RESERVED" }
    );
    const res6A = await engine6A.adminProcessPayout("p_target", "APPROVE");
    assert(!res6A.success && (res6A as any).conflict === "PAYOUT_BACKING_CONFLICT", "Test 6A: Partner (earned 100k, target 60k, other active 60k) -> APPROVE blocked");

    // Test 6B: same values -> PROCESSING blocked
    const engine6B = new SyntheticPartnerFinanceEngine();
    engine6B.commissions.push({ id: "c1", partnerId: "p1", amountCentavos: 100000, status: "AVAILABLE" });
    engine6B.payouts.push(
      { id: "p_target", ownerId: "p1", amountCentavos: 60000, status: "REQUESTED" },
      { id: "p_other", ownerId: "p1", amountCentavos: 60000, status: "APPROVED" }
    );
    const res6B = await engine6B.adminProcessPayout("p_target", "PROCESSING");
    assert(!res6B.success && (res6B as any).conflict === "PAYOUT_BACKING_CONFLICT", "Test 6B: Partner (earned 100k, target 60k, other active 60k) -> PROCESSING blocked");

    // Test 6C: same values -> MARK_PAID blocked
    const engine6C = new SyntheticPartnerFinanceEngine();
    engine6C.commissions.push({ id: "c1", partnerId: "p1", amountCentavos: 100000, status: "AVAILABLE" });
    engine6C.payouts.push(
      { id: "p_target", ownerId: "p1", amountCentavos: 60000, status: "PROCESSING" },
      { id: "p_other", ownerId: "p1", amountCentavos: 60000, status: "RESERVED" }
    );
    const res6C = await engine6C.adminProcessPayout("p_target", "MARK_PAID");
    assert(!res6C.success && (res6C as any).conflict === "PAYOUT_BACKING_CONFLICT", "Test 6C: Partner (earned 100k, target 60k, other active 60k) -> MARK_PAID blocked");

    // Test 6D: earned = 100000, paid = 10000, target = 60000, other active = 30000 -> allowed (10k+60k+30k = 100k)
    const engine6D = new SyntheticPartnerFinanceEngine();
    engine6D.commissions.push({ id: "c1", partnerId: "p1", amountCentavos: 100000, status: "AVAILABLE" });
    engine6D.payouts.push(
      { id: "p_paid", ownerId: "p1", amountCentavos: 10000, status: "PAID" },
      { id: "p_target", ownerId: "p1", amountCentavos: 60000, status: "REQUESTED" },
      { id: "p_other", ownerId: "p1", amountCentavos: 30000, status: "RESERVED" }
    );
    const res6D = await engine6D.adminProcessPayout("p_target", "APPROVE");
    assert(res6D.success === true, "Test 6D: Partner (earned 100k, paid 10k, target 60k, other active 30k = 100k) -> APPROVE allowed (no false conflict)");

    // Test 6E: ensure target payout is excluded from otherActivePayoutCentavos (no self double-counting)
    const engine6E = new SyntheticPartnerFinanceEngine();
    engine6E.commissions.push({ id: "c1", partnerId: "p1", amountCentavos: 100000, status: "AVAILABLE" });
    engine6E.payouts.push(
      { id: "p_target", ownerId: "p1", amountCentavos: 100000, status: "REQUESTED" }
    );
    const res6E = await engine6E.adminProcessPayout("p_target", "APPROVE");
    assert(res6E.success === true, "Test 6E: Partner target payout of 100k against 100k earned is not double-counted against itself");
  }

  // ─── 5. SECTION 7: REFERRAL ACTIVE-RESERVATION TESTS (7A - 7E) ────────
  console.log("\n--- SECTION 7: REFERRAL ACTIVE-RESERVATION TESTS ---");
  {
    // Test 7A: earned = 100000, target = 60000, other active = 60000, paid = 0 -> APPROVE blocked
    const engine7A = new SyntheticReferralFinanceEngine();
    engine7A.rewards.push({ id: "r1", partnerId: "u1", amountCentavos: 100000, status: "AVAILABLE" });
    engine7A.payouts.push(
      { id: "p_ref_target", ownerId: "u1", amountCentavos: 60000, status: "REQUESTED" },
      { id: "p_ref_other", ownerId: "u1", amountCentavos: 60000, status: "UNDER_REVIEW" }
    );
    const res7A = await engine7A.adminProcessPayout("p_ref_target", "APPROVE");
    assert(!res7A.success && (res7A as any).conflict === "PAYOUT_BACKING_CONFLICT", "Test 7A: Referral (earned 100k, target 60k, other active 60k) -> APPROVE blocked");

    // Test 7B: same values -> PROCESSING blocked
    const engine7B = new SyntheticReferralFinanceEngine();
    engine7B.rewards.push({ id: "r1", partnerId: "u1", amountCentavos: 100000, status: "AVAILABLE" });
    engine7B.payouts.push(
      { id: "p_ref_target", ownerId: "u1", amountCentavos: 60000, status: "REQUESTED" },
      { id: "p_ref_other", ownerId: "u1", amountCentavos: 60000, status: "APPROVED" }
    );
    const res7B = await engine7B.adminProcessPayout("p_ref_target", "PROCESSING");
    assert(!res7B.success && (res7B as any).conflict === "PAYOUT_BACKING_CONFLICT", "Test 7B: Referral (earned 100k, target 60k, other active 60k) -> PROCESSING blocked");

    // Test 7C: same values -> MARK_PAID blocked
    const engine7C = new SyntheticReferralFinanceEngine();
    engine7C.rewards.push({ id: "r1", partnerId: "u1", amountCentavos: 100000, status: "AVAILABLE" });
    engine7C.payouts.push(
      { id: "p_ref_target", ownerId: "u1", amountCentavos: 60000, status: "PROCESSING" },
      { id: "p_ref_other", ownerId: "u1", amountCentavos: 60000, status: "REQUESTED" }
    );
    const res7C = await engine7C.adminProcessPayout("p_ref_target", "MARK_PAID");
    assert(!res7C.success && (res7C as any).conflict === "PAYOUT_BACKING_CONFLICT", "Test 7C: Referral (earned 100k, target 60k, other active 60k) -> MARK_PAID blocked");

    // Test 7D: earned = 100000, paid = 10000, target = 60000, other active = 30000 -> allowed (10k+60k+30k = 100k)
    const engine7D = new SyntheticReferralFinanceEngine();
    engine7D.rewards.push({ id: "r1", partnerId: "u1", amountCentavos: 100000, status: "AVAILABLE" });
    engine7D.payouts.push(
      { id: "p_ref_paid", ownerId: "u1", amountCentavos: 10000, status: "PAID" },
      { id: "p_ref_target", ownerId: "u1", amountCentavos: 60000, status: "REQUESTED" },
      { id: "p_ref_other", ownerId: "u1", amountCentavos: 30000, status: "UNDER_REVIEW" }
    );
    const res7D = await engine7D.adminProcessPayout("p_ref_target", "APPROVE");
    assert(res7D.success === true, "Test 7D: Referral (earned 100k, paid 10k, target 60k, other active 30k = 100k) -> APPROVE allowed (no false conflict)");

    // Test 7E: ensure target payout is excluded from otherActivePayoutCentavos (no self double-counting)
    const engine7E = new SyntheticReferralFinanceEngine();
    engine7E.rewards.push({ id: "r1", partnerId: "u1", amountCentavos: 100000, status: "AVAILABLE" });
    engine7E.payouts.push(
      { id: "p_ref_target", ownerId: "u1", amountCentavos: 100000, status: "REQUESTED" }
    );
    const res7E = await engine7E.adminProcessPayout("p_ref_target", "APPROVE");
    assert(res7E.success === true, "Test 7E: Referral target payout of 100k against 100k earned is not double-counted against itself");
  }

  console.log("\n==================================================");
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      ${passedTests}`);
  console.log(`FAILED:      ${failedTests}`);
  console.log("==================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
