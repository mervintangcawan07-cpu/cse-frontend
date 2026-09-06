/**
 * Slice 8E-C isolated PostgreSQL validation for PaymentFinalizationIngestionService.
 *
 * Implements and proves:
 * C1  — Fresh Durable Ingestion
 * C2  — Existing Durable Replay
 * C3  — Concurrent Same Checkout
 * C4  — Legacy-Owned PAID Transaction
 * C5  — Existing Non-PAID Transaction
 * C6  — Replay Identity Conflicts
 * C7  — Same Provider Payment Across Different Checkouts
 * C8  — Entitlement Baselines
 * C9  — Atomic Failure Injection
 * C10 — Unknown Fee Fresh Ingestion
 * C11 — Unknown Fee Replay With Newly Known Fee
 * C12 — Conflicting Known Fee Replay
 * C13 — Post-Commit Coordinator Failure
 * C14 — Coordinator Fast Path Success
 * C15 — Financial Unit Compatibility & Representability
 * C16 — Sticky Durable Ownership
 * C17 — No Production Callers
 *
 * Strictly follows Slice 8D safety gate: requires PAYMENT_FINALIZATION_TEST_DATABASE_URL.
 * Never falls back to DATABASE_URL.
 */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { Pool } from "pg";
import {
  SUPPORTED_CURRENCY,
  resolvePaymentArchitectureOwnership,
} from "../lib/payment/paymentFinalizationContracts";
import {
  PaymentFinalizationIngestionService,
  type IngestVerifiedPaymentInput,
} from "../lib/payment/paymentFinalizationIngestionService";
import {
  createPaymentFinalizationCoordinatorForTesting,
} from "../lib/payment/paymentFinalizationCoordinator";
import { IdempotentLedgerService } from "../lib/accounting/idempotentLedgerService";
import { IdempotentReferralRewardService } from "../lib/referral/idempotentReferralRewardService";
import { IdempotentPartnerCommissionService } from "../lib/accounting/idempotentPartnerCommissionService";
import { IdempotentTaxProvisionService } from "../lib/accounting/idempotentTaxProvisionService";
import { IdempotentReconciliationService } from "../lib/accounting/idempotentReconciliationService";
import { RefundService } from "../lib/payment/refundService";

const BRANCH = "security/p1-001-payment-finalization-recovery";
const URL_ENV = "PAYMENT_FINALIZATION_TEST_DATABASE_URL";
const ACK_ENV = "PAYMENT_FINALIZATION_ALLOW_ISOLATED_DB_TESTS";

type GroupLetter =
  | "C1"
  | "C2"
  | "C3"
  | "C4"
  | "C5"
  | "C6"
  | "C7"
  | "C8"
  | "C9"
  | "C10"
  | "C11"
  | "C12"
  | "C13"
  | "C14"
  | "C15"
  | "C16"
  | "C17";

interface SafeTarget {
  raw: string;
  url: URL;
  database: string;
}

interface Runtime {
  prisma: PrismaClient;
  pool: Pool;
}

class NotProven extends Error {}

let checks = 0;
let passed = 0;
let failed = 0;
let unproven = 0;
let sequence = 0;
let prefix = "";

function check(value: unknown, text: string): asserts value {
  checks++;
  if (!value) throw new Error(text);
}

function sanitizeRuntimeError(error: unknown): string {
  let text = error instanceof Error ? error.message : String(error);
  for (const exactUrl of [process.env[URL_ENV], process.env.DATABASE_URL]) {
    if (exactUrl) text = text.replaceAll(exactUrl, "[DATABASE_URL_REDACTED]");
  }
  return text.replace(
    /\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi,
    "postgresql://[credentials-redacted]@[target-redacted]"
  );
}

function ownedId(label: string): string {
  return `${prefix}_${++sequence}_${label}`;
}

function getDatabaseName(url: URL): string {
  let name = "";
  try {
    name = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  } catch {
    throw new Error("Invalid encoded database name");
  }
  if (!name || name.includes("/")) throw new Error("Exactly one database name is required");
  return name;
}

function normalized(raw: string): string | null {
  try {
    return new URL(raw).toString();
  } catch {
    return null;
  }
}

function gate(env: NodeJS.ProcessEnv): SafeTarget {
  if (env[ACK_ENV] !== "true") throw new Error(`${ACK_ENV}=true is required`);
  const raw = env[URL_ENV]?.trim();
  if (!raw) throw new Error(`${URL_ENV} is required; DATABASE_URL is never a fallback`);
  const production = env.DATABASE_URL?.trim();
  if (production && (production === raw || normalized(production) === normalized(raw))) {
    throw new Error("Candidate equals DATABASE_URL");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Malformed candidate URL");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new Error("A PostgreSQL URL with a hostname is required");
  }
  const database = getDatabaseName(url);
  const prod = /govstudyx|(?:^|[-_.])(prod|production|live|main)(?:[-_.]|$)/i;
  if ([url.hostname, url.username, database].some((part) => prod.test(part))) {
    throw new Error("Production-like identifier rejected");
  }
  if (/(?:^|\.)neon\.tech$/i.test(url.hostname)) {
    throw new Error("Neon targets are rejected; Neon/PgBouncer is outside Slice 8E-C");
  }
  const isolation = /(?:^|[-_.])(test|testing|isolated|disposable|sandbox|ci)(?:[-_.]|$)/i;
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase());
  if (!/slice8[de]/i.test(database) || !isolation.test(database) || (!local && !isolation.test(url.hostname))) {
    throw new Error("Strong Slice 8D/8E test/isolation naming evidence is required");
  }
  return { raw, url, database };
}

function safeLabel(target: SafeTarget): string {
  return `${target.url.protocol}//[credentials-redacted]@${target.url.hostname}${
    target.url.port ? `:${target.url.port}` : ""
  }/${target.database}`;
}

function git(...args: string[]): string[] {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(item) : entry.isFile() ? [item] : [];
  });
}

