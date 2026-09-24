import { AsyncLocalStorage } from "node:async_hooks";
// Must assign globalThis.AsyncLocalStorage BEFORE any Next.js module is imported
(globalThis as any).AsyncLocalStorage = AsyncLocalStorage;

import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { signJWT } from "../lib/auth";
import { ReferralService } from "../lib/referral/referralService";

// Safe test fallbacks for environment variables
process.env.JWT_SECRET ||= "audit_test_ephemeral_jwt_secret_value_32_bytes_long";
process.env.PAYMONGO_WEBHOOK_SECRET ||= "whsec_audit_test_secret_value_32_bytes_long";

export interface RaceConditionTestResult {
  status: "PASSED" | "FAILED";
  [key: string]: any;
}

export interface RaceConditionSuiteResult {
  suite: "PHASE 1: CONCURRENCY & FINANCIAL RACE-CONDITION AUDIT";
  status: "PASSED" | "FAILED";
  timestamp: string;
  durationMs: number;
  tests: {
    doubleSpend: RaceConditionTestResult;
    voucherReplay: RaceConditionTestResult;
    webhookIdempotency: RaceConditionTestResult;
  };
}

/**
 * Executes a Next.js App Router route within an authentic RequestContext,
 * populating workAsyncStorage and workUnitAsyncStorage so cookies() and headers() work.
 */
async function withNextRequestContext<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  const { workAsyncStorage } = await import(
    "next/dist/server/app-render/work-async-storage.external"
  );
  const { workUnitAsyncStorage } = await import(
    "next/dist/server/app-render/work-unit-async-storage.external"
  );
  const { RequestCookies } = await import(
    "next/dist/server/web/spec-extension/cookies"
  );

  const cookieHeader = req.headers.get("cookie") || "";
  const reqCookies = new RequestCookies(new Headers({ cookie: cookieHeader }));
  const url = new URL(req.url);
  const workStore = { route: url.pathname };
  const workUnitStore = {
    type: "request",
    phase: "action",
    cookies: reqCookies,
    userspaceMutableCookies: reqCookies,
  };

  return workAsyncStorage.run(workStore as any, () =>
    workUnitAsyncStorage.run(workUnitStore as any, fn)
  );
}

/**
 * Helper to generate an authenticated session token and Request for a test user.
 */
async function createAuthenticatedRequest(
  user: { id: string; email: string; role: any; activeSessionId: string | null },
  url: string,
  body: any
): Promise<Request> {
  const token = await signJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
    isPaid: false,
    activeSessionId: user.activeSessionId,
    sessionId: user.activeSessionId,
  });

  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `cse_session=${token}`,
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

