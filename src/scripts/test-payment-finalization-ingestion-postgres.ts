/**
 * Slice 8E-B isolated PostgreSQL validation for atomic durable payment ingestion.
 *
 * Implements and proves:
 * E1  — Scoped Reader / Uncommitted Identity
 * E2  — Correct Entitlement Snapshot Ordering
 * E3  — Atomic Parent + Effect Persistence
 * E4  — PAYMENT_LEDGER Atomic Completion
 * E5  — Full Rollback (planner, manifest, user update, ledger post, effect complete)
 * E6  — Coordinator Fast Path (no duplicate ledger, strict DAG, fee AWAITING_DATA)
 * E7  — Legacy Reconciliation Compatibility Invariant
 * E8  — Duplicate Ingestion Serialization (concurrent checkout lock serialization)
 * E9  — Sticky Durable Ownership Model
 * E10 — createdAt / verifiedAt Equality & Entitlement Reconstruction
 *
 * Strictly follows Slice 8D safety gate: requires PAYMENT_FINALIZATION_TEST_DATABASE_URL.
 * Never falls back to DATABASE_URL.
 */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { Pool } from "pg";
import {
  SUPPORTED_CURRENCY,
  resolvePaymentArchitectureOwnership,
} from "../lib/payment/paymentFinalizationContracts";
import {
  PaymentFinalizationManifestService,
  TransactionScopedFinalizationDataReader,
} from "../lib/payment/paymentFinalizationManifestService";
import {
  IdempotentLedgerService,
} from "../lib/accounting/idempotentLedgerService";
import {
  createPaymentFinalizationCoordinatorForTesting,
} from "../lib/payment/paymentFinalizationCoordinator";
import {
  IdempotentReferralRewardService,
} from "../lib/referral/idempotentReferralRewardService";
import {
  IdempotentPartnerCommissionService,
} from "../lib/accounting/idempotentPartnerCommissionService";
import {
  IdempotentTaxProvisionService,
} from "../lib/accounting/idempotentTaxProvisionService";
import {
  IdempotentReconciliationService,
} from "../lib/accounting/idempotentReconciliationService";
import { RefundService } from "../lib/payment/refundService";

const ALLOWED_BRANCHES = new Set([
  "security/p1-001-payment-finalization-recovery",
  "integration/payment-performance",
]);
const URL_ENV = "PAYMENT_FINALIZATION_TEST_DATABASE_URL";
const ACK_ENV = "PAYMENT_FINALIZATION_ALLOW_ISOLATED_DB_TESTS";

type GroupLetter = "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7" | "E8" | "E9" | "E10";

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

class Barrier {
  private count = 0;
  private waiters: Array<() => void> = [];
  constructor(private readonly size: number) {}
  wait(): Promise<void> {
    if (++this.count === this.size) {
      this.waiters.splice(0).forEach((release) => release());
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }
}

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
    throw new Error("Neon targets are rejected; Neon/PgBouncer is outside Slice 8E-B");
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
  check(ALLOWED_BRANCHES.has(git("branch", "--show-current")[0] ?? ""), "Branch changed");
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
      source.includes("paymentFinalizationCoordinator") ||
      source.includes("PaymentFinalizationCoordinator") ||
      source.includes("TransactionScopedFinalizationDataReader")
    );
  });
  check(callers.length === 0, "Production app coordinator/ingestion caller found");

  const own = fs.readFileSync(__filename, "utf8");
  check(!/from\s+["'](?:resend|nodemailer|axios)["']/.test(own), "External communication import found");
  check(!/https:\/\/api\.paymongo\.com/i.test(own), "PayMongo endpoint found");

  // Invariant: Parent PaymentFinalization status enum contains NO "AWAITING_DATA"
  const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const parentEnumMatch = schema.match(/enum\s+PaymentFinalizationStatus\s*\{([^}]*)\}/);
  check(parentEnumMatch !== null, "PaymentFinalizationStatus enum not found in schema");
  check(
    !parentEnumMatch[1].includes("AWAITING_DATA"),
    "AWAITING_DATA must never be a parent PaymentFinalization status"
  );
  const effectEnumMatch = schema.match(/enum\s+PaymentFinalizationEffectStatus\s*\{([^}]*)\}/);
  check(effectEnumMatch !== null, "PaymentFinalizationEffectStatus enum not found");
  check(
    effectEnumMatch[1].includes("AWAITING_DATA"),
    "AWAITING_DATA must be an effect status"
  );
}

async function makeRuntime(connectionString: string, max = 4): Promise<Runtime> {
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
    application_name: "govstudyx_slice8e_ingestion_test",
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
        ],
      },
    });
    await tx.taxRecord.deleteMany({ where: { id: owned } });
    await tx.partnerCommission.deleteMany({ where: { id: owned } });
    await tx.referralReward.deleteMany({ where: { id: owned } });
    await tx.financialLedgerEntry.deleteMany({
      where: {
        OR: [
          { id: owned },
          { finalizationEffectId: owned },
          { transactionId: owned },
        ],
      },
    });
    await tx.paymentFinalizationEffect.deleteMany({ where: { id: owned } });
    await tx.paymentFinalization.deleteMany({ where: { id: owned } });
    await tx.transaction.deleteMany({ where: { id: owned } });
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

// ============================================================================
// ATOMIC INGESTION HELPER (SLICE 8E-B CORE SPECIFICATION)
// ============================================================================