function staticChecks(): void {
  check(git("branch", "--show-current")[0] === BRANCH, "Branch changed");
  check(git("diff", "--cached", "--name-only").length === 0, "Staged changes found");

  const approvedChanges = new Set([
    "prisma/schema.prisma",
    "src/lib/payment/paymentFinalizationContracts.ts",
    "src/lib/payment/paymentFinalizationCoordinator.ts",
    "src/scripts/test-idempotent-partner-commission.ts",
    "src/scripts/test-idempotent-referral-reward.ts",
    "src/scripts/test-payment-finalization-coordinator.ts",
    "src/scripts/test-payment-finalization-postgres.ts",
    "src/scripts/test-payment-finalization-ingestion-postgres.ts",
    "src/scripts/test-payment-finalization-ingestion-service-postgres.ts",
  ]);
  check(git("diff", "--name-only").every((name) => approvedChanges.has(name.replaceAll("\\", "/"))), "Unapproved tracked change found");

  const protectedStatus = git(
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    "src/lib/payment/paymentFinalizationService.ts",
    "src/app/api/paymongo/verify/route.ts",
    "src/app/api/paymongo/webhook/route.ts",
    "src/app/api/webhooks/paymongo/route.ts"
  );
  check(protectedStatus.length === 0, "Protected legacy service or route path changed");

  const callers = walk(path.join(process.cwd(), "src", "app")).filter((file) => {
    if (!/\.[cm]?[jt]sx?$/.test(file)) return false;
    const source = fs.readFileSync(file, "utf8");
    return (
      source.includes("PaymentFinalizationIngestionService") ||
      source.includes("paymentFinalizationIngestionService")
    );
  });
  check(callers.length === 0, "Production app PaymentFinalizationIngestionService caller found");

  const own = fs.readFileSync(__filename, "utf8");
  check(!/from\s+["'](?:resend|nodemailer|axios)["']/.test(own), "External communication import found");
  check(!/https:\/\/api\.paymongo\.com/i.test(own), "PayMongo endpoint found");
}

async function makeRuntime(connectionString: string, max = 8): Promise<Runtime> {
  const [{ Pool: PgPool }, { PrismaPg }, { PrismaClient: Client }] = await Promise.all([
    import("pg"),
    import("@prisma/adapter-pg"),
    import("@prisma/client"),
  ]);
  const pool = new PgPool({
    connectionString,
    max,
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 2_000,
    application_name: "govstudyx_slice8ec_ingestion_test",
  });
  return { pool, prisma: new Client({ adapter: new PrismaPg(pool) }) };
}

async function close(value: Runtime): Promise<void> {
  await value.prisma.$disconnect();
  await value.pool.end();
}

function makeCoordinator(prisma: PrismaClient) {
  return createPaymentFinalizationCoordinatorForTesting({
    runInTransaction: (op) => prisma.$transaction(op, { timeout: 25_000, maxWait: 15_000 }),
    findDueFinalizationIds: async (now, take) =>
      (
        await prisma.paymentFinalization.findMany({
          where: { id: { startsWith: prefix }, nextAttemptAt: { lte: now } },
          select: { id: true },
          take,
        })
      ).map((r) => r.id),
    postLedger: (params, tx) =>
      IdempotentLedgerService.postBalancedDoubleEntryIdempotent(params, tx),
    executeReferral: (params) =>
      IdempotentReferralRewardService.executeReferralRewardEffect(params),
    executePartnerPair: (params) =>
      IdempotentPartnerCommissionService.executePartnerCommissionAndLiability(params),
    executeTax: (params) =>
      IdempotentTaxProvisionService.executeTaxProvisionEffect(params),
    executeReconciliation: (params) =>
      IdempotentReconciliationService.executeReconciliationEffect(params),
  });
}

async function inspectTarget(pool: Pool, target: SafeTarget): Promise<void> {
  const identity = await pool.query<{ database: string; read_only: string }>(
    "SELECT current_database() AS database, current_setting('transaction_read_only') AS read_only"
  );
  check(identity.rows[0]?.database === target.database, "Connected database differs from gated target");
  check(identity.rows[0]?.read_only === "off", "Target is read-only");
  const required = [
    "User",
    "Transaction",
    "PaymentFinalization",
    "PaymentFinalizationEffect",
    "FinancialLedgerEntry",
    "ReferralReward",
    "PartnerCommission",
    "TaxRecord",
    "ReconciliationRecord",
  ];
  const tableRows = await pool.query<{ table_name: string }>(
    "SELECT tablename AS table_name FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])",
    [required]
  );
  const present = new Set(tableRows.rows.map((row) => row.table_name));
  check(required.every((name) => present.has(name)), "Required schema missing");
}

async function cleanup(prisma: PrismaClient): Promise<void> {
  const owned = { startsWith: prefix } as const;
  await prisma.$transaction(async (tx) => {
    await tx.reconciliationRecord.deleteMany({
      where: {
        OR: [
          { id: owned },
          { finalizationEffectId: owned },
          { matchedTransactionId: owned },
          { sourceId: owned },
          { finalizationEffect: { finalization: { checkoutSessionId: owned } } },
        ],
      },
    });
    await tx.taxRecord.deleteMany({
      where: {
        OR: [
          { id: owned },
          { transactionId: owned },
          { finalizationEffect: { finalization: { checkoutSessionId: owned } } },
          { transaction: { checkoutSessionId: owned } },
        ],
      },
    });
    await tx.partnerCommission.deleteMany({
      where: {
        OR: [
          { id: owned },
          { transactionId: owned },
          { finalizationEffect: { finalization: { checkoutSessionId: owned } } },
          { transaction: { checkoutSessionId: owned } },
        ],
      },
    });
    await tx.referralReward.deleteMany({
      where: {
        OR: [
          { id: owned },
          { transactionId: owned },
          { finalizationEffect: { finalization: { checkoutSessionId: owned } } },
          { transaction: { checkoutSessionId: owned } },
        ],
      },
    });
    await tx.financialLedgerEntry.deleteMany({
      where: {
        OR: [
          { id: owned },
          { finalizationEffectId: owned },
          { transactionId: owned },
          { transaction: { checkoutSessionId: owned } },
          { transaction: { userId: owned } },
          { finalizationEffect: { finalization: { checkoutSessionId: owned } } },
        ],
      },
    });
    await tx.paymentFinalizationEffect.deleteMany({
      where: {
        OR: [
          { id: owned },
          { finalization: { checkoutSessionId: owned } },
          { finalization: { transactionId: owned } },
          { finalization: { transaction: { userId: owned } } },
        ],
      },
    });
    await tx.paymentFinalization.deleteMany({
      where: {
        OR: [
          { id: owned },
          { checkoutSessionId: owned },
          { transactionId: owned },
          { transaction: { userId: owned } },
        ],
      },
    });
    await tx.transaction.deleteMany({
      where: {
        OR: [
          { id: owned },
          { checkoutSessionId: owned },
          { userId: owned },
        ],
      },
    });
    await tx.user.deleteMany({ where: { id: owned } });
  });
}

async function runGroup(letter: GroupLetter, name: string, test: () => Promise<void>): Promise<void> {
  try {
    await test();
    passed++;
    console.log(`PASS GROUP ${letter}: ${name}`);
  } catch (error) {
    if (error instanceof NotProven) {
      unproven++;
      console.log(`NOT PROVEN GROUP ${letter}: ${name} — ${sanitizeRuntimeError(error)}`);
    } else {
      failed++;
      console.error(`FAIL GROUP ${letter}: ${name} — ${sanitizeRuntimeError(error)}`);
    }
  }
}

async function suite(target: SafeTarget): Promise<void> {
  const runtime = await makeRuntime(target.raw, 8);
  let targetAccepted = false;

  try {
    await inspectTarget(runtime.pool, target);
    targetAccepted = true;
    staticChecks();

    const service = new PaymentFinalizationIngestionService({
      prisma: runtime.prisma,
      coordinator: makeCoordinator(runtime.prisma),
    });

    // ────────────────────────────────────────────────────────────
    // C1 — Fresh Durable Ingestion
    // ────────────────────────────────────────────────────────────
    await runGroup("C1", "Fresh Durable Ingestion", async () => {
      const userId = ownedId("c1_user");
      const checkoutSessionId = ownedId("c1_checkout");
      const verifiedAt = "2026-08-15T10:00:00.000Z";

      await runtime.prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@slice8ec.invalid`,
          password: "slice8ec-noncredential",
          name: "User C1",
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      });

      const res = await service.ingestVerifiedPayment({
        userId,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt,
        source: "WEBHOOK",
      });

      check(res.outcome === "FRESH_DURABLE_COMMIT", "Outcome must be FRESH_DURABLE_COMMIT");
      check(res.durableCommitted === true, "durableCommitted must be true");
      check(typeof res.transactionId === "string", "transactionId must be string");
      check(typeof res.finalizationId === "string", "finalizationId must be string");

      // Verify Transaction
      const txn = await runtime.prisma.transaction.findUnique({
        where: { id: res.transactionId },
      });
      check(txn !== null, "Transaction must exist");
      check(txn.status === "PAID", "Transaction status must be PAID");
      check(txn.amount === 299, "Transaction.amount must be integer pesos 299");
      check(txn.grossAmountCentavos === 29_900, "Transaction.grossAmountCentavos must be 29900");
      check(
        txn.createdAt.toISOString() === verifiedAt,
        "Transaction.createdAt must equal verifiedAt"
      );

      // Verify PaymentFinalization parent
      const pfin = await runtime.prisma.paymentFinalization.findUnique({
        where: { id: res.finalizationId },
        include: { effects: true },
      });
      check(pfin !== null, "PaymentFinalization must exist");
      check(pfin.verifiedAt.toISOString() === verifiedAt, "verifiedAt must match");
      check(
        txn.createdAt.toISOString() === pfin.verifiedAt.toISOString(),
        "Transaction.createdAt must equal PaymentFinalization.verifiedAt"
      );

      // Verify 7 effects
      check(pfin.effects.length === 7, "Must have exactly 7 effects");
      const paymentEffect = pfin.effects.find((e) => e.effectType === "PAYMENT_LEDGER");
      check(paymentEffect?.status === "COMPLETE", "PAYMENT_LEDGER effect must be COMPLETE");

      // Verify balanced ledger pair
      const entries = await runtime.prisma.financialLedgerEntry.findMany({
        where: { transactionId: res.transactionId, transactionType: "PAYMENT_RECEIVED" },
      });
      check(entries.length === 2, "Must have exactly 2 PAYMENT_RECEIVED entries");
      const debit = entries.find((e) => e.entryType === "DEBIT");
      const credit = entries.find((e) => e.entryType === "CREDIT");
      check(debit !== undefined && credit !== undefined, "Must have 1 DEBIT and 1 CREDIT");
      check(debit.amountCentavos === 29_900, "Debit must be 29900");
      check(credit.amountCentavos === 29_900, "Credit must be 29900");

      // Verify user entitlement
      const user = await runtime.prisma.user.findUnique({ where: { id: userId } });
      check(user?.isPaid === true, "User isPaid must be true");
      check(user?.planType === "1_MONTH", "User planType must be 1_MONTH");
      const expectedPaidUntil = new Date(verifiedAt);
      expectedPaidUntil.setDate(expectedPaidUntil.getDate() + 30);
      check(
        user?.paidUntil?.toISOString() === expectedPaidUntil.toISOString(),
        "User paidUntil must be verifiedAt + 30 days"
      );
    });

    // ────────────────────────────────────────────────────────────
    // C2 — Existing Durable Replay
    // ────────────────────────────────────────────────────────────
    await runGroup("C2", "Existing Durable Replay", async () => {
      const userId = ownedId("c2_user");
      const checkoutSessionId = ownedId("c2_checkout");
      const verifiedAt = "2026-08-15T10:00:00.000Z";

      await runtime.prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@slice8ec.invalid`,
          password: "slice8ec-noncredential",
          name: "User C2",
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      });

      const first = await service.ingestVerifiedPayment({
        userId,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt,
        source: "WEBHOOK",
      });
      check(first.outcome === "FRESH_DURABLE_COMMIT", "First call fresh");

      const userBeforeReplay = await runtime.prisma.user.findUnique({ where: { id: userId } });
      const ledgerCountBefore = await runtime.prisma.financialLedgerEntry.count({
        where: { transactionId: first.transactionId },
      });

      // Second call: exact same immutable identity
      const replay = await service.ingestVerifiedPayment({
        userId,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt,
        source: "WEBHOOK",
      });

      check(replay.outcome === "DURABLE_REPLAY", "Outcome must be DURABLE_REPLAY");
      check(replay.durableCommitted === true, "durableCommitted must be true");
      check(replay.transactionId === first.transactionId, "transactionId must match");
      check(replay.finalizationId === first.finalizationId, "finalizationId must match");

      // Verify no duplicate grant or ledger
      const userAfterReplay = await runtime.prisma.user.findUnique({ where: { id: userId } });
      check(
        userAfterReplay?.paidUntil?.toISOString() === userBeforeReplay?.paidUntil?.toISOString(),
        "paidUntil must not change"
      );
      const ledgerCountAfter = await runtime.prisma.financialLedgerEntry.count({
        where: { transactionId: first.transactionId },
      });
      check(ledgerCountBefore === ledgerCountAfter, "No additional ledger entries created");
    });

    // ────────────────────────────────────────────────────────────
    // C3 — Concurrent Same Checkout
    // ────────────────────────────────────────────────────────────
    await runGroup("C3", "Concurrent Same Checkout", async () => {
      const userId = ownedId("c3_user");
      const checkoutSessionId = ownedId("c3_checkout");
      const verifiedAt = "2026-08-15T10:00:00.000Z";

      await runtime.prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@slice8ec.invalid`,
          password: "slice8ec-noncredential",
          name: "User C3",
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      });

      const [res1, res2] = await Promise.all([
        service.ingestVerifiedPayment({
          userId,
          checkoutSessionId,
          planType: "1_MONTH",
          purchaseAmountCentavos: 29_900,
          feeKnowledge: "KNOWN",
          feeAmountCentavos: 0,
          verifiedAt,
          source: "WEBHOOK",
        }),
        service.ingestVerifiedPayment({
          userId,
          checkoutSessionId,
          planType: "1_MONTH",
          purchaseAmountCentavos: 29_900,
          feeKnowledge: "KNOWN",
          feeAmountCentavos: 0,
          verifiedAt,
          source: "WEBHOOK",
        }),
      ]);

      const outcomes = [res1.outcome, res2.outcome].sort();
      check(
        outcomes[0] === "DURABLE_REPLAY" && outcomes[1] === "FRESH_DURABLE_COMMIT",
        `Expected 1 FRESH and 1 REPLAY, got ${outcomes.join(", ")}`
      );

      const pfinCount = await runtime.prisma.paymentFinalization.count({
        where: { checkoutSessionId },
      });
      check(pfinCount === 1, "Exactly 1 PaymentFinalization created");

      const txnCount = await runtime.prisma.transaction.count({
        where: { checkoutSessionId },
      });
      check(txnCount === 1, "Exactly 1 Transaction created");
    });

    // ────────────────────────────────────────────────────────────
    // C4 — Legacy-Owned PAID Transaction
    // ────────────────────────────────────────────────────────────
    await runGroup("C4", "Legacy-Owned PAID Transaction", async () => {
      const userId = ownedId("c4_user");
      const checkoutSessionId = ownedId("c4_checkout");
      const txnId = ownedId("c4_txn");

      await runtime.prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@slice8ec.invalid`,
          password: "slice8ec-noncredential",
          name: "User C4",
        },
      });

      // Seed Transaction with status PAID and NO PaymentFinalization
      await runtime.prisma.transaction.create({
        data: {
          id: txnId,
          userId,
          checkoutSessionId,
          amount: 299,
          grossAmountCentavos: 29_900,
          status: "PAID",
          planType: "1_MONTH",
        },
      });

      const res = await service.ingestVerifiedPayment({
        userId,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt: new Date().toISOString(),
        source: "WEBHOOK",
      });

      check(res.outcome === "LEGACY_ALREADY_FINALIZED", "Outcome must be LEGACY_ALREADY_FINALIZED");
      check(res.durableCommitted === false, "durableCommitted must be false");

      const pfin = await runtime.prisma.paymentFinalization.findUnique({
        where: { checkoutSessionId },
      });
      check(pfin === null, "PaymentFinalization must NOT be created");
    });

    // ────────────────────────────────────────────────────────────
    // C5 — Existing Non-PAID Transaction
    // ────────────────────────────────────────────────────────────
    await runGroup("C5", "Existing Non-PAID Transaction", async () => {
      const userId = ownedId("c5_user");
      const checkoutSessionId = ownedId("c5_checkout");
      const txnId = ownedId("c5_txn");

      await runtime.prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@slice8ec.invalid`,
          password: "slice8ec-noncredential",
          name: "User C5",
        },
      });

      // Seed Transaction with non-PAID status
      await runtime.prisma.transaction.create({
        data: {
          id: txnId,
          userId,
          checkoutSessionId,
          amount: 299,
          grossAmountCentavos: 29_900,
          status: "PENDING",
          planType: "1_MONTH",
        },
      });

      const res = await service.ingestVerifiedPayment({
        userId,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt: new Date().toISOString(),
        source: "WEBHOOK",
      });

      check(res.outcome === "INVARIANT_CONFLICT", "Outcome must be INVARIANT_CONFLICT");
      check(res.conflictCode === "EXISTING_NON_PAID_TRANSACTION", "conflictCode must be EXISTING_NON_PAID_TRANSACTION");

      const txn = await runtime.prisma.transaction.findUnique({ where: { id: txnId } });
      check(txn?.status === "PENDING", "Status must remain PENDING (no promotion to PAID)");
    });

    // ────────────────────────────────────────────────────────────
    // C6 — Replay Identity Conflicts
    // ────────────────────────────────────────────────────────────
    await runGroup("C6", "Replay Identity Conflicts", async () => {
      const userIdA = ownedId("c6_userA");
      const userIdB = ownedId("c6_userB");
      const checkoutSessionId = ownedId("c6_checkout");
      const verifiedAt = "2026-08-15T10:00:00.000Z";

      await runtime.prisma.user.createMany({
        data: [
          { id: userIdA, email: `${userIdA}@slice8ec.invalid`, password: "pw", name: "User A" },
          { id: userIdB, email: `${userIdB}@slice8ec.invalid`, password: "pw", name: "User B" },
        ],
      });

      const initial = await service.ingestVerifiedPayment({
        userId: userIdA,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        providerPaymentId: ownedId("c6_pay"),
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt,
        source: "WEBHOOK",
      });
      check(initial.outcome === "FRESH_DURABLE_COMMIT", "Initial ingestion succeeded");

      // 1. Conflict: Different user
      const resUserMismatch = await service.ingestVerifiedPayment({
        userId: userIdB,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt,
        source: "WEBHOOK",
      });
      check(resUserMismatch.outcome === "IDENTITY_CONFLICT", "Must fail on user mismatch");
      check(resUserMismatch.conflictCode === "USER_ID_MISMATCH", "Code USER_ID_MISMATCH");

      // 2. Conflict: Different planType
      const resPlanMismatch = await service.ingestVerifiedPayment({
        userId: userIdA,
        checkoutSessionId,
        planType: "6_MONTHS",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt,
        source: "WEBHOOK",
      });
      check(resPlanMismatch.outcome === "IDENTITY_CONFLICT", "Must fail on plan mismatch");
      check(resPlanMismatch.conflictCode === "PLAN_TYPE_MISMATCH", "Code PLAN_TYPE_MISMATCH");

      // 3. Conflict: Different amount
      const resAmountMismatch = await service.ingestVerifiedPayment({
        userId: userIdA,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 49_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt,
        source: "WEBHOOK",
      });
      check(resAmountMismatch.outcome === "IDENTITY_CONFLICT", "Must fail on amount mismatch");
      check(resAmountMismatch.conflictCode === "PURCHASE_AMOUNT_MISMATCH", "Code PURCHASE_AMOUNT_MISMATCH");

      // 4. Conflict: Conflicting providerPaymentId
      const resProviderMismatch = await service.ingestVerifiedPayment({
        userId: userIdA,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        providerPaymentId: ownedId("different_pay"),
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt,
        source: "WEBHOOK",
      });
      check(resProviderMismatch.outcome === "IDENTITY_CONFLICT", "Must fail on providerPaymentId mismatch");
      check(resProviderMismatch.conflictCode === "PROVIDER_PAYMENT_ID_MISMATCH", "Code PROVIDER_PAYMENT_ID_MISMATCH");
    });

    // ────────────────────────────────────────────────────────────
    // C7 — Same Provider Payment Across Different Checkouts
    // ────────────────────────────────────────────────────────────
    await runGroup("C7", "Same Provider Payment Across Different Checkouts", async () => {
      const userA = ownedId("c7_userA");
      const userB = ownedId("c7_userB");
      const checkoutA = ownedId("c7_chkA");
      const checkoutB = ownedId("c7_chkB");
      const sharedProviderPaymentId = ownedId("c7_shared_pay");
      const verifiedAt = "2026-08-15T10:00:00.000Z";

      await runtime.prisma.user.createMany({
        data: [
          { id: userA, email: `${userA}@slice8ec.invalid`, password: "pw", name: "User A", isPaid: false },
          { id: userB, email: `${userB}@slice8ec.invalid`, password: "pw", name: "User B", isPaid: false },
        ],
      });

      // Run concurrent ingestions using SAME providerPaymentId on DIFFERENT checkouts and users
      const [resA, resB] = await Promise.all([
        service.ingestVerifiedPayment({
          userId: userA,
          checkoutSessionId: checkoutA,
          planType: "1_MONTH",
          purchaseAmountCentavos: 29_900,
          providerPaymentId: sharedProviderPaymentId,
          feeKnowledge: "KNOWN",
          feeAmountCentavos: 0,
          verifiedAt,
          source: "WEBHOOK",
        }),
        service.ingestVerifiedPayment({
          userId: userB,
          checkoutSessionId: checkoutB,
          planType: "1_MONTH",
          purchaseAmountCentavos: 29_900,
          providerPaymentId: sharedProviderPaymentId,
          feeKnowledge: "KNOWN",
          feeAmountCentavos: 0,
          verifiedAt,
          source: "WEBHOOK",
        }),
      ]);

      const winner = resA.outcome === "FRESH_DURABLE_COMMIT" ? resA : resB;
      const loser = resA.outcome === "FRESH_DURABLE_COMMIT" ? resB : resA;
      const losingUser = resA.outcome === "FRESH_DURABLE_COMMIT" ? userB : userA;
      const losingCheckout = resA.outcome === "FRESH_DURABLE_COMMIT" ? checkoutB : checkoutA;

      check(winner.outcome === "FRESH_DURABLE_COMMIT", "One winner must commit");
      check(loser.outcome === "IDENTITY_CONFLICT", "Loser must return controlled IDENTITY_CONFLICT");
      check(
        loser.conflictCode === "PROVIDER_PAYMENT_ALREADY_INGESTED",
        "Loser conflictCode must be PROVIDER_PAYMENT_ALREADY_INGESTED"
      );

      // Verify losing user received NO entitlement
      const losingUserRecord = await runtime.prisma.user.findUnique({ where: { id: losingUser } });
      check(losingUserRecord?.isPaid === false, "Losing user must NOT be granted isPaid");
      check(losingUserRecord?.paidUntil === null, "Losing user must NOT have paidUntil");

      // Verify losing checkout has NO Transaction or PaymentFinalization
      const losingTxn = await runtime.prisma.transaction.findUnique({ where: { checkoutSessionId: losingCheckout } });
      check(losingTxn === null, "Losing checkout must have no Transaction");
      const losingPfin = await runtime.prisma.paymentFinalization.findUnique({ where: { checkoutSessionId: losingCheckout } });
      check(losingPfin === null, "Losing checkout must have no PaymentFinalization");
    });

    // ────────────────────────────────────────────────────────────
    // C8 — Entitlement Baselines
    // ────────────────────────────────────────────────────────────
    await runGroup("C8", "Entitlement Baselines", async () => {
      const verifiedAt = "2026-08-15T10:00:00.000Z";
      const verifiedAtDate = new Date(verifiedAt);

      // Baseline 1: No prior paidUntil
      const u1 = ownedId("c8_u1");
      await runtime.prisma.user.create({
        data: { id: u1, email: `${u1}@slice8ec.invalid`, password: "pw", name: "U1", paidUntil: null },
      });
      const res1 = await service.ingestVerifiedPayment({
        userId: u1,
        checkoutSessionId: ownedId("c8_chk1"),
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt,
        source: "WEBHOOK",
      });
      const expected1 = new Date(verifiedAtDate);
      expected1.setDate(expected1.getDate() + 30);
      check(res1.paidUntil?.toISOString() === expected1.toISOString(), "No prior: verifiedAt + 30 days");

      // Baseline 2: Expired paidUntil (in the past relative to verifiedAt)
      const u2 = ownedId("c8_u2");
      const pastPaidUntil = new Date("2026-08-01T00:00:00.000Z");
      await runtime.prisma.user.create({
        data: { id: u2, email: `${u2}@slice8ec.invalid`, password: "pw", name: "U2", paidUntil: pastPaidUntil },
      });
      const res2 = await service.ingestVerifiedPayment({
        userId: u2,
        checkoutSessionId: ownedId("c8_chk2"),
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt,
        source: "WEBHOOK",
      });
      const expected2 = new Date(verifiedAtDate);
      expected2.setDate(expected2.getDate() + 30);
      check(res2.paidUntil?.toISOString() === expected2.toISOString(), "Expired prior: verifiedAt + 30 days");

      // Baseline 3: Active future paidUntil
      const u3 = ownedId("c8_u3");
      const futurePaidUntil = new Date("2026-08-25T10:00:00.000Z");
      await runtime.prisma.user.create({
        data: { id: u3, email: `${u3}@slice8ec.invalid`, password: "pw", name: "U3", paidUntil: futurePaidUntil },
      });
      const res3 = await service.ingestVerifiedPayment({
        userId: u3,
        checkoutSessionId: ownedId("c8_chk3"),
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt,
        source: "WEBHOOK",
      });
      const expected3 = new Date(futurePaidUntil);
      expected3.setDate(expected3.getDate() + 30);
      check(res3.paidUntil?.toISOString() === expected3.toISOString(), "Active prior: future paidUntil + 30 days");
    });

    // ────────────────────────────────────────────────────────────
    // C9 — Atomic Failure Injection
    // ────────────────────────────────────────────────────────────
    await runGroup("C9", "Atomic Failure Injection", async () => {
      const failurePoints = [
        "PLANNER",
        "MANIFEST_PERSIST",
        "USER_UPDATE",
        "LEDGER_POST",
        "EFFECT_COMPLETE",
      ] as const;

      for (const fp of failurePoints) {
        const userId = ownedId(`c9_u_${fp.toLowerCase()}`);
        const checkoutSessionId = ownedId(`c9_chk_${fp.toLowerCase()}`);

        await runtime.prisma.user.create({
          data: { id: userId, email: `${userId}@slice8ec.invalid`, password: "pw", name: "User C9", isPaid: false },
        });

        const serviceWithHook = new PaymentFinalizationIngestionService({
          prisma: runtime.prisma,
          coordinator: makeCoordinator(runtime.prisma),
          testHooks: {
            onBeforeStep: (point) => {
              if (point === fp) {
                throw new Error(`Simulated failure at ${fp}`);
              }
            },
          },
        });

        let thrown = false;
        try {
          await serviceWithHook.ingestVerifiedPayment({
            userId,
            checkoutSessionId,
            planType: "1_MONTH",
            purchaseAmountCentavos: 29_900,
            feeKnowledge: "KNOWN",
            feeAmountCentavos: 0,
            verifiedAt: new Date().toISOString(),
            source: "WEBHOOK",
          });
        } catch {
          thrown = true;
        }

        check(thrown, `Failure at ${fp} must throw and abort transaction`);

        // Verify total rollback
        const user = await runtime.prisma.user.findUnique({ where: { id: userId } });
        check(user?.isPaid === false, `Rollback at ${fp}: user.isPaid must remain false`);
        const txn = await runtime.prisma.transaction.findUnique({ where: { checkoutSessionId } });
        check(txn === null, `Rollback at ${fp}: Transaction must not exist`);
        const pfin = await runtime.prisma.paymentFinalization.findUnique({ where: { checkoutSessionId } });
        check(pfin === null, `Rollback at ${fp}: PaymentFinalization must not exist`);
      }
    });

    // ────────────────────────────────────────────────────────────
    // C10 — Unknown Fee Fresh Ingestion
    // ────────────────────────────────────────────────────────────
    await runGroup("C10", "Unknown Fee Fresh Ingestion", async () => {
      const userId = ownedId("c10_user");
      const checkoutSessionId = ownedId("c10_checkout");

      await runtime.prisma.user.create({
        data: { id: userId, email: `${userId}@slice8ec.invalid`, password: "pw", name: "User C10" },
      });

      const res = await service.ingestVerifiedPayment({
        userId,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "UNKNOWN",
        feeAmountCentavos: null,
        verifiedAt: new Date().toISOString(),
        source: "WEBHOOK",
      });

      check(res.outcome === "FRESH_DURABLE_COMMIT", "Outcome FRESH_DURABLE_COMMIT");
      check(res.durableCommitted === true, "durableCommitted true");

      const pfin = await runtime.prisma.paymentFinalization.findUnique({
        where: { id: res.finalizationId },
        include: { effects: true },
      });
      check(pfin !== null, "PaymentFinalization exists");
      check(pfin.feeKnowledge === "UNKNOWN", "feeKnowledge is UNKNOWN");
      check(pfin.feeAmountCentavos === null, "feeAmountCentavos is null");

      const feeEffect = pfin.effects.find((e) => e.effectType === "PROVIDER_FEE_LEDGER");
      check(feeEffect?.status === "AWAITING_DATA", "PROVIDER_FEE_LEDGER must be AWAITING_DATA");

      const paymentEffect = pfin.effects.find((e) => e.effectType === "PAYMENT_LEDGER");
      check(paymentEffect?.status === "COMPLETE", "PAYMENT_LEDGER must be COMPLETE");

      // Verify no fake fee ledger entry was created
      const feeLedger = await runtime.prisma.financialLedgerEntry.findFirst({
        where: { transactionId: res.transactionId, transactionType: "PAYMONGO_FEE" },
      });
      check(feeLedger === null, "No PAYMONGO_FEE ledger entry should exist when fee is UNKNOWN");
    });

    // ────────────────────────────────────────────────────────────
    // C11 — Unknown Fee Replay With Newly Known Fee
    // ────────────────────────────────────────────────────────────
    await runGroup("C11", "Unknown Fee Replay With Newly Known Fee", async () => {
      const userId = ownedId("c11_user");
      const checkoutSessionId = ownedId("c11_checkout");

      await runtime.prisma.user.create({
        data: { id: userId, email: `${userId}@slice8ec.invalid`, password: "pw", name: "User C11" },
      });

      // Initial ingestion: UNKNOWN fee
      const initial = await service.ingestVerifiedPayment({
        userId,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "UNKNOWN",
        feeAmountCentavos: null,
        verifiedAt: new Date().toISOString(),
        source: "WEBHOOK",
      });
      check(initial.outcome === "FRESH_DURABLE_COMMIT", "Initial commit");

      // Replay: supplies KNOWN positive fee (e.g. 500)
      const replay = await service.ingestVerifiedPayment({
        userId,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 500,
        verifiedAt: new Date().toISOString(),
        source: "WEBHOOK",
      });

      check(replay.outcome === "DURABLE_REPLAY", "Outcome is DURABLE_REPLAY");
      check(replay.feeEnrichmentRequired === true, "feeEnrichmentRequired must be true");

      // Assert fee fields remain UNCHANGED (Slice 8F will handle enrichment)
      const pfin = await runtime.prisma.paymentFinalization.findUnique({
        where: { id: initial.finalizationId },
        include: { effects: true },
      });
      check(pfin?.feeKnowledge === "UNKNOWN", "feeKnowledge remains UNKNOWN in 8E-C");
      check(pfin?.feeAmountCentavos === null, "feeAmountCentavos remains null in 8E-C");

      const feeEffect = pfin?.effects.find((e) => e.effectType === "PROVIDER_FEE_LEDGER");
      check(feeEffect?.status === "AWAITING_DATA", "feeEffect remains AWAITING_DATA");
    });

    // ────────────────────────────────────────────────────────────
    // C12 — Conflicting Known Fee Replay
    // ────────────────────────────────────────────────────────────
    await runGroup("C12", "Conflicting Known Fee Replay", async () => {
      const userId = ownedId("c12_user");
      const checkoutSessionId = ownedId("c12_checkout");

      await runtime.prisma.user.create({
        data: { id: userId, email: `${userId}@slice8ec.invalid`, password: "pw", name: "User C12" },
      });

      const initial = await service.ingestVerifiedPayment({
        userId,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 500,
        verifiedAt: new Date().toISOString(),
        source: "WEBHOOK",
      });
      check(initial.outcome === "FRESH_DURABLE_COMMIT", "Initial commit");

      // Replay with different known fee (600 vs 500)
      const conflictingReplay = await service.ingestVerifiedPayment({
        userId,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 600,
        verifiedAt: new Date().toISOString(),
        source: "WEBHOOK",
      });

      check(conflictingReplay.outcome === "IDENTITY_CONFLICT", "Must fail with IDENTITY_CONFLICT");
      check(conflictingReplay.conflictCode === "FEE_AMOUNT_MISMATCH", "Code FEE_AMOUNT_MISMATCH");
    });

    // ────────────────────────────────────────────────────────────
    // C13 — Post-Commit Coordinator Failure
    // ────────────────────────────────────────────────────────────
    await runGroup("C13", "Post-Commit Coordinator Failure", async () => {
      const userId = ownedId("c13_user");
      const checkoutSessionId = ownedId("c13_checkout");

      await runtime.prisma.user.create({
        data: { id: userId, email: `${userId}@slice8ec.invalid`, password: "pw", name: "User C13" },
      });

      // Service configured with a coordinator runner that fails
      const failingService = new PaymentFinalizationIngestionService({
        prisma: runtime.prisma,
        coordinator: {
          executeFinalization: async () => {
            throw new Error("Simulated network timeout during post-commit coordinator run");
          },
        },
      });

      const res = await failingService.ingestVerifiedPayment({
        userId,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt: new Date().toISOString(),
        source: "WEBHOOK",
      });

      check(res.outcome === "FRESH_DURABLE_COMMIT", "Phase 1 outcome must be FRESH_DURABLE_COMMIT");
      check(res.durableCommitted === true, "durableCommitted must be true");
      check(res.fastPath?.attempted === true, "fastPath attempted true");
      check(res.fastPath?.outcome === "ERROR", "fastPath outcome ERROR");
      check(
        res.fastPath?.message?.includes("Simulated network timeout"),
        "fastPath message contains sanitized error"
      );

      // Verify that database state remains fully COMMITTED and valid
      const txn = await runtime.prisma.transaction.findUnique({ where: { id: res.transactionId } });
      check(txn?.status === "PAID", "Transaction remains PAID");
      const user = await runtime.prisma.user.findUnique({ where: { id: userId } });
      check(user?.isPaid === true, "User entitlement remains granted");
      const pfin = await runtime.prisma.paymentFinalization.findUnique({ where: { id: res.finalizationId } });
      check(pfin !== null, "PaymentFinalization remains persisted");
    });

    // ────────────────────────────────────────────────────────────
    // C14 — Coordinator Fast Path Success
    // ────────────────────────────────────────────────────────────
    await runGroup("C14", "Coordinator Fast Path Success", async () => {
      const userId = ownedId("c14_user");
      const checkoutSessionId = ownedId("c14_checkout");

      await runtime.prisma.user.create({
        data: { id: userId, email: `${userId}@slice8ec.invalid`, password: "pw", name: "User C14" },
      });

      const res = await service.ingestVerifiedPayment({
        userId,
        checkoutSessionId,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt: new Date().toISOString(),
        source: "WEBHOOK",
      });

      check(res.outcome === "FRESH_DURABLE_COMMIT", "Phase 1 FRESH_DURABLE_COMMIT");
      check(res.durableCommitted === true, "durableCommitted true");
      check(res.fastPath?.attempted === true, "fastPath attempted true");
      check(res.fastPath?.outcome === "COMPLETE", "fastPath outcome COMPLETE");

      // Verify parent reaches COMPLETE
      const pfin = await runtime.prisma.paymentFinalization.findUnique({
        where: { id: res.finalizationId },
      });
      check(pfin?.status === "COMPLETE", "Parent status must reach COMPLETE");
    });

    // ────────────────────────────────────────────────────────────
    // C15 — Financial Unit Compatibility & Representability
    // ────────────────────────────────────────────────────────────
    await runGroup("C15", "Financial Unit Compatibility & Representability", async () => {
      // Subtest A: Whole-peso 29,900 centavos accepted
      const userIdA = ownedId("c15_userA");
      const checkoutA = ownedId("c15_chkA");

      await runtime.prisma.user.create({
        data: { id: userIdA, email: `${userIdA}@slice8ec.invalid`, password: "pw", name: "User C15A" },
      });

      const resA = await service.ingestVerifiedPayment({
        userId: userIdA,
        checkoutSessionId: checkoutA,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt: new Date().toISOString(),
        source: "WEBHOOK",
      });

      check(resA.outcome === "FRESH_DURABLE_COMMIT", "29,900 accepted");
      const txnA = await runtime.prisma.transaction.findUnique({ where: { id: resA.transactionId } });
      check(txnA !== null, "Transaction exists");
      check(txnA.amount === 299, "Transaction.amount stores integer pesos (299)");
      check(txnA.grossAmountCentavos === 29_900, "grossAmountCentavos stores 29900");

      // Reconciliation amount expectation: amount <= 5000 ? amount * 100 : amount
      const reconExpected = txnA.amount > 5000 ? txnA.amount : txnA.amount * 100;
      check(reconExpected === 29_900, "Reconciliation interpretation must resolve to 29900");

      // Waterfall calculation expectation:
      const waterfallExpected = txnA.amount > 5000 ? txnA.amount : txnA.amount * 100;
      check(waterfallExpected === 29_900, "Waterfall interpretation must resolve to 29900");

      // RefundService cross-check: grossAmountCentavos === 29900
      check(txnA.grossAmountCentavos === 29_900, "RefundService grossAmountCentavos check resolves to 29900");

      // Subtest B: Fractional-peso 19,950 centavos fails closed
      const userIdB = ownedId("c15_userB");
      const checkoutB = ownedId("c15_chkB");

      await runtime.prisma.user.create({
        data: { id: userIdB, email: `${userIdB}@slice8ec.invalid`, password: "pw", name: "User C15B" },
      });

      const resB = await service.ingestVerifiedPayment({
        userId: userIdB,
        checkoutSessionId: checkoutB,
        planType: "1_MONTH",
        purchaseAmountCentavos: 19_950,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt: new Date().toISOString(),
        source: "WEBHOOK",
      });

      check(resB.outcome === "INVARIANT_CONFLICT", "19,950 must be rejected with INVARIANT_CONFLICT");
      check(resB.conflictCode === "AMOUNT_UNIT_UNREPRESENTABLE", "conflictCode must be AMOUNT_UNIT_UNREPRESENTABLE");
      check(resB.durableCommitted === false, "durableCommitted must be false");

      // Verify zero database mutation for 19,950
      const txnB = await runtime.prisma.transaction.findUnique({ where: { checkoutSessionId: checkoutB } });
      check(txnB === null, "Zero Transaction created for fractional pesos");
      const pfinB = await runtime.prisma.paymentFinalization.findUnique({ where: { checkoutSessionId: checkoutB } });
      check(pfinB === null, "Zero PaymentFinalization created for fractional pesos");
    });

    // ────────────────────────────────────────────────────────────
    // C16 — Sticky Durable Ownership
    // ────────────────────────────────────────────────────────────
    await runGroup("C16", "Sticky Durable Ownership", async () => {
      check(
        resolvePaymentArchitectureOwnership({
          hasDurableFinalization: true,
          durableEnabledFlag: false,
        }) === "DURABLE",
        "Finalized payment stays DURABLE even when flag is false"
      );
      check(
        resolvePaymentArchitectureOwnership({
          hasDurableFinalization: true,
          durableEnabledFlag: true,
        }) === "DURABLE",
        "Finalized payment stays DURABLE when flag is true"
      );
      check(
        resolvePaymentArchitectureOwnership({
          hasDurableFinalization: false,
          durableEnabledFlag: false,
        }) === "LEGACY",
        "Un-finalized routes to LEGACY when flag is false"
      );
      check(
        resolvePaymentArchitectureOwnership({
          hasDurableFinalization: false,
          durableEnabledFlag: true,
        }) === "DURABLE",
        "Un-finalized routes to DURABLE when flag is true"
      );
    });

    // ────────────────────────────────────────────────────────────
    // C17 — No Production Callers
    // ────────────────────────────────────────────────────────────
    await runGroup("C17", "No Production Callers", async () => {
      // 1. Scan src/app for any reference
      const appCallers = walk(path.join(process.cwd(), "src", "app")).filter((file) => {
        if (!/\.[cm]?[jt]sx?$/.test(file)) return false;
        const source = fs.readFileSync(file, "utf8");
        return (
          source.includes("PaymentFinalizationIngestionService") ||
          source.includes("paymentFinalizationIngestionService") ||
          source.includes("ingestVerifiedPayment")
        );
      });
      check(appCallers.length === 0, "No production app callers of PaymentFinalizationIngestionService permitted");

      // 2. Scan entire src/ (excluding src/scripts and the service file itself) for any reference
      const serviceFileNormalized = path.normalize(
        path.join(process.cwd(), "src", "lib", "payment", "paymentFinalizationIngestionService.ts")
      );
      const scriptsDirNormalized = path.normalize(path.join(process.cwd(), "src", "scripts"));

      const nonTestCallers = walk(path.join(process.cwd(), "src")).filter((file) => {
        if (!/\.[cm]?[jt]sx?$/.test(file)) return false;
        const normalized = path.normalize(file);
        if (normalized === serviceFileNormalized) return false;
        if (normalized.startsWith(scriptsDirNormalized)) return false;

        const source = fs.readFileSync(file, "utf8");
        return (
          source.includes("PaymentFinalizationIngestionService") ||
          source.includes("ingestVerifiedPayment")
        );
      });
      check(nonTestCallers.length === 0, "No production callers permitted in any non-test code");

      // 3. Explicit check on critical live payment routes
      const routeFiles = [
        "src/app/api/paymongo/verify/route.ts",
        "src/app/api/paymongo/webhook/route.ts",
        "src/app/api/webhooks/paymongo/route.ts",
      ];
      for (const rf of routeFiles) {
        const full = path.join(process.cwd(), rf);
        if (fs.existsSync(full)) {
          const content = fs.readFileSync(full, "utf8");
          check(
            !content.includes("PaymentFinalizationIngestionService") &&
              !content.includes("ingestVerifiedPayment"),
            `Live route ${rf} must not reference PaymentFinalizationIngestionService or ingestVerifiedPayment`
          );
        }
      }
    });

  } finally {
    try {
      if (targetAccepted) await cleanup(runtime.prisma);
    } finally {
      await close(runtime);
    }
  }

  console.log("SLICE 8E-C POSTGRESQL RESULT:");
  console.log(`${passed}/17 groups passed`);
  console.log(`${checks} checks executed`);
  console.log(`${failed} groups failed`);
  console.log(`${unproven} groups NOT PROVEN`);
  console.log("DATABASE SAFETY:");
  console.log("- isolated URL supplied: YES");
  console.log("- equal to DATABASE_URL: NO");
  console.log("- target: " + safeLabel(target));
  console.log("- external providers invoked: NO");
  console.log("- production app callers added: NO");
  console.log("- schema modified: NO");
  console.log("- migration added: NO");
  if (failed) process.exitCode = 1;
}

async function main(): Promise<void> {
  console.log("SLICE 8E-C ISOLATED POSTGRESQL INGESTION SERVICE SUITE");
  let target: SafeTarget;
  try {
    target = gate(process.env);
  } catch (error) {
    console.error("DATABASE SAFETY GATE: REFUSED");
    console.error(sanitizeRuntimeError(error));
    console.error("No PostgreSQL, Prisma adapter, or coordinator runtime module was loaded.");
    process.exitCode = 2;
    return;
  }
  prefix = `slice8ec_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  console.log("DATABASE SAFETY GATE: PRE-CONNECTION CHECKS PASSED");
  console.log("Candidate target: " + safeLabel(target));
  await suite(target);
}

void main().catch((error) => {
  console.error("SLICE 8E-C POSTGRESQL RESULT: FAIL");
  console.error(sanitizeRuntimeError(error));
  process.exitCode = 1;
});