// =========================================================================
// TEST 1: DOUBLE-SPEND & CONCURRENT PAYOUTS
// =========================================================================
async function runDoubleSpendAudit(): Promise<RaceConditionTestResult> {
  console.log("\n--- [TEST 1.1] Double-Spend & Concurrent Payouts ---");
  const { POST: handleReferralPayout } = await import("../app/api/referral/payout/route");
  const runId = crypto.randomUUID().slice(0, 8);
  const testUserEmail = `audit_test_payout_${runId}@example.test`;
  const referredUserEmail = `audit_test_referred_${runId}@example.test`;
  const details: string[] = [];

  let testUserId: string | null = null;
  let referredUserId: string | null = null;
  let referralCodeId: string | null = null;
  let transactionId: string | null = null;
  let referralId: string | null = null;
  let rewardId: string | null = null;

  try {
    // 1. Seed inviter and referred user
    const activeSessionId = crypto.randomUUID();
    const testUser = await prisma.user.create({
      data: {
        email: testUserEmail,
        password: "audit_password_hash",
        role: "USER",
        isEmailVerified: true,
        activeSessionId,
        lastActiveAt: new Date(),
      },
    });
    testUserId = testUser.id;

    const referredUser = await prisma.user.create({
      data: {
        email: referredUserEmail,
        password: "audit_password_hash",
        role: "USER",
        isEmailVerified: true,
      },
    });
    referredUserId = referredUser.id;

    // 2. Seed referral code, transaction, referral, and reward (50,000 centavos = 500 PHP)
    const referralCode = await prisma.referralCode.create({
      data: {
        userId: testUser.id,
        code: `AUDIT${runId.toUpperCase()}`,
      },
    });
    referralCodeId = referralCode.id;

    const dummyTx = await prisma.transaction.create({
      data: {
        userId: referredUser.id,
        checkoutSessionId: `cs_audit_ref_${runId}`,
        amount: 2500,
        planType: "1_YEAR",
        status: "PAID",
      },
    });
    transactionId = dummyTx.id;

    const referral = await prisma.referral.create({
      data: {
        inviterId: testUser.id,
        referredUserId: referredUser.id,
        referralCodeId: referralCode.id,
        status: "QUALIFIED",
      },
    });
    referralId = referral.id;

    const reward = await prisma.referralReward.create({
      data: {
        referralId: referral.id,
        inviterId: testUser.id,
        referredUserId: referredUser.id,
        transactionId: dummyTx.id,
        purchaseAmountCentavos: 250000,
        effectiveRate: 20.0,
        rewardAmountCentavos: 50000, // 500 PHP
        status: "AVAILABLE",
      },
    });
    rewardId = reward.id;

    // Verify initial balance is exactly 50,000 centavos
    const initialStats = await ReferralService.getUserBalances(testUser.id);
    details.push(`Initial available balance: ${initialStats.availableBalanceCentavos} centavos (500 PHP)`);
    if (initialStats.availableBalanceCentavos !== 50000) {
      throw new Error(`Expected 50000 available balance, got ${initialStats.availableBalanceCentavos}`);
    }

    // 3. Fire 10 simultaneous payout requests of 500 PHP (50,000 centavos)
    console.log("  Firing 10 simultaneous payout requests of 500 PHP...");
    const payoutPromises = Array.from({ length: 10 }).map(async (_, idx) => {
      const req = await createAuthenticatedRequest(
        testUser,
        "http://localhost:3000/api/referral/payout",
        {
          amountCentavos: 50000,
          method: "GCASH",
          accountNumber: "09171234567",
          accountName: "Audit Test User",
        }
      );

      const res = await withNextRequestContext(req, () => handleReferralPayout(req));
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body, index: idx };
    });

    const results = await Promise.all(payoutPromises);

    let succeeded = 0;
    let failed = 0;

    results.forEach((r) => {
      if (r.status === 200 && r.body.success) {
        succeeded++;
      } else if (r.status === 400 || r.status === 409) {
        failed++;
      } else {
        details.push(`Unexpected response status ${r.status}: ${JSON.stringify(r.body)}`);
      }
    });

    // 4. Assertions
    const finalStats = await ReferralService.getUserBalances(testUser.id);
    const createdPayouts = await prisma.referralPayout.findMany({
      where: { userId: testUser.id },
    });

    const overdraftOccurred = finalStats.availableBalanceCentavos < 0;
    details.push(
      `Results: ${succeeded} succeeded (HTTP 200), ${failed} failed (HTTP 400/409). Created payouts in DB: ${createdPayouts.length}. Final balance: ${finalStats.availableBalanceCentavos} centavos.`
    );

    const isPassed =
      succeeded === 1 &&
      failed === 9 &&
      createdPayouts.length === 1 &&
      finalStats.availableBalanceCentavos === 0 &&
      !overdraftOccurred;

    if (isPassed) {
      console.log("  ✅ [PASS] Exactly 1 payout succeeded, 9 rejected. Zero overdraft.");
    } else {
      console.error(
        `  ❌ [FAIL] Expected 1 success and 9 failures. Got ${succeeded} success and ${failed} failures.`
      );
    }

    return {
      status: isPassed ? "PASSED" : "FAILED",
      initialBalanceCentavos: 50000,
      concurrentRequests: 10,
      succeededRequests: succeeded,
      failedRequests: failed,
      finalBalanceCentavos: finalStats.availableBalanceCentavos,
      overdraftOccurred,
      payoutRecordsCreated: createdPayouts.length,
      details,
    };
  } finally {
    // Teardown ephemeral records
    if (testUserId) {
      await prisma.referralAuditLog.deleteMany({ where: { actorId: testUserId } }).catch(() => null);
      await prisma.financialIdempotencyKey.deleteMany({ where: { actorId: testUserId } }).catch(() => null);
      await prisma.referralPayout.deleteMany({ where: { userId: testUserId } }).catch(() => null);
      if (rewardId) await prisma.referralReward.deleteMany({ where: { id: rewardId } }).catch(() => null);
      if (referralId) await prisma.referral.deleteMany({ where: { id: referralId } }).catch(() => null);
      if (transactionId) await prisma.transaction.deleteMany({ where: { id: transactionId } }).catch(() => null);
      if (referralCodeId) await prisma.referralCode.deleteMany({ where: { id: referralCodeId } }).catch(() => null);
      await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => null);
    }
    if (referredUserId) {
      await prisma.user.deleteMany({ where: { id: referredUserId } }).catch(() => null);
    }
  }
}