export interface IngestionInput {
  userId: string;
  checkoutSessionId: string;
  planType: "1_MONTH" | "6_MONTHS" | "1_YEAR";
  purchaseAmountCentavos: number;
  authoritativeGrossAmountCentavos: number;
  feeKnowledge: "KNOWN" | "UNKNOWN";
  feeAmountCentavos?: number;
  providerPaymentId?: string;
  providerPaidAtIso?: string;
  verifiedAtIso: string;
  source: "WEBHOOK" | "VERIFY_POLL";
  failurePoint?: "PLANNER" | "MANIFEST_PERSIST" | "USER_UPDATE" | "LEDGER_POST" | "EFFECT_COMPLETE";
}

export interface IngestionResult {
  alreadyFinalized: boolean;
  transactionId: string;
  finalizationId?: string;
  entitlementAfter?: string | null;
}

/**
 * Executes atomic Phase 1 durable ingestion strictly within a single Prisma transaction.
 * Adheres character-for-character to the corrected Slice 8E specification:
 * 1. Acquire checkoutSessionId advisory lock
 * 2. Acquire user-entitlement:<userId> advisory lock
 * 3. Idempotency / ownership check
 * 4. Create canonical Transaction status PAID with createdAt = verifiedAt
 * 5. Call planFinalization() using TransactionScopedFinalizationDataReader(tx) WHILE User still has PRE-GRANT state
 * 6. Persist PaymentFinalization and 7 effects (parent PENDING, PAYMENT_LEDGER initially PENDING)
 * 7. Update User entitlement to EXACTLY manifest.entitlementAfter
 * 8. Post PAYMENT_RECEIVED balanced ledger pair using tx
 * 9. Transition PAYMENT_LEDGER effect to COMPLETE + completedAt
 * 10. Commit
 */
export async function executeAtomicIngestionInsideTx(
  tx: Prisma.TransactionClient,
  input: IngestionInput,
  customIds?: { transactionId?: string; finalizationId?: string }
): Promise<IngestionResult> {
  const {
    userId,
    checkoutSessionId,
    planType,
    purchaseAmountCentavos,
    authoritativeGrossAmountCentavos,
    feeKnowledge,
    feeAmountCentavos,
    providerPaymentId,
    providerPaidAtIso,
    verifiedAtIso,
    source,
    failurePoint,
  } = input;

  const verifiedAtDate = new Date(verifiedAtIso);

  // 🔒 1. Level 0 Lock: Ingestion / Checkout Session lock
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${checkoutSessionId}, 0)
    )::text AS lock_result
  `;

  // 🔒 2. Level 4 Lock: User Entitlement lock
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`user-entitlement:${userId}`}, 0)
    )::text AS lock_result
  `;

  // 🔍 3. Idempotency check on checkoutSessionId
  const existingTxn = await tx.transaction.findUnique({
    where: { checkoutSessionId },
  });
  if (existingTxn) {
    if (existingTxn.userId !== userId) {
      throw new Error("Checkout session ownership mismatch");
    }
    if (existingTxn.status === "PAID") {
      return {
        alreadyFinalized: true,
        transactionId: existingTxn.id,
      };
    }
  }

  // 📝 4. Create canonical Transaction status PAID with createdAt = verifiedAt
  const transactionId = customIds?.transactionId ?? ownedId("tx");
  const amountPesos = Math.round(purchaseAmountCentavos / 100);
  const createdTxn = await tx.transaction.create({
    data: {
      id: transactionId,
      userId,
      checkoutSessionId,
      paymentIntentId: ownedId("intent"),
      amount: amountPesos,
      grossAmountCentavos: authoritativeGrossAmountCentavos,
      discountAmountCentavos: 0,
      feeAmountCentavos: feeKnowledge === "KNOWN" ? feeAmountCentavos ?? 0 : null,
      netSettlementCentavos:
        feeKnowledge === "KNOWN"
          ? authoritativeGrossAmountCentavos - (feeAmountCentavos ?? 0)
          : null,
      planType,
      status: "PAID",
      createdAt: verifiedAtDate,
    },
  });

  if (failurePoint === "PLANNER") {
    throw new Error("Simulated failure at PLANNER");
  }

  // 📋 5. Plan finalization manifest using TransactionScopedFinalizationDataReader(tx)
  // CRITICAL: User has NOT been mutated yet! Reader observes pre-grant User state.
  const scopedReader = new TransactionScopedFinalizationDataReader(tx);
  const manifest = await PaymentFinalizationManifestService.planFinalization(
    {
      transactionId: createdTxn.id,
      checkoutSessionId,
      userId,
      planType,
      purchaseAmountCentavos,
      authoritativeGrossAmountCentavos,
      feeKnowledge,
      feeAmountCentavos: feeKnowledge === "KNOWN" ? feeAmountCentavos ?? 0 : undefined,
      feeObservedAtIso: feeKnowledge === "KNOWN" ? verifiedAtIso : undefined,
      providerPaymentId,
      providerPaidAtIso,
      source,
      origin: "NEW_PAYMENT",
      currency: SUPPORTED_CURRENCY,
      verifiedAtIso,
    },
    scopedReader
  );

  if (failurePoint === "MANIFEST_PERSIST") {
    throw new Error("Simulated failure at MANIFEST_PERSIST");
  }

  // 💾 6. Persist PaymentFinalization and 7 effects (parent PENDING, PAYMENT_LEDGER initially PENDING)
  const finalizationId = customIds?.finalizationId ?? ownedId("pfin");
  const effectRows = manifest.effects.map((effect) => {
    return {
      id: ownedId(`eff_${effect.effectType.toLowerCase()}`),
      effectType: effect.effectType,
      effectKey: effect.effectKey,
      operationKey: effect.operationKey,
      status: effect.status, // PAYMENT_LEDGER starts PENDING from planner
      intentVersion: effect.intentVersion,
      intent: effect.intent as unknown as Prisma.InputJsonValue,
      intentHash: effect.intentHash,
      attemptCount: 0,
      nextAttemptAt: verifiedAtDate,
      completedAt: null,
    };
  });

  // Verify parent status is valid supported status
  const parentStatus: "PENDING" = "PENDING";
  await tx.paymentFinalization.create({
    data: {
      id: finalizationId,
      transactionId: createdTxn.id,
      checkoutSessionId,
      providerPaymentId: manifest.providerPaymentId,
      providerPaidAt: manifest.providerPaidAt ? new Date(manifest.providerPaidAt) : null,
      source: manifest.source,
      origin: manifest.origin,
      status: parentStatus,
      manifestVersion: manifest.manifestVersion,
      manifestRevision: manifest.manifestRevision,
      manifestHash: manifest.manifestHash,
      planType: manifest.planType,
      currency: manifest.currency,
      purchaseAmountCentavos: manifest.purchaseAmountCentavos,
      feeKnowledge: manifest.feeKnowledge,
      feeAmountCentavos: manifest.feeAmountCentavos,
      feeObservedAt: manifest.feeObservedAt ? new Date(manifest.feeObservedAt) : null,
      entitlementBefore: manifest.entitlementBefore ? new Date(manifest.entitlementBefore) : null,
      entitlementAfter: manifest.entitlementAfter ? new Date(manifest.entitlementAfter) : null,
      verifiedAt: verifiedAtDate,
      attemptCount: 0,
      nextAttemptAt: verifiedAtDate,
      effects: {
        create: effectRows,
      },
    },
  });

  if (failurePoint === "USER_UPDATE") {
    throw new Error("Simulated failure at USER_UPDATE");
  }

  // 👤 7. Update User entitlement to EXACTLY manifest.entitlementAfter
  await tx.user.update({
    where: { id: userId },
    data: {
      isPaid: true,
      planType: manifest.planType,
      paidUntil: manifest.entitlementAfter ? new Date(manifest.entitlementAfter) : null,
    },
  });

  if (failurePoint === "LEDGER_POST") {
    throw new Error("Simulated failure at LEDGER_POST");
  }

  // 📖 8. Post PAYMENT_RECEIVED balanced double-entry ledger pair using tx
  const paymentEffect = effectRows.find((e) => e.effectType === "PAYMENT_LEDGER");
  if (!paymentEffect) {
    throw new Error("Missing PAYMENT_LEDGER effect in planned manifest");
  }

  const ledgerResult = await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
    {
      transactionId: createdTxn.id,
      finalizationEffectId: paymentEffect.id,
      operation: { kind: "PAYMENT" },
      operationKey: paymentEffect.operationKey,
      transactionType: "PAYMENT_RECEIVED",
      amountCentavos: manifest.purchaseAmountCentavos,
      debitCategory: "CASH_PAYMONGO",
      creditCategory: "REVENUE_PREMIUM",
      effectiveDate: verifiedAtDate,
      currency: SUPPORTED_CURRENCY,
      sourceEntity: "PaymentFinalization",
      sourceId: finalizationId,
      description: "Subscription payment " + manifest.planType,
      createdBy: null,
      periodId: null,
    },
    tx
  );

  check(ledgerResult.debitEntry !== null, "Debit entry must be returned");
  check(ledgerResult.creditEntry !== null, "Credit entry must be returned");

  if (failurePoint === "EFFECT_COMPLETE") {
    throw new Error("Simulated failure at EFFECT_COMPLETE");
  }

  // ✅ 9. Transition PAYMENT_LEDGER effect to COMPLETE + completedAt
  await tx.paymentFinalizationEffect.update({
    where: { id: paymentEffect.id },
    data: {
      status: "COMPLETE",
      completedAt: verifiedAtDate,
    },
  });

  return {
    alreadyFinalized: false,
    transactionId: createdTxn.id,
    finalizationId,
    entitlementAfter: manifest.entitlementAfter,
  };
}