// =========================================================================
// TEST 2: SINGLE-USE VOUCHER REPLAY & CONCURRENCY
// =========================================================================
async function runVoucherConcurrencyAudit(): Promise<RaceConditionTestResult> {
  console.log("\n--- [TEST 1.2] Single-Use Voucher Replay & Concurrency ---");
  const { POST: handleVoucherRedeem } = await import("../app/api/vouchers/redeem/route");
  const runId = crypto.randomUUID().slice(0, 8);
  const details: string[] = [];

  let batchId: string | null = null;
  let voucherCodeId: string | null = null;
  const userIds: string[] = [];

  try {
    // 1. Create 10 distinct test users
    const users: any[] = [];
    for (let i = 0; i < 10; i++) {
      const activeSessionId = crypto.randomUUID();
      const user = await prisma.user.create({
        data: {
          email: `audit_test_voucher_${runId}_${i}@example.test`,
          password: "audit_password_hash",
          role: "USER",
          isEmailVerified: true,
          activeSessionId,
          lastActiveAt: new Date(),
        },
      });
      users.push(user);
      userIds.push(user.id);
    }

    // 2. Seed single-use voucher batch and code
    const voucherBatch = await prisma.institutionalVoucherBatch.create({
      data: {
        batchRef: `AUDIT-BATCH-${runId.toUpperCase()}`,
        institutionName: "Audit Test Academy",
        planType: "1_MONTH",
        durationDays: 30,
        totalCodes: 1,
        redeemedCount: 0,
        status: "ACTIVE",
      },
    });
    batchId = voucherBatch.id;

    const voucherCode = `AUDIT-VOUCHER-${runId.toUpperCase()}`;
    const codeRecord = await prisma.institutionalVoucherCode.create({
      data: {
        batchId: voucherBatch.id,
        code: voucherCode,
        status: "UNUSED",
      },
    });
    voucherCodeId = codeRecord.id;

    details.push(`Seeded voucher code: ${voucherCode} (maxUses: 1, batch totalCodes: 1)`);

    // 3. Fire 10 simultaneous redemption requests with 10 distinct user sessions
    console.log("  Firing 10 simultaneous redemption requests with 10 distinct user sessions...");
    const redemptionPromises = users.map(async (u, idx) => {
      const req = await createAuthenticatedRequest(
        u,
        "http://localhost:3000/api/vouchers/redeem",
        { code: voucherCode }
      );

      const res = await withNextRequestContext(req, () => handleVoucherRedeem(req));
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body, userId: u.id, index: idx };
    });

    const results = await Promise.all(redemptionPromises);

    let succeeded = 0;
    let failed = 0;
    let winningUserId: string | null = null;

    results.forEach((r) => {
      if (r.status === 200 && r.body.success) {
        succeeded++;
        winningUserId = r.userId;
      } else if (r.status === 400 || r.status === 409 || r.status === 410 || r.status === 422) {
        failed++;
      } else {
        details.push(`Unexpected response status ${r.status}: ${JSON.stringify(r.body)}`);
      }
    });

    // 4. Assertions on Database State
    const freshCode = await prisma.institutionalVoucherCode.findUnique({
      where: { id: codeRecord.id },
    });
    const freshBatch = await prisma.institutionalVoucherBatch.findUnique({
      where: { id: voucherBatch.id },
    });
    const updatedUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
    });
    const paidUsers = updatedUsers.filter((u) => u.isPaid);

    details.push(
      `Results: ${succeeded} succeeded (HTTP 200), ${failed} failed. Voucher status: ${freshCode?.status}, redeemedBy: ${freshCode?.redeemedBy}, batch redeemedCount: ${freshBatch?.redeemedCount}. Paid users: ${paidUsers.length}.`
    );

    const isPassed =
      succeeded === 1 &&
      failed === 9 &&
      freshCode?.status === "REDEEMED" &&
      freshCode?.redeemedBy === winningUserId &&
      freshBatch?.redeemedCount === 1 &&
      paidUsers.length === 1 &&
      paidUsers[0].id === winningUserId;

    if (isPassed) {
      console.log("  ✅ [PASS] Exactly 1 redemption succeeded, 9 rejected. usageCount is exactly 1.");
    } else {
      console.error(
        `  ❌ [FAIL] Expected 1 success and 9 failures with 1 redeemed count. Got succeeded=${succeeded}, failed=${failed}, batchRedeemed=${freshBatch?.redeemedCount}, paidUsers=${paidUsers.length}`
      );
    }

    return {
      status: isPassed ? "PASSED" : "FAILED",
      totalCodes: 1,
      concurrentClaims: 10,
      succeededClaims: succeeded,
      failedClaims: failed,
      voucherStatus: freshCode?.status || "UNKNOWN",
      redeemedCount: freshBatch?.redeemedCount || 0,
      entitledUsersCount: paidUsers.length,
      details,
    };
  } finally {
    // Teardown
    if (voucherCodeId) {
      await prisma.institutionalVoucherCode.deleteMany({ where: { id: voucherCodeId } }).catch(() => null);
    }
    if (batchId) {
      await prisma.institutionalVoucherBatch.deleteMany({ where: { id: batchId } }).catch(() => null);
    }
    if (userIds.length > 0) {
      await prisma.activityLog.deleteMany({ where: { userId: { in: userIds } } }).catch(() => null);
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => null);
    }
  }
}