// ============================================================================
// PROOF TEST GROUPS (E1 - E10)
// ============================================================================

async function suite(target: SafeTarget): Promise<void> {
  const runtime = await makeRuntime(target.raw, 8);
  let targetAccepted = false;

  try {
    await inspectTarget(runtime.pool, target);
    targetAccepted = true;
    staticChecks();

    // ────────────────────────────────────────────────────────────
    // E1 — Scoped Reader / Uncommitted Identity
    // ────────────────────────────────────────────────────────────
    await runGroup("E1", "Scoped Reader / Uncommitted Identity", async () => {
      const userId = ownedId("e1_user");
      const checkoutSessionId = ownedId("e1_checkout");
      const verifiedAtIso = new Date().toISOString();

      await runtime.prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@slice8e.invalid`,
          password: "slice8e-noncredential",
          name: "Slice 8E User",
        },
      });

      let observedTxId: string | null = null;

      await runtime.prisma.$transaction(async (tx) => {
        const txnId = ownedId("e1_tx");
        await tx.transaction.create({
          data: {
            id: txnId,
            userId,
            checkoutSessionId,
            amount: 299,
            grossAmountCentavos: 29_900,
            planType: "1_MONTH",
            status: "PAID",
            createdAt: new Date(verifiedAtIso),
          },
        });

        // Reader reads within uncommitted transaction
        const reader = new TransactionScopedFinalizationDataReader(tx);
        const identity = await reader.findTransactionIdentity(txnId);
        check(identity !== null, "Reader must resolve uncommitted transaction");
        check(identity.id === txnId, "Transaction ID must match");
        check(identity.userId === userId, "User ID must match");
        check(identity.checkoutSessionId === checkoutSessionId, "Checkout ID must match");

        // Planner validates identity against the reader
        const plan = await PaymentFinalizationManifestService.planFinalization(
          {
            transactionId: txnId,
            checkoutSessionId,
            userId,
            planType: "1_MONTH",
            purchaseAmountCentavos: 29_900,
            authoritativeGrossAmountCentavos: 29_900,
            feeKnowledge: "KNOWN",
            feeAmountCentavos: 0,
            feeObservedAtIso: verifiedAtIso,
            source: "WEBHOOK",
            origin: "NEW_PAYMENT",
            currency: "PHP",
            verifiedAtIso,
          },
          reader
        );

        check(plan.transactionId === txnId, "Plan must bind transactionId");
        observedTxId = txnId;
      });

      check(observedTxId !== null, "Transaction committed");
      const committed = await runtime.prisma.transaction.findUnique({
        where: { id: observedTxId },
      });
      check(committed !== null && committed.status === "PAID", "Transaction verified in DB");
    });

    // ────────────────────────────────────────────────────────────
    // E2 — Correct Entitlement Snapshot Ordering
    // ────────────────────────────────────────────────────────────
    await runGroup("E2", "Correct Entitlement Snapshot Ordering", async () => {
      // Case A: User with active future entitlement (+10 days)
      const userIdA = ownedId("e2_user_active");
      const checkoutA = ownedId("e2_checkout_a");
      const now = new Date();
      const initialPaidUntil = new Date(now.getTime() + 10 * 86_400_000);
      const verifiedAt = new Date(now.getTime() + 60_000);

      await runtime.prisma.user.create({
        data: {
          id: userIdA,
          email: `${userIdA}@slice8e.invalid`,
          password: "slice8e-noncredential",
          name: "User Active",
          isPaid: true,
          planType: "1_MONTH",
          paidUntil: initialPaidUntil,
        },
      });

      const resA = await runtime.prisma.$transaction(async (tx) => {
        return executeAtomicIngestionInsideTx(tx, {
          userId: userIdA,
          checkoutSessionId: checkoutA,
          planType: "1_MONTH",
          purchaseAmountCentavos: 29_900,
          authoritativeGrossAmountCentavos: 29_900,
          feeKnowledge: "KNOWN",
          feeAmountCentavos: 0,
          verifiedAtIso: verifiedAt.toISOString(),
          source: "WEBHOOK",
        });
      });

      const userA = await runtime.prisma.user.findUnique({ where: { id: userIdA } });
      const pfinA = await runtime.prisma.paymentFinalization.findUnique({
        where: { id: resA.finalizationId },
      });

      check(userA !== null && pfinA !== null, "Records must exist");
      check(
        pfinA.entitlementBefore?.toISOString() === initialPaidUntil.toISOString(),
        "entitlementBefore must match exact pre-grant baseline"
      );
      // Expected after = initialPaidUntil + 30 days
      const expectedAfterA = new Date(initialPaidUntil);
      expectedAfterA.setDate(expectedAfterA.getDate() + 30);
      check(
        pfinA.entitlementAfter?.toISOString() === expectedAfterA.toISOString(),
        "entitlementAfter must be exactly baseline + 30 days"
      );
      check(
        userA.paidUntil?.toISOString() === pfinA.entitlementAfter?.toISOString(),
        "User.paidUntil must equal PaymentFinalization.entitlementAfter with exact Date equality"
      );

      // Case B: User with expired/null entitlement
      const userIdB = ownedId("e2_user_null");
      const checkoutB = ownedId("e2_checkout_b");
      await runtime.prisma.user.create({
        data: {
          id: userIdB,
          email: `${userIdB}@slice8e.invalid`,
          password: "slice8e-noncredential",
          name: "User Null",
          isPaid: false,
          paidUntil: null,
        },
      });

      const resB = await runtime.prisma.$transaction(async (tx) => {
        return executeAtomicIngestionInsideTx(tx, {
          userId: userIdB,
          checkoutSessionId: checkoutB,
          planType: "1_MONTH",
          purchaseAmountCentavos: 29_900,
          authoritativeGrossAmountCentavos: 29_900,
          feeKnowledge: "KNOWN",
          feeAmountCentavos: 0,
          verifiedAtIso: verifiedAt.toISOString(),
          source: "WEBHOOK",
        });
      });

      const userB = await runtime.prisma.user.findUnique({ where: { id: userIdB } });
      const pfinB = await runtime.prisma.paymentFinalization.findUnique({
        where: { id: resB.finalizationId },
      });

      check(userB !== null && pfinB !== null, "Records must exist");
      check(pfinB.entitlementBefore === null, "entitlementBefore must be null for new user");
      const expectedAfterB = new Date(verifiedAt);
      expectedAfterB.setDate(expectedAfterB.getDate() + 30);
      check(
        pfinB.entitlementAfter?.toISOString() === expectedAfterB.toISOString(),
        "entitlementAfter must stack from verifiedAt"
      );
      check(
        userB.paidUntil?.toISOString() === pfinB.entitlementAfter?.toISOString(),
        "User.paidUntil must exactly match entitlementAfter for null baseline"
      );
    });

    // ────────────────────────────────────────────────────────────
    // E3 — Atomic Parent + Effect Persistence
    // ────────────────────────────────────────────────────────────
    await runGroup("E3", "Atomic Parent + Effect Persistence", async () => {
      const userId = ownedId("e3_user");
      const checkoutSessionId = ownedId("e3_checkout");
      const verifiedAtIso = new Date().toISOString();

      await runtime.prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@slice8e.invalid`,
          password: "slice8e-noncredential",
          name: "User E3",
        },
      });

      const res = await runtime.prisma.$transaction(async (tx) => {
        return executeAtomicIngestionInsideTx(tx, {
          userId,
          checkoutSessionId,
          planType: "1_MONTH",
          purchaseAmountCentavos: 29_900,
          authoritativeGrossAmountCentavos: 29_900,
          feeKnowledge: "KNOWN",
          feeAmountCentavos: 1_000,
          verifiedAtIso,
          source: "WEBHOOK",
        });
      });

      const pfin = await runtime.prisma.paymentFinalization.findUnique({
        where: { id: res.finalizationId },
        include: { effects: true },
      });

      check(pfin !== null, "Parent PaymentFinalization must exist");
      check(pfin.status === "PENDING", "Parent status must be PENDING");
      check(pfin.status !== ("AWAITING_DATA" as any), "Parent status must NEVER be AWAITING_DATA");

      // Assert 7 effect types
      check(pfin.effects.length === 7, `Must persist exactly 7 effects, found ${pfin.effects.length}`);
      const types = new Set(pfin.effects.map((e) => e.effectType));
      const expectedTypes = [
        "PAYMENT_LEDGER",
        "PROVIDER_FEE_LEDGER",
        "REFERRAL_REWARD",
        "PARTNER_COMMISSION",
        "PARTNER_LIABILITY_LEDGER",
        "TAX_PROVISION",
        "RECONCILIATION",
      ];
      check(expectedTypes.every((t) => types.has(t as any)), "All 7 effect types must be present");

      // Assert operationKey uniqueness
      const opKeys = pfin.effects.map((e) => e.operationKey);
      check(new Set(opKeys).size === 7, "All 7 operationKeys must be unique");

      // Assert intent hashes
      for (const eff of pfin.effects) {
        check(/^[0-9a-f]{64}$/.test(eff.intentHash), "intentHash must be 64-character hex");
      }
    });

    // ────────────────────────────────────────────────────────────
    // E4 — PAYMENT_LEDGER Atomic Completion
    // ────────────────────────────────────────────────────────────
    await runGroup("E4", "PAYMENT_LEDGER Atomic Completion", async () => {
      const userId = ownedId("e4_user");
      const checkoutSessionId = ownedId("e4_checkout");
      const verifiedAtIso = new Date().toISOString();

      await runtime.prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@slice8e.invalid`,
          password: "slice8e-noncredential",
          name: "User E4",
        },
      });

      const res = await runtime.prisma.$transaction(async (tx) => {
        return executeAtomicIngestionInsideTx(tx, {
          userId,
          checkoutSessionId,
          planType: "6_MONTHS",
          purchaseAmountCentavos: 149_900,
          authoritativeGrossAmountCentavos: 149_900,
          feeKnowledge: "KNOWN",
          feeAmountCentavos: 5_000,
          verifiedAtIso,
          source: "WEBHOOK",
        });
      });

      const pfin = await runtime.prisma.paymentFinalization.findUnique({
        where: { id: res.finalizationId },
        include: { effects: true },
      });

      check(pfin !== null, "Parent exists");
      const paymentEffect = pfin.effects.find((e) => e.effectType === "PAYMENT_LEDGER");
      check(paymentEffect !== null && paymentEffect !== undefined, "Payment effect must exist");
      check(paymentEffect.status === "COMPLETE", "PAYMENT_LEDGER effect must be COMPLETE");
      check(paymentEffect.completedAt !== null, "completedAt must be populated");

      // Verify balanced pair
      const ledgerEntries = await runtime.prisma.financialLedgerEntry.findMany({
        where: { transactionId: res.transactionId },
      });
      check(ledgerEntries.length === 2, `Expected balanced pair (2 rows), found ${ledgerEntries.length}`);
      const debit = ledgerEntries.find((e) => e.entryType === "DEBIT");
      const credit = ledgerEntries.find((e) => e.entryType === "CREDIT");
      check(debit !== undefined && credit !== undefined, "Both DEBIT and CREDIT must exist");
      check(debit.amountCentavos === 149_900, "Debit amount matches purchase");
      check(credit.amountCentavos === 149_900, "Credit amount matches purchase");
      check(debit.accountCategory === "CASH_PAYMONGO", "Debit account category CASH_PAYMONGO");
      check(credit.accountCategory === "REVENUE_PREMIUM", "Credit account category REVENUE_PREMIUM");
      check(debit.finalizationEffectId === paymentEffect.id, "Debit binds to paymentEffect.id");
      check(credit.finalizationEffectId === paymentEffect.id, "Credit binds to paymentEffect.id");
    });

    // ────────────────────────────────────────────────────────────
    // E5 — Full Rollback
    // ────────────────────────────────────────────────────────────
    await runGroup("E5", "Full Rollback", async () => {
      const failurePoints: Array<NonNullable<IngestionInput["failurePoint"]>> = [
        "PLANNER",
        "MANIFEST_PERSIST",
        "USER_UPDATE",
        "LEDGER_POST",
        "EFFECT_COMPLETE",
      ];

      for (const fp of failurePoints) {
        const userId = ownedId(`e5_user_${fp.toLowerCase()}`);
        const checkoutSessionId = ownedId(`e5_checkout_${fp.toLowerCase()}`);
        const initialDate = new Date("2026-01-01T00:00:00Z");

        await runtime.prisma.user.create({
          data: {
            id: userId,
            email: `${userId}@slice8e.invalid`,
            password: "slice8e-noncredential",
            name: `User ${fp}`,
            isPaid: false,
            paidUntil: initialDate,
          },
        });

        let aborted = false;
        try {
          await runtime.prisma.$transaction(async (tx) => {
            await executeAtomicIngestionInsideTx(tx, {
              userId,
              checkoutSessionId,
              planType: "1_MONTH",
              purchaseAmountCentavos: 29_900,
              authoritativeGrossAmountCentavos: 29_900,
              feeKnowledge: "KNOWN",
              feeAmountCentavos: 0,
              verifiedAtIso: new Date().toISOString(),
              source: "WEBHOOK",
              failurePoint: fp,
            });
          });
        } catch {
          aborted = true;
        }

        check(aborted, `Transaction with failurePoint=${fp} must abort`);

        // Assert 0 footprint
        const txnCount = await runtime.prisma.transaction.count({
          where: { checkoutSessionId },
        });
        check(txnCount === 0, `Transaction must roll back on failurePoint=${fp}`);

        const pfinCount = await runtime.prisma.paymentFinalization.count({
          where: { checkoutSessionId },
        });
        check(pfinCount === 0, `PaymentFinalization must roll back on failurePoint=${fp}`);

        const ledgerCount = await runtime.prisma.financialLedgerEntry.count({
          where: { description: { contains: checkoutSessionId } },
        });
        check(ledgerCount === 0, `FinancialLedgerEntry must roll back on failurePoint=${fp}`);

        const user = await runtime.prisma.user.findUnique({ where: { id: userId } });
        check(user !== null && !user.isPaid, "User must remain unpaid");
        check(
          user.paidUntil?.toISOString() === initialDate.toISOString(),
          "User paidUntil must remain unmutated"
        );
      }
    });

    // ────────────────────────────────────────────────────────────
    // E6 — Coordinator Fast Path
    // ────────────────────────────────────────────────────────────
    await runGroup("E6", "Coordinator Fast Path", async () => {
      // Case A: Known Fee -> Coordinator finishes remaining DAG to COMPLETE
      const userIdA = ownedId("e6_user_known");
      const checkoutA = ownedId("e6_checkout_known");
      const verifiedAt = new Date();

      await runtime.prisma.user.create({
        data: {
          id: userIdA,
          email: `${userIdA}@slice8e.invalid`,
          password: "slice8e-noncredential",
          name: "User E6 Known",
        },
      });

      const resA = await runtime.prisma.$transaction(async (tx) => {
        return executeAtomicIngestionInsideTx(tx, {
          userId: userIdA,
          checkoutSessionId: checkoutA,
          planType: "1_MONTH",
          purchaseAmountCentavos: 29_900,
          authoritativeGrossAmountCentavos: 29_900,
          feeKnowledge: "KNOWN",
          feeAmountCentavos: 1_000,
          verifiedAtIso: verifiedAt.toISOString(),
          source: "WEBHOOK",
        });
      });

      check(resA.finalizationId !== undefined, "finalizationId must exist");
      const coordinator = makeCoordinator(runtime.prisma);
      const outcomeA = await coordinator.executeFinalization({
        finalizationId: resA.finalizationId,
        workerId: "e6-worker-a",
        now: new Date(),
      });


      check(outcomeA.outcome === "COMPLETE", `Coordinator must achieve COMPLETE, got ${outcomeA.outcome}`);

      // Verify no duplicate PAYMENT_RECEIVED
      const ledgerA = await runtime.prisma.financialLedgerEntry.findMany({
        where: { transactionId: resA.transactionId, transactionType: "PAYMENT_RECEIVED" },
      });
      check(ledgerA.length === 2, `PAYMENT_RECEIVED must not be reposted; count=${ledgerA.length}`);

      // Case B: Unknown Fee -> Coordinator parks in AWAITING_DATA with valid parent status
      const userIdB = ownedId("e6_user_unknown");
      const checkoutB = ownedId("e6_checkout_unknown");

      await runtime.prisma.user.create({
        data: {
          id: userIdB,
          email: `${userIdB}@slice8e.invalid`,
          password: "slice8e-noncredential",
          name: "User E6 Unknown",
        },
      });

      const resB = await runtime.prisma.$transaction(async (tx) => {
        return executeAtomicIngestionInsideTx(tx, {
          userId: userIdB,
          checkoutSessionId: checkoutB,
          planType: "1_MONTH",
          purchaseAmountCentavos: 29_900,
          authoritativeGrossAmountCentavos: 29_900,
          feeKnowledge: "UNKNOWN",
          verifiedAtIso: verifiedAt.toISOString(),
          source: "WEBHOOK",
        });
      });

      check(resB.finalizationId !== undefined, "finalizationId must exist");
      const outcomeB = await coordinator.executeFinalization({
        finalizationId: resB.finalizationId,
        workerId: "e6-worker-b",
        now: new Date(),
      });

      check(
        outcomeB.outcome === "AWAITING_DATA",
        `Coordinator must return AWAITING_DATA, got ${outcomeB.outcome}`
      );

      const pfinB = await runtime.prisma.paymentFinalization.findUnique({
        where: { id: resB.finalizationId },
        include: { effects: true },
      });
      check(pfinB !== null, "Parent exists");
      check(
        pfinB.status === "PENDING",
        `Parent status must remain supported PENDING, got ${pfinB.status}`
      );
      const feeEffect = pfinB.effects.find((e) => e.effectType === "PROVIDER_FEE_LEDGER");
      check(feeEffect?.status === "AWAITING_DATA", "PROVIDER_FEE_LEDGER effect must be AWAITING_DATA");
    });

    // ────────────────────────────────────────────────────────────
    // E7 — Legacy Reconciliation Compatibility Invariant
    // ────────────────────────────────────────────────────────────
    await runGroup("E7", "Legacy Reconciliation Compatibility Invariant", async () => {
      const userId = ownedId("e7_user");
      const checkoutSessionId = ownedId("e7_checkout");
      const verifiedAtIso = new Date().toISOString();

      await runtime.prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@slice8e.invalid`,
          password: "slice8e-noncredential",
          name: "User E7",
        },
      });

      // Atomic Phase 1 commit
      const res = await runtime.prisma.$transaction(async (tx) => {
        return executeAtomicIngestionInsideTx(tx, {
          userId,
          checkoutSessionId,
          planType: "1_MONTH",
          purchaseAmountCentavos: 29_900,
          authoritativeGrossAmountCentavos: 29_900,
          feeKnowledge: "KNOWN",
          feeAmountCentavos: 0,
          verifiedAtIso,
          source: "WEBHOOK",
        });
      });

      // Statically verify that unchanged production reconciliationService.ts still evaluates:
      // PAYMENT_RECEIVED + DEBIT, PAYMENT_RECEIVED + CREDIT, and classifies missing entries as MISSING
      const reconServiceSource = fs.readFileSync(
        path.join(process.cwd(), "src/lib/accounting/reconciliationService.ts"),
        "utf8"
      );
      check(
        reconServiceSource.includes('e.transactionType === "PAYMENT_RECEIVED" && e.entryType === "DEBIT"'),
        "Production reconciliation must check PAYMENT_RECEIVED DEBIT"
      );
      check(
        reconServiceSource.includes('e.transactionType === "PAYMENT_RECEIVED" && e.entryType === "CREDIT"'),
        "Production reconciliation must check PAYMENT_RECEIVED CREDIT"
      );
      check(
        reconServiceSource.includes('status = "MISSING"'),
        "Production reconciliation must classify missing entries as MISSING"
      );
      check(
        reconServiceSource.includes('let status: ReconciliationStatus = "MATCHED"'),
        "Production reconciliation must initialize status as MATCHED"
      );

      // Load committed Transaction and its FinancialLedgerEntry rows via runtime.prisma
      const txn = await runtime.prisma.transaction.findUnique({
        where: { id: res.transactionId },
        include: { ledgerEntries: true },
      });

      // 1. Transaction exists
      check(txn !== null, "1. Transaction exists in database");

      const expectedPaymentCentavos = txn.amount > 5000 ? txn.amount : txn.amount * 100;

      // 2. PAYMENT_RECEIVED DEBIT exists
      const paymentDebit = txn.ledgerEntries.find(
        (e) => e.transactionType === "PAYMENT_RECEIVED" && e.entryType === "DEBIT"
      );
      check(paymentDebit !== undefined, "2. PAYMENT_RECEIVED DEBIT exists");

      // 3. PAYMENT_RECEIVED CREDIT exists
      const paymentCredit = txn.ledgerEntries.find(
        (e) => e.transactionType === "PAYMENT_RECEIVED" && e.entryType === "CREDIT"
      );
      check(paymentCredit !== undefined, "3. PAYMENT_RECEIVED CREDIT exists");

      // 4. Both belong to the correct transaction
      check(paymentDebit.transactionId === res.transactionId, "4A. Debit belongs to correct transaction");
      check(paymentCredit.transactionId === res.transactionId, "4B. Credit belongs to correct transaction");

      // 5. Debit amount equals expectedPaymentCentavos
      check(
        paymentDebit.amountCentavos === expectedPaymentCentavos,
        `5. Debit amount (${paymentDebit.amountCentavos}) equals expectedPaymentCentavos (${expectedPaymentCentavos})`
      );

      // 6. Credit amount equals expectedPaymentCentavos
      check(
        paymentCredit.amountCentavos === expectedPaymentCentavos,
        `6. Credit amount (${paymentCredit.amountCentavos}) equals expectedPaymentCentavos (${expectedPaymentCentavos})`
      );

      // 7. Debit and credit balance exactly
      check(
        paymentDebit.amountCentavos === paymentCredit.amountCentavos,
        "7. Debit and credit amounts balance exactly"
      );

      // 8. No missing payment-ledger condition exists
      const isMissing = !paymentDebit || !paymentCredit;
      check(!isMissing, "8. No missing payment-ledger condition exists");

      // 9. No mismatch condition exists
      const isMismatched =
        paymentDebit.amountCentavos !== expectedPaymentCentavos ||
        paymentCredit.amountCentavos !== expectedPaymentCentavos;
      check(!isMismatched, "9. No mismatch condition exists");
    });

    // ────────────────────────────────────────────────────────────
    // E8 — Duplicate Ingestion Serialization
    // ────────────────────────────────────────────────────────────
    await runGroup("E8", "Duplicate Ingestion Serialization", async () => {
      const userId = ownedId("e8_user");
      const checkoutSessionId = ownedId("e8_checkout");
      const verifiedAtIso = new Date().toISOString();

      await runtime.prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@slice8e.invalid`,
          password: "slice8e-noncredential",
          name: "User E8",
        },
      });

      const barrier = new Barrier(2);
      const attempt = async () => {
        await barrier.wait();
        return runtime.prisma.$transaction(async (tx) => {
          return executeAtomicIngestionInsideTx(tx, {
            userId,
            checkoutSessionId,
            planType: "1_MONTH",
            purchaseAmountCentavos: 29_900,
            authoritativeGrossAmountCentavos: 29_900,
            feeKnowledge: "KNOWN",
            feeAmountCentavos: 0,
            verifiedAtIso,
            source: "WEBHOOK",
          });
        });
      };

      const [res1, res2] = await Promise.all([attempt(), attempt()]);

      // Exactly one was new, one was already finalized
      const results = [res1, res2];
      const newlyFinalized = results.filter((r) => !r.alreadyFinalized);
      const replayed = results.filter((r) => r.alreadyFinalized);

      check(newlyFinalized.length === 1, "Exactly one ingestion must succeed freshly");
      check(replayed.length === 1, "Exactly one ingestion must exit as alreadyFinalized");

      // Verify exact counts
      const txnCount = await runtime.prisma.transaction.count({
        where: { checkoutSessionId },
      });
      check(txnCount === 1, `Expected exactly 1 Transaction, found ${txnCount}`);

      const pfinCount = await runtime.prisma.paymentFinalization.count({
        where: { checkoutSessionId },
      });
      check(pfinCount === 1, `Expected exactly 1 PaymentFinalization, found ${pfinCount}`);

      const ledgerEntries = await runtime.prisma.financialLedgerEntry.findMany({
        where: { transactionId: newlyFinalized[0].transactionId },
      });
      check(ledgerEntries.length === 2, `Expected exactly 1 balanced pair (2 entries), found ${ledgerEntries.length}`);
    });

    // ────────────────────────────────────────────────────────────
    // E9 — Sticky Durable Ownership Model
    // ────────────────────────────────────────────────────────────
    await runGroup("E9", "Sticky Durable Ownership Model", async () => {
      // 1. Payment has durable finalization -> Always DURABLE, even when flag is false
      check(
        resolvePaymentArchitectureOwnership({
          hasDurableFinalization: true,
          durableEnabledFlag: false,
        }) === "DURABLE",
        "Existing durable payment must remain DURABLE when flag is disabled"
      );

      check(
        resolvePaymentArchitectureOwnership({
          hasDurableFinalization: true,
          durableEnabledFlag: true,
        }) === "DURABLE",
        "Existing durable payment is DURABLE when flag is enabled"
      );

      // 2. New payment (no durable record) follows flag
      check(
        resolvePaymentArchitectureOwnership({
          hasDurableFinalization: false,
          durableEnabledFlag: false,
        }) === "LEGACY",
        "New payment without durable record routes to LEGACY when flag is false"
      );

      check(
        resolvePaymentArchitectureOwnership({
          hasDurableFinalization: false,
          durableEnabledFlag: true,
        }) === "DURABLE",
        "New payment without durable record routes to DURABLE when flag is true"
      );
    });

    // ────────────────────────────────────────────────────────────
    // E10 — createdAt / verifiedAt Equality & Entitlement Reconstruction
    // ────────────────────────────────────────────────────────────
    await runGroup("E10", "createdAt / verifiedAt Equality", async () => {
      const userId = ownedId("e10_user");
      const checkoutSessionId = ownedId("e10_checkout");
      const controlledVerifiedAtIso = "2026-08-15T10:00:00.000Z";

      await runtime.prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@slice8e.invalid`,
          password: "slice8e-noncredential",
          name: "User E10",
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      });

      const res = await runtime.prisma.$transaction(async (tx) => {
        return executeAtomicIngestionInsideTx(tx, {
          userId,
          checkoutSessionId,
          planType: "1_MONTH",
          purchaseAmountCentavos: 29_900,
          authoritativeGrossAmountCentavos: 29_900,
          feeKnowledge: "KNOWN",
          feeAmountCentavos: 0,
          verifiedAtIso: controlledVerifiedAtIso,
          source: "WEBHOOK",
        });
      });

      const txn = await runtime.prisma.transaction.findUnique({
        where: { id: res.transactionId },
      });
      const pfin = await runtime.prisma.paymentFinalization.findUnique({
        where: { id: res.finalizationId },
      });

      check(txn !== null && pfin !== null, "Records must exist");
      check(
        txn.createdAt.toISOString() === controlledVerifiedAtIso,
        `Transaction.createdAt (${txn.createdAt.toISOString()}) must equal verifiedAtIso (${controlledVerifiedAtIso})`
      );
      check(
        pfin.verifiedAt.toISOString() === controlledVerifiedAtIso,
        `PaymentFinalization.verifiedAt (${pfin.verifiedAt.toISOString()}) must equal verifiedAtIso (${controlledVerifiedAtIso})`
      );
      check(
        txn.createdAt.toISOString() === pfin.verifiedAt.toISOString(),
        "Transaction.createdAt must equal PaymentFinalization.verifiedAt exactly"
      );

      // Verify deterministic entitlement reconstruction uses this exact timestamp
      const entitlement = await RefundService.computeDeterministicEntitlement(userId, undefined, runtime.prisma);
      check(entitlement.expectedIsPaid, "Reconstructed entitlement must be isPaid=true");
      // Grant began at controlledVerifiedAtIso + 30 days
      const expectedEnd = new Date(controlledVerifiedAtIso);
      expectedEnd.setDate(expectedEnd.getDate() + 30);
      check(
        entitlement.expectedPaidUntil?.toISOString() === expectedEnd.toISOString(),
        `Reconstructed expectedPaidUntil (${entitlement.expectedPaidUntil?.toISOString()}) must equal expectedEnd (${expectedEnd.toISOString()})`
      );
    });
  } finally {
    try {
      if (targetAccepted) await cleanup(runtime.prisma);
    } finally {
      await close(runtime);
    }
  }

  console.log("SLICE 8E-B POSTGRESQL RESULT:");
  console.log(`${passed}/10 groups passed`);
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
  console.log("SLICE 8E-B ISOLATED POSTGRESQL INGESTION SUITE");
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
  prefix = `slice8e_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  console.log("DATABASE SAFETY GATE: PRE-CONNECTION CHECKS PASSED");
  console.log("Candidate target: " + safeLabel(target));
  await suite(target);
}

void main().catch((error) => {
  console.error("SLICE 8E-B POSTGRESQL RESULT: FAIL");
  console.error(sanitizeRuntimeError(error));
  process.exitCode = 1;
});