// =========================================================================
// TEST 3: WEBHOOK IDEMPOTENCY & REPLAY DURABILITY
// =========================================================================
async function runWebhookIdempotencyAudit(): Promise<RaceConditionTestResult> {
  console.log("\n--- [TEST 1.3] Webhook Idempotency & Replay Durability ---");
  const { POST: handlePaymongoWebhook } = await import("../app/api/paymongo/webhook/route");
  const runId = crypto.randomUUID().slice(0, 8);
  const details: string[] = [];

  let testUserId: string | null = null;
  const checkoutSessionId = `cs_audit_webhook_${runId}`;
  const eventId = `evt_audit_webhook_${runId}`;
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET || "whsec_audit_test_secret_value_32_bytes_long";

  try {
    // 1. Seed test user
    const testUser = await prisma.user.create({
      data: {
        email: `audit_test_webhook_${runId}@example.test`,
        password: "audit_password_hash",
        role: "USER",
        isEmailVerified: true,
        isPaid: false,
      },
    });
    testUserId = testUser.id;

    // 2. Construct PayMongo checkout_session.payment.paid event payload
    const eventPayload = {
      data: {
        id: eventId,
        type: "event",
        attributes: {
          type: "checkout_session.payment.paid",
          livemode: false,
          data: {
            id: checkoutSessionId,
            type: "checkout_session",
            attributes: {
              amount: 9900, // 99.00 PHP
              currency: "PHP",
              fee: 250,
              livemode: false,
              line_items: [
                {
                  amount: 9900,
                  quantity: 1,
                  currency: "PHP",
                },
              ],
              payments: [
                {
                  attributes: {
                    status: "paid",
                    fee: 250,
                  },
                },
              ],
              metadata: {
                userId: testUser.id,
                planType: "1_MONTH",
                expectedAmountCentavos: 9900,
                expectedCurrency: "PHP",
              },
            },
          },
        },
      },
    };

    const rawBody = JSON.stringify(eventPayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const comparisonString = `${timestamp}.${rawBody}`;
    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(comparisonString)
      .digest("hex");
    const signatureHeader = `t=${timestamp},te=${signature},li=${signature}`;

    // 3. Dispatch 5 identical webhook payloads concurrently to /api/paymongo/webhook
    console.log("  Dispatching 5 identical webhook payloads concurrently to /api/paymongo/webhook...");
    const webhookPromises = Array.from({ length: 5 }).map(async (_, idx) => {
      const req = new Request("http://localhost:3000/api/paymongo/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "paymongo-signature": signatureHeader,
        },
        body: rawBody,
      });

      const res = await handlePaymongoWebhook(req);
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body, index: idx };
    });

    const results = await Promise.all(webhookPromises);

    let initialProvisionedCount = 0;
    let idempotentReplayCount = 0;

    results.forEach((r) => {
      if (r.status === 200) {
        if (r.body.received === true && r.body.alreadyFinalized === false) {
          initialProvisionedCount++;
        } else if (r.body.received === true && r.body.alreadyFinalized === true) {
          idempotentReplayCount++;
        } else {
          details.push(`Unexpected 200 body: ${JSON.stringify(r.body)}`);
        }
      } else {
        details.push(`Unexpected webhook HTTP status ${r.status}: ${JSON.stringify(r.body)}`);
      }
    });

    // 4. Assertions on Database Ledger and Transaction Integrity
    const transactions = await prisma.transaction.findMany({
      where: { checkoutSessionId },
    });

    let ledgerEntries: any[] = [];
    if (transactions.length > 0) {
      ledgerEntries = await prisma.financialLedgerEntry.findMany({
        where: { transactionId: transactions[0].id },
      });
    }

    const freshUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });

    // Verify ledger has exactly the standard non-duplicated pairs (e.g. CASH vs REVENUE, FEE vs CASH)
    // No duplicate transaction IDs or double-credit entries
    const revenueEntries = ledgerEntries.filter((e) => e.transactionType === "PAYMENT_CAPTURE");
    const duplicateLedgersDetected = revenueEntries.length > 2; // Should be exactly 1 debit and 1 credit for capture

    details.push(
      `Results: ${initialProvisionedCount} initial provisioning, ${idempotentReplayCount} idempotent replays. DB Transactions: ${transactions.length}. Ledger entries: ${ledgerEntries.length}. User isPaid: ${freshUser?.isPaid}.`
    );

    const isPassed =
      initialProvisionedCount === 1 &&
      idempotentReplayCount === 4 &&
      transactions.length === 1 &&
      !duplicateLedgersDetected &&
      freshUser?.isPaid === true;

    if (isPassed) {
      console.log("  ✅ [PASS] Exactly 1 webhook triggered provisioning; 4 returned idempotent replay without duplicate ledger entries.");
    } else {
      console.error(
        `  ❌ [FAIL] Expected 1 initial and 4 replays with 1 transaction record. Got initial=${initialProvisionedCount}, replays=${idempotentReplayCount}, txns=${transactions.length}`
      );
    }

    return {
      status: isPassed ? "PASSED" : "FAILED",
      concurrentWebhooks: 5,
      initialProvisionedCount,
      idempotentReplayCount,
      transactionsCreated: transactions.length,
      ledgerEntriesCreated: ledgerEntries.length,
      duplicateLedgersDetected,
      details,
    };
  } finally {
    // Teardown
    const txns = await prisma.transaction.findMany({
      where: { checkoutSessionId },
      select: { id: true },
    });
    for (const t of txns) {
      await prisma.financialLedgerEntry.deleteMany({ where: { transactionId: t.id } }).catch(() => null);
      await prisma.paymentFinalizationEffect.deleteMany({
        where: { finalization: { transactionId: t.id } },
      }).catch(() => null);
      await prisma.paymentFinalization.deleteMany({ where: { transactionId: t.id } }).catch(() => null);
    }
    await prisma.transaction.deleteMany({ where: { checkoutSessionId } }).catch(() => null);
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => null);
    }
  }
}

// =========================================================================
// MASTER RUNNER FOR PHASE 1
// =========================================================================
export async function runRaceConditionSuite(): Promise<RaceConditionSuiteResult> {
  const startTime = Date.now();
  console.log("\n==================================================");
  console.log("   PHASE 1: CONCURRENCY & RACE-CONDITION AUDIT    ");
  console.log("==================================================");

  const doubleSpend = await runDoubleSpendAudit();
  const voucherReplay = await runVoucherConcurrencyAudit();
  const webhookIdempotency = await runWebhookIdempotencyAudit();

  const allPassed =
    doubleSpend.status === "PASSED" &&
    voucherReplay.status === "PASSED" &&
    webhookIdempotency.status === "PASSED";

  const durationMs = Date.now() - startTime;
  console.log("\n--------------------------------------------------");
  console.log(`PHASE 1 STATUS: ${allPassed ? "PASSED ✅" : "FAILED ❌"} (${durationMs}ms)`);
  console.log("--------------------------------------------------");

  return {
    suite: "PHASE 1: CONCURRENCY & FINANCIAL RACE-CONDITION AUDIT",
    status: allPassed ? "PASSED" : "FAILED",
    timestamp: new Date().toISOString(),
    durationMs,
    tests: {
      doubleSpend,
      voucherReplay,
      webhookIdempotency,
    },
  };
}

if (process.argv[1] && process.argv[1].includes("audit-race-conditions")) {
  runRaceConditionSuite()
    .then((result) => {
      if (result.status === "FAILED") process.exit(1);
    })
    .catch((err) => {
      console.error("Fatal error running Phase 1 audit:", err);
      process.exit(1);
    });
}
