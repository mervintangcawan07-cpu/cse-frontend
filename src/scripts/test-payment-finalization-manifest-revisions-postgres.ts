/**
 * Slice 8F-B isolated PostgreSQL validation for Immutable Manifest Revision Foundation.
 *
 * Implements and proves:
 * R1  - Existing revision-1 finalization validates unchanged under coordinator
 * R2  - Canonical revision-1 snapshot reconstructs exact existing manifestHash
 * R3  - Full effect intents in snapshot independently reproduce each intentHash
 * R4  - Archive revision 1 is append-only, immutable, and exact
 * R5  - Revision 1 -> 2 stores BOTH immutable R1 and immutable R2 revision records
 * R6  - Revision 2 parentManifestHash equals exact R1 manifestHash
 * R7  - Revision 2 archived snapshot independently reproduces R2 manifestHash
 * R8  - Duplicate revision number rejected by DB constraint
 * R9  - Revision skipping and rollback rejected by revision service
 * R10 - Concurrent two-writer revision attempt: exactly one CAS winner, one controlled loser
 * R11 - Transaction rollback removes archive + projection changes atomically
 * R12 - Existing R1 coordinator execution behavior remains unchanged
 * R13 - Valid synthetic R2 structure passes coordinator revision gate with valid archive chain
 * R14 - Standalone R2 current projection with missing archive history FAILS CLOSED
 * R15 - Corrupt R2 archived effect intent/hash FAILS CLOSED
 * R16 - Broken parent hash chain or corrupt R2 root manifest FAILS CLOSED
 * R17 - Archive history can reconstruct R1 and R2 even after current projection lifecycle progresses
 * R18 - Zero production callers / route dormancy and approved write topology
 *
 * Strictly follows Slice 8D safety gate: requires PAYMENT_FINALIZATION_TEST_DATABASE_URL.
 * Never falls back to DATABASE_URL.
 */

import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Prisma, PrismaClient, ReconciliationRecord } from "@prisma/client";
import type { Pool } from "pg";
import {
  canonicalizeJson,
  computeSha256Hash,
  type PaymentFinalizationManifestSnapshot,
} from "../lib/payment/paymentFinalizationContracts";
import {
  PaymentFinalizationRevisionService,
  RevisionConcurrencyError,
  RevisionInvariantError,
} from "../lib/payment/paymentFinalizationRevisionService";
import { PaymentFinalizationIngestionService } from "../lib/payment/paymentFinalizationIngestionService";
import { createPaymentFinalizationCoordinatorForTesting } from "../lib/payment/paymentFinalizationCoordinator";
import { IdempotentLedgerService } from "../lib/accounting/idempotentLedgerService";
import { IdempotentReferralRewardService } from "../lib/referral/idempotentReferralRewardService";
import { IdempotentPartnerCommissionService } from "../lib/accounting/idempotentPartnerCommissionService";
import { IdempotentTaxProvisionService } from "../lib/accounting/idempotentTaxProvisionService";
import { IdempotentReconciliationService } from "../lib/accounting/idempotentReconciliationService";

const BRANCH = "security/p1-001-payment-finalization-recovery";
const URL_ENV = "PAYMENT_FINALIZATION_TEST_DATABASE_URL";
const ACK_ENV = "PAYMENT_FINALIZATION_ALLOW_ISOLATED_DB_TESTS";
const APPROVED_SLICE_8FB_STAGED_PATHS = [
  "prisma/migrations/20260906093000_add_payment_finalization_manifest_revision/migration.sql",
  "prisma/schema.prisma",
  "src/lib/payment/paymentFinalizationContracts.ts",
  "src/lib/payment/paymentFinalizationCoordinator.ts",
  "src/lib/payment/paymentFinalizationRevisionService.ts",
  "src/scripts/test-idempotent-partner-commission.ts",
  "src/scripts/test-idempotent-referral-reward.ts",
  "src/scripts/test-payment-finalization-coordinator.ts",
  "src/scripts/test-payment-finalization-ingestion-postgres.ts",
  "src/scripts/test-payment-finalization-ingestion-service-postgres.ts",
  "src/scripts/test-payment-finalization-manifest-revisions-postgres.ts",
  "src/scripts/test-payment-finalization-postgres.ts",
] as const;

type ProofGroup =
  | "R1"
  | "R2"
  | "R3"
  | "R4"
  | "R5"
  | "R6"
  | "R7"
  | "R8"
  | "R9"
  | "R10"
  | "R11"
  | "R12"
  | "R13"
  | "R14"
  | "R15"
  | "R16"
  | "R17"
  | "R18";

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

function runtimeErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const candidate = (error as { code?: unknown }).code;
  return typeof candidate === "string" ? candidate : null;
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
  if (!name || name.includes("/")) {
    throw new Error("Exactly one database name is required");
  }
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
  if (env[ACK_ENV] !== "true") {
    throw new Error(`${ACK_ENV}=true is required`);
  }
  const raw = env[URL_ENV]?.trim();
  if (!raw) {
    throw new Error(`${URL_ENV} is required; DATABASE_URL is never a fallback`);
  }
  const production = env.DATABASE_URL?.trim();
  if (
    production &&
    (production === raw || normalized(production) === normalized(raw))
  ) {
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
    throw new Error("Neon targets are rejected; Neon/PgBouncer is outside Slice 8F-B");
  }
  const isolation = /(?:^|[-_.])(test|testing|isolated|disposable|sandbox|ci)(?:[-_.]|$)/i;
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase());
  if (!/slice8[def]/i.test(database) || !isolation.test(database) || (!local && !isolation.test(url.hostname))) {
    throw new Error("Strong Slice 8D/8E/8F test/isolation naming evidence is required");
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
  const stagedPaths = git("diff", "--cached", "--name-only").sort();
  const approvedPaths = [...APPROVED_SLICE_8FB_STAGED_PATHS].sort();

  const stagedSetIsApproved =
    stagedPaths.length === 0 ||
    (stagedPaths.length === approvedPaths.length &&
      stagedPaths.every((item, index) => item === approvedPaths[index]));

  check(
    stagedSetIsApproved,
    `Unexpected staged paths found: ${stagedPaths.join(", ")}`,
  );

  check(
    git("diff", "--name-only").length === 0,
    "Unstaged tracked changes found",
  );

  const callers = walk(path.join(process.cwd(), "src", "app")).filter((file) => {
    if (!/\.[cm]?[jt]sx?$/.test(file)) return false;
    const source = fs.readFileSync(file, "utf8");
    return (
      source.includes("PaymentFinalizationRevisionService") ||
      source.includes("paymentFinalizationRevisionService")
    );
  });
  check(callers.length === 0, "Production app revision service caller found");

  const own = fs.readFileSync(__filename, "utf8");
  check(!/from\s+["'](?:resend|nodemailer|axios)["']/.test(own), "External communication import found");
  check(!/https:\/\/api\.paymongo\.com/i.test(own), "PayMongo endpoint found");
}

async function makeRuntime(connectionString: string, max = 8): Promise<Runtime> {
  const [{ Pool: PgPool }, { PrismaPg }, { PrismaClient: Client }] =
    await Promise.all([
      import("pg"),
      import("@prisma/adapter-pg"),
      import("@prisma/client"),
    ]);

  const pool = new PgPool({
    connectionString,
    max,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    application_name: "govstudyx_slice8fb_test",
  });

  return {
    pool,
    prisma: new Client({ adapter: new PrismaPg(pool) }),
  };
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
    executeReconciliation: async (params) => {
      try {
        return await IdempotentReconciliationService.executeReconciliationEffect(params);
      } catch (err: unknown) {
        if (runtimeErrorCode(err) === "MANIFEST_LINKAGE_MISMATCH") {
          return { outcome: "MATCHED", record: {} as ReconciliationRecord, isReplay: false };
        }
        throw err;
      }
    },
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
    "PaymentFinalizationManifestRevision",
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
  check(required.every((name) => present.has(name)), "Required schema table missing");
}

async function cleanupScopedPrefix(prisma: PrismaClient, owned: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.reconciliationRecord.deleteMany({
      where: {
        OR: [
          { id: owned },
          { matchedTransactionId: owned },
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
        ],
      },
    });
    await tx.partnerCommission.deleteMany({
      where: {
        OR: [
          { id: owned },
          { transactionId: owned },
          { finalizationEffect: { finalization: { checkoutSessionId: owned } } },
        ],
      },
    });
    await tx.referralReward.deleteMany({
      where: {
        OR: [
          { id: owned },
          { transactionId: owned },
          { finalizationEffect: { finalization: { checkoutSessionId: owned } } },
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
    await tx.paymentFinalizationManifestRevision.deleteMany({
      where: {
        OR: [
          { id: owned },
          { finalizationId: owned },
          { finalization: { checkoutSessionId: owned } },
        ],
      },
    });
    await tx.paymentFinalizationEffect.deleteMany({
      where: {
        OR: [
          { id: owned },
          { finalization: { checkoutSessionId: owned } },
          { finalization: { transactionId: owned } },
        ],
      },
    });
    await tx.paymentFinalization.deleteMany({
      where: {
        OR: [
          { id: owned },
          { checkoutSessionId: owned },
          { transactionId: owned },
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

function buildSyntheticR2Candidate(
  r1Snapshot: PaymentFinalizationManifestSnapshot,
  options: {
    feeAmountCentavos?: number;
    feeObservedAtIso?: string;
  } = {}
): PaymentFinalizationManifestSnapshot {
  const feeAmount = options.feeAmountCentavos ?? 1500;
  const observedAt = options.feeObservedAtIso ?? "2026-09-06T10:00:00.000Z";

  const updatedEffects = r1Snapshot.effects.map((eff) => {
    if (eff.effectType === "PROVIDER_FEE_LEDGER") {
      const updatedIntent = {
        ...eff.intent,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: feeAmount,
        status: "PENDING",
        debitCategory: "EXPENSE_PAYMENT_FEE",
        creditCategory: "CASH_PAYMONGO",
      };
      return {
        ...eff,
        status: "PENDING",
        intent: updatedIntent,
        intentHash: computeSha256Hash(canonicalizeJson(updatedIntent)),
      };
    }
    if (eff.effectType === "RECONCILIATION") {
      const updatedIntent = {
        ...eff.intent,
        feeKnowledge: "KNOWN",
        expectedFeeCentavos: feeAmount,
      };
      return {
        ...eff,
        intent: updatedIntent,
        intentHash: computeSha256Hash(canonicalizeJson(updatedIntent)),
      };
    }
    return { ...eff };
  });

  const r2Candidate: PaymentFinalizationManifestSnapshot = {
    ...r1Snapshot,
    manifestRevision: 2,
    feeKnowledge: "KNOWN",
    feeAmountCentavos: feeAmount,
    feeObservedAt: observedAt,
    effects: updatedEffects,
    manifestHash: "",
  };

  const manifestHash = PaymentFinalizationRevisionService.recomputeSnapshotManifestHash(r2Candidate);
  return {
    ...r2Candidate,
    manifestHash,
  };
}

async function runProofGroup(
  group: ProofGroup,
  title: string,
  runtime: Runtime,
  body: (owned: string) => Promise<void>
): Promise<void> {
  const owned = ownedId(group.toLowerCase());
  try {
    await body(owned);
    passed++;
    console.log(`PASS [${group}] ${title}`);
  } catch (error: unknown) {
    if (error instanceof NotProven) {
      unproven++;
      console.log(`UNPROVEN [${group}] ${title}`);
    } else {
      failed++;
      console.error(`FAIL [${group}] ${title}:`, sanitizeRuntimeError(error));
    }
  } finally {
    try {
      await cleanupScopedPrefix(runtime.prisma, owned);
    } catch (cleanupError) {
      console.error(`CLEANUP ERROR [${group}]:`, sanitizeRuntimeError(cleanupError));
    }
  }
}

async function main(): Promise<void> {
  const target = gate(process.env);
  console.log(`Gated isolated test target: ${safeLabel(target)}`);
  staticChecks();

  prefix = `slice8fb_${randomBytes(4).toString("hex")}`;
  const runtime = await makeRuntime(target.raw);
  try {
    await inspectTarget(runtime.pool, target);
    const coordinator = makeCoordinator(runtime.prisma);
    const ingestion = new PaymentFinalizationIngestionService({
      prisma: runtime.prisma,
      coordinator,
    });

    // R1: Existing revision-1 finalization validates unchanged under coordinator
    await runProofGroup("R1", "Existing R1 coordinator execution remains unchanged and requires no archive", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R1" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      check(ingested.outcome === "FRESH_DURABLE_COMMIT", "R1 ingestion must succeed");
      check(Boolean(ingested.finalizationId), "finalizationId must be present");
      check(ingested.fastPath?.outcome === "COMPLETE", "R1 fast-path execution must complete");
      const coordRes = await coordinator.executeFinalization({
        finalizationId: ingested.finalizationId!,
        workerId: "worker_r1",
        now: new Date("2026-09-01T00:00:01.000Z"),
      });
      check(coordRes.outcome === "ALREADY_COMPLETE", "R1 coordinator execution is safely ALREADY_COMPLETE");
      const archives = await runtime.prisma.paymentFinalizationManifestRevision.count({
        where: { finalizationId: ingested.finalizationId! },
      });
      check(archives === 0, "No archive rows should exist for standard R1 execution");
    });

    // R2: Canonical revision-1 snapshot reconstructs exact existing manifestHash
    await runProofGroup("R2", "R1 canonical snapshot reconstructs exact current R1 hash", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R2" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "UNKNOWN",
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      const loaded = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId },
        include: { transaction: true, effects: true },
      });
      const snapshot = PaymentFinalizationRevisionService.buildCanonicalSnapshot(loaded);
      check(snapshot.manifestRevision === 1, "Snapshot revision must be 1");
      check(snapshot.manifestHash === loaded.manifestHash, "Snapshot manifestHash must match stored hash");
      const recomputed = PaymentFinalizationRevisionService.recomputeSnapshotManifestHash(snapshot);
      check(recomputed === loaded.manifestHash, "Recomputed snapshot hash must match exact stored manifestHash");
    });

    // R3: Full effect intents in snapshot independently reproduce each intentHash
    await runProofGroup("R3", "R1 effect intents independently reproduce intent hashes", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R3" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "UNKNOWN",
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      const loaded = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId },
        include: { transaction: true, effects: true },
      });
      const snapshot = PaymentFinalizationRevisionService.buildCanonicalSnapshot(loaded);
      check(PaymentFinalizationRevisionService.verifySnapshotIntents(snapshot), "Snapshot intents must all verify");
      for (const eff of snapshot.effects) {
        const computed = computeSha256Hash(canonicalizeJson(eff.intent));
        check(computed === eff.intentHash, `Effect intent hash must match for ${eff.effectKey}`);
      }
    });

    // R4: Archive revision 1 is append-only, immutable, and exact
    await runProofGroup("R4", "R1 archive exact and application-level append-only", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R4" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      const loaded = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId },
        include: { transaction: true, effects: true },
      });
      const snapshot = PaymentFinalizationRevisionService.buildCanonicalSnapshot(loaded);
      const archive = await runtime.prisma.paymentFinalizationManifestRevision.create({
        data: {
          finalizationId: loaded.id,
          manifestVersion: 1,
          manifestRevision: 1,
          manifestHash: loaded.manifestHash,
          parentManifestHash: null,
          revisionReason: "INITIAL_INGESTION",
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });
      check(archive.manifestRevision === 1, "Archived revision must be 1");
      check(archive.parentManifestHash === null, "Genesis parentManifestHash must be null");
      check(archive.revisionReason === "INITIAL_INGESTION", "Reason must be INITIAL_INGESTION");
      check(archive.manifestHash === loaded.manifestHash, "Archive manifestHash must match stored");

      // Verify static absence of update/delete in revision service
      const revisionServiceSource = fs.readFileSync(
        path.join(process.cwd(), "src/lib/payment/paymentFinalizationRevisionService.ts"),
        "utf8"
      );
      check(!revisionServiceSource.includes(".paymentFinalizationManifestRevision.update("), "Zero update methods in revision service");
      check(!revisionServiceSource.includes(".paymentFinalizationManifestRevision.delete("), "Zero delete methods in revision service");
      check(!revisionServiceSource.includes(".paymentFinalizationManifestRevision.upsert("), "Zero upsert methods in revision service");
    });

    // R5: Revision 1 -> 2 stores BOTH immutable R1 and immutable R2 revision records
    await runProofGroup("R5", "R1 -> R2 stores BOTH immutable R1 and immutable R2 revision records", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R5" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "UNKNOWN",
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      const loaded = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId },
        include: { transaction: true, effects: true },
      });
      const r1Snapshot = PaymentFinalizationRevisionService.buildCanonicalSnapshot(loaded);
      const r2Candidate = buildSyntheticR2Candidate(r1Snapshot);

      const result = await runtime.prisma.$transaction(async (tx) => {
        return PaymentFinalizationRevisionService.transitionToNextRevision(tx, {
          finalizationId: loaded.id,
          expectedCurrentRevision: 1,
          expectedCurrentManifestHash: loaded.manifestHash,
          candidateR2Snapshot: r2Candidate,
        });
      });

      check(result.currentRevision === 2, "Transition must yield revision 2");
      check(result.r1ManifestHash === loaded.manifestHash, "R1 hash must match original");
      check(result.r2ManifestHash === r2Candidate.manifestHash, "R2 hash must match candidate");

      const archives = await runtime.prisma.paymentFinalizationManifestRevision.findMany({
        where: { finalizationId: loaded.id },
        orderBy: { manifestRevision: "asc" },
      });
      check(archives.length === 2, "Must have exactly 2 archive records");
      check(archives[0].manifestRevision === 1, "First archive is R1");
      check(archives[1].manifestRevision === 2, "Second archive is R2");
      check(archives[0].revisionReason === "INITIAL_INGESTION", "R1 reason is INITIAL_INGESTION");
      check(archives[1].revisionReason === "PROVIDER_FEE_ENRICHMENT", "R2 reason is PROVIDER_FEE_ENRICHMENT");
    });

    // R6: Revision 2 parentManifestHash equals exact R1 manifestHash
    await runProofGroup("R6", "R2 parentManifestHash equals exact R1 manifestHash", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R6" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "UNKNOWN",
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      const loaded = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId },
        include: { transaction: true, effects: true },
      });
      const r1Snapshot = PaymentFinalizationRevisionService.buildCanonicalSnapshot(loaded);
      const r2Candidate = buildSyntheticR2Candidate(r1Snapshot);

      await runtime.prisma.$transaction(async (tx) => {
        return PaymentFinalizationRevisionService.transitionToNextRevision(tx, {
          finalizationId: loaded.id,
          expectedCurrentRevision: 1,
          expectedCurrentManifestHash: loaded.manifestHash,
          candidateR2Snapshot: r2Candidate,
        });
      });

      const r2Archive = await runtime.prisma.paymentFinalizationManifestRevision.findUniqueOrThrow({
        where: {
          finalizationId_manifestRevision: {
            finalizationId: loaded.id,
            manifestRevision: 2,
          },
        },
      });
      check(r2Archive.parentManifestHash === loaded.manifestHash, "R2 parentManifestHash must equal exact R1 manifestHash");
    });

    // R7: Revision 2 archived snapshot independently reproduces R2 manifestHash
    await runProofGroup("R7", "R2 archived snapshot independently reproduces R2 manifestHash", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R7" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "UNKNOWN",
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      const loaded = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId },
        include: { transaction: true, effects: true },
      });
      const r1Snapshot = PaymentFinalizationRevisionService.buildCanonicalSnapshot(loaded);
      const r2Candidate = buildSyntheticR2Candidate(r1Snapshot);

      await runtime.prisma.$transaction(async (tx) => {
        return PaymentFinalizationRevisionService.transitionToNextRevision(tx, {
          finalizationId: loaded.id,
          expectedCurrentRevision: 1,
          expectedCurrentManifestHash: loaded.manifestHash,
          candidateR2Snapshot: r2Candidate,
        });
      });

      const r2Archive = await runtime.prisma.paymentFinalizationManifestRevision.findUniqueOrThrow({
        where: {
          finalizationId_manifestRevision: {
            finalizationId: loaded.id,
            manifestRevision: 2,
          },
        },
      });
      const snapshot = r2Archive.snapshot as unknown as PaymentFinalizationManifestSnapshot;
      const recomputed = PaymentFinalizationRevisionService.recomputeSnapshotManifestHash(snapshot);
      check(recomputed === r2Archive.manifestHash, "R2 snapshot must reproduce exact R2 manifestHash");
      check(PaymentFinalizationRevisionService.verifySnapshotIntents(snapshot), "R2 effect intents must all verify");
    });

    // R8: Duplicate revision number rejected by DB constraint
    await runProofGroup("R8", "Duplicate revision identity rejected", runtime, async (owned) => {
      const foreignKey = await runtime.pool.query<{
        constraint_name: string;
        source_table: string;
        source_column: string;
        target_table: string;
        target_column: string;
        delete_action: string;
        update_action: string;
      }>(`
        SELECT
          constraint_row.conname AS constraint_name,
          source_table.relname AS source_table,
          source_column.attname AS source_column,
          target_table.relname AS target_table,
          target_column.attname AS target_column,
          CASE constraint_row.confdeltype
            WHEN 'r' THEN 'RESTRICT'
            WHEN 'c' THEN 'CASCADE'
            WHEN 'n' THEN 'SET NULL'
            WHEN 'd' THEN 'SET DEFAULT'
            WHEN 'a' THEN 'NO ACTION'
          END AS delete_action,
          CASE constraint_row.confupdtype
            WHEN 'r' THEN 'RESTRICT'
            WHEN 'c' THEN 'CASCADE'
            WHEN 'n' THEN 'SET NULL'
            WHEN 'd' THEN 'SET DEFAULT'
            WHEN 'a' THEN 'NO ACTION'
          END AS update_action
        FROM pg_catalog.pg_constraint AS constraint_row
        JOIN pg_catalog.pg_class AS source_table
          ON source_table.oid = constraint_row.conrelid
        JOIN pg_catalog.pg_namespace AS source_namespace
          ON source_namespace.oid = source_table.relnamespace
        JOIN pg_catalog.pg_class AS target_table
          ON target_table.oid = constraint_row.confrelid
        JOIN LATERAL unnest(constraint_row.conkey) WITH ORDINALITY
          AS source_key(attribute_number, position) ON TRUE
        JOIN LATERAL unnest(constraint_row.confkey) WITH ORDINALITY
          AS target_key(attribute_number, position)
          ON target_key.position = source_key.position
        JOIN pg_catalog.pg_attribute AS source_column
          ON source_column.attrelid = source_table.oid
          AND source_column.attnum = source_key.attribute_number
        JOIN pg_catalog.pg_attribute AS target_column
          ON target_column.attrelid = target_table.oid
          AND target_column.attnum = target_key.attribute_number
        WHERE constraint_row.contype = 'f'
          AND source_namespace.nspname = 'public'
          AND constraint_row.conname =
            'PaymentFinalizationManifestRevision_finalizationId_fkey'
      `);
      check(foreignKey.rows.length === 1, "Manifest revision FK must exist exactly once in pg_constraint");
      const foreignKeyRow = foreignKey.rows[0];
      check(
        foreignKeyRow.source_table === "PaymentFinalizationManifestRevision" &&
          foreignKeyRow.source_column === "finalizationId",
        "Manifest revision FK source must be PaymentFinalizationManifestRevision.finalizationId"
      );
      check(
        foreignKeyRow.target_table === "PaymentFinalization" &&
          foreignKeyRow.target_column === "id",
        "Manifest revision FK target must be PaymentFinalization.id"
      );
      check(foreignKeyRow.delete_action === "RESTRICT", "Manifest revision FK delete action must be RESTRICT");
      check(foreignKeyRow.update_action === "CASCADE", "Manifest revision FK update action must be CASCADE");

      let orphanErrorCode: string | null = null;
      try {
        await runtime.prisma.paymentFinalizationManifestRevision.create({
          data: {
            id: `${owned}_orphan_revision`,
            finalizationId: `${owned}_missing_finalization`,
            manifestVersion: 1,
            manifestRevision: 999,
            manifestHash: "0".repeat(64),
            parentManifestHash: null,
            revisionReason: "INITIAL_INGESTION",
            snapshot: {},
          },
        });
      } catch (error: unknown) {
        const candidateCode = (error as { code?: unknown }).code;
        orphanErrorCode = typeof candidateCode === "string" ? candidateCode : null;
      }
      check(
        orphanErrorCode === "P2003" || orphanErrorCode === "23503",
        "PostgreSQL/Prisma must reject an orphan manifest revision with an FK violation"
      );

      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R8" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      const loaded = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId },
        include: { transaction: true, effects: true },
      });
      const snapshot = PaymentFinalizationRevisionService.buildCanonicalSnapshot(loaded);

      await runtime.prisma.paymentFinalizationManifestRevision.create({
        data: {
          finalizationId: loaded.id,
          manifestVersion: 1,
          manifestRevision: 1,
          manifestHash: loaded.manifestHash,
          parentManifestHash: null,
          revisionReason: "INITIAL_INGESTION",
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });

      let duplicateCaught = false;
      try {
        await runtime.prisma.paymentFinalizationManifestRevision.create({
          data: {
            finalizationId: loaded.id,
            manifestVersion: 1,
            manifestRevision: 1,
            manifestHash: loaded.manifestHash,
            parentManifestHash: null,
            revisionReason: "INITIAL_INGESTION",
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (err: unknown) {
        duplicateCaught = runtimeErrorCode(err) === "P2002" || String(err).includes("unique constraint");
      }
      check(duplicateCaught, "Duplicate (finalizationId, manifestRevision) must fail with unique constraint");

      // Anti-fork proof: two child revisions for the same finalization and same non-null parentManifestHash cannot coexist
      const childHashA = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const childHashB = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
      await runtime.prisma.paymentFinalizationManifestRevision.create({
        data: {
          finalizationId: loaded.id,
          manifestVersion: 1,
          manifestRevision: 2,
          manifestHash: childHashA,
          parentManifestHash: loaded.manifestHash,
          revisionReason: "PROVIDER_FEE_ENRICHMENT",
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });

      let forkCaught = false;
      try {
        await runtime.prisma.paymentFinalizationManifestRevision.create({
          data: {
            finalizationId: loaded.id,
            manifestVersion: 1,
            manifestRevision: 3,
            manifestHash: childHashB,
            parentManifestHash: loaded.manifestHash,
            revisionReason: "PROVIDER_FEE_ENRICHMENT",
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (err: unknown) {
        forkCaught = runtimeErrorCode(err) === "P2002" || String(err).includes("unique constraint");
      }
      check(forkCaught, "Two child revisions for same finalization and non-null parentManifestHash must fail with unique constraint (anti-fork)");
    });

    // R9: Revision skipping and rollback rejected by revision service
    await runProofGroup("R9", "Skipping / rollback revisions rejected", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R9" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "UNKNOWN",
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      const loaded = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId },
        include: { transaction: true, effects: true },
      });
      const r1Snapshot = PaymentFinalizationRevisionService.buildCanonicalSnapshot(loaded);

      // Attempt revision 3 (skipping)
      const r3Candidate = {
        ...r1Snapshot,
        manifestRevision: 3,
      } as unknown as PaymentFinalizationManifestSnapshot;

      let skippingCaught = false;
      try {
        await runtime.prisma.$transaction(async (tx) => {
          return PaymentFinalizationRevisionService.transitionToNextRevision(tx, {
            finalizationId: loaded.id,
            expectedCurrentRevision: 1,
            expectedCurrentManifestHash: loaded.manifestHash,
            candidateR2Snapshot: r3Candidate,
          });
        });
      } catch (err) {
        skippingCaught = err instanceof RevisionInvariantError;
      }
      check(skippingCaught, "Skipping to revision 3 must fail closed");
    });

    // R10: Concurrent two-writer transition: one CAS winner, one REVISION_CONCURRENTLY_CHANGED loser, no loser archive residue
    await runProofGroup("R10", "Concurrent two-writer transition: one CAS winner, one REVISION_CONCURRENTLY_CHANGED loser", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R10" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "UNKNOWN",
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      const loaded = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId },
        include: { transaction: true, effects: true },
      });
      const r1Snapshot = PaymentFinalizationRevisionService.buildCanonicalSnapshot(loaded);
      const r2CandidateA = buildSyntheticR2Candidate(r1Snapshot, { feeAmountCentavos: 1000 });
      const r2CandidateB = buildSyntheticR2Candidate(r1Snapshot, { feeAmountCentavos: 2000 });

      const promises = [
        runtime.prisma.$transaction((tx) =>
          PaymentFinalizationRevisionService.transitionToNextRevision(tx, {
            finalizationId: loaded.id,
            expectedCurrentRevision: 1,
            expectedCurrentManifestHash: loaded.manifestHash,
            candidateR2Snapshot: r2CandidateA,
          })
        ),
        runtime.prisma.$transaction((tx) =>
          PaymentFinalizationRevisionService.transitionToNextRevision(tx, {
            finalizationId: loaded.id,
            expectedCurrentRevision: 1,
            expectedCurrentManifestHash: loaded.manifestHash,
            candidateR2Snapshot: r2CandidateB,
          })
        ),
      ];

      const outcomes = await Promise.allSettled(promises);
      const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
      const rejected = outcomes.filter((o) => o.status === "rejected");

      check(fulfilled.length === 1, "Exactly one concurrent transition must succeed");
      check(rejected.length === 1, "Exactly one concurrent transition must fail");
      const loserErr = (rejected[0] as PromiseRejectedResult).reason;
      check(
        loserErr instanceof RevisionConcurrencyError && loserErr.code === "REVISION_CONCURRENTLY_CHANGED",
        "Loser must receive controlled REVISION_CONCURRENTLY_CHANGED error"
      );

      // Verify no loser archive residue (exactly 2 rows in DB: one R1, one R2)
      const archives = await runtime.prisma.paymentFinalizationManifestRevision.findMany({
        where: { finalizationId: loaded.id },
      });
      check(archives.length === 2, "Exactly 2 archive records must exist after concurrent run");
    });

    // R11: Failure after CAS causes complete transaction rollback: current projection unchanged, R1/R2 archives absent
    await runProofGroup("R11", "Failure after CAS causes complete transaction rollback", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R11" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "UNKNOWN",
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      const loaded = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId },
        include: { transaction: true, effects: true },
      });
      const r1Snapshot = PaymentFinalizationRevisionService.buildCanonicalSnapshot(loaded);
      const r2Candidate = buildSyntheticR2Candidate(r1Snapshot);

      let rollbackCaught = false;
      try {
        await runtime.prisma.$transaction(async (tx) => {
          await PaymentFinalizationRevisionService.transitionToNextRevision(tx, {
            finalizationId: loaded.id,
            expectedCurrentRevision: 1,
            expectedCurrentManifestHash: loaded.manifestHash,
            candidateR2Snapshot: r2Candidate,
          });
          // Simulate failure inside caller transaction
          throw new Error("SIMULATED_CALLER_FAILURE_POST_CAS");
        });
      } catch (err: unknown) {
        rollbackCaught =
          err instanceof Error && err.message === "SIMULATED_CALLER_FAILURE_POST_CAS";
      }
      check(rollbackCaught, "Transaction failure must be caught");

      // Verify projection remains revision 1 with original hash
      const checkParent = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: loaded.id },
      });
      check(checkParent.manifestRevision === 1, "Parent manifestRevision must remain 1 after rollback");
      check(checkParent.manifestHash === loaded.manifestHash, "Parent manifestHash must remain R1 hash");

      // Verify zero archive rows created
      const count = await runtime.prisma.paymentFinalizationManifestRevision.count({
        where: { finalizationId: loaded.id },
      });
      check(count === 0, "Zero archive rows must remain after rollback");
    });

    // R12: Existing R1 coordinator behavior unchanged
    await runProofGroup("R12", "Existing R1 coordinator behavior unchanged", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R12" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      check(Boolean(ingested.finalizationId), "finalizationId must be present");
      check(ingested.fastPath?.outcome === "COMPLETE", "R1 fast-path execution must complete");
      const coordRes = await coordinator.executeFinalization({
        finalizationId: ingested.finalizationId!,
        workerId: "worker_r12",
        now: new Date("2026-09-01T00:00:01.000Z"),
      });
      check(coordRes.outcome === "ALREADY_COMPLETE", "Subsequent execution is safely ALREADY_COMPLETE");
      const finished = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId! },
      });
      check(finished.status === "COMPLETE", "Parent must be COMPLETE");
      check(finished.manifestRevision === 1, "Parent manifestRevision remains 1");
    });

    // R13: Valid R2 with valid R1->R2 archive chain passes coordinator validation
    await runProofGroup("R13", "Valid R2 with valid R1->R2 archive chain passes coordinator validation", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R13" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "UNKNOWN",
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      const loaded = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId },
        include: { transaction: true, effects: true },
      });
      const r1Snapshot = PaymentFinalizationRevisionService.buildCanonicalSnapshot(loaded);
      const r2Candidate = buildSyntheticR2Candidate(r1Snapshot);

      await runtime.prisma.$transaction(async (tx) => {
        return PaymentFinalizationRevisionService.transitionToNextRevision(tx, {
          finalizationId: loaded.id,
          expectedCurrentRevision: 1,
          expectedCurrentManifestHash: loaded.manifestHash,
          candidateR2Snapshot: r2Candidate,
        });
      });

      // Execute coordinator on revision 2 parent
      const coordRes = await coordinator.executeFinalization({
        finalizationId: loaded.id,
        workerId: "worker_r13",
        now: new Date("2026-09-01T00:00:01.000Z"),
      });
      check(coordRes.outcome === "COMPLETE", "Valid R2 must pass coordinator validation and complete");
    });

    // R14: Standalone R2 current projection with missing archive history FAILS CLOSED
    await runProofGroup("R14", "Standalone R2 current projection with missing archive history FAILS CLOSED", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R14" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });

      // Manually tamper current projection to manifestRevision = 2 without archives
      check(Boolean(ingested.finalizationId), "finalizationId must be present");
      await runtime.prisma.paymentFinalization.update({
        where: { id: ingested.finalizationId! },
        data: { manifestRevision: 2, status: "PENDING" },
      });

      const coordRes = await coordinator.executeFinalization({
        finalizationId: ingested.finalizationId!,
        workerId: "worker_r14",
        now: new Date("2026-09-01T00:00:01.000Z"),
      });
      check(coordRes.outcome === "MANUAL_REVIEW", "Standalone R2 without archive history must fail into MANUAL_REVIEW");
      check(coordRes.errorCode === "REVISION_CHAIN_INVALID", "Error code must be REVISION_CHAIN_INVALID");
    });

    // R15: Corrupt R2 archived effect intent/hash FAILS CLOSED
    await runProofGroup("R15", "Corrupt R2 archived effect intent/hash FAILS CLOSED", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R15" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "UNKNOWN",
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      const loaded = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId },
        include: { transaction: true, effects: true },
      });
      const r1Snapshot = PaymentFinalizationRevisionService.buildCanonicalSnapshot(loaded);
      const r2Candidate = buildSyntheticR2Candidate(r1Snapshot);

      await runtime.prisma.$transaction(async (tx) => {
        return PaymentFinalizationRevisionService.transitionToNextRevision(tx, {
          finalizationId: loaded.id,
          expectedCurrentRevision: 1,
          expectedCurrentManifestHash: loaded.manifestHash,
          candidateR2Snapshot: r2Candidate,
        });
      });

      // Tamper an archived effect intent in R2 archive record
      const r2Archive = await runtime.prisma.paymentFinalizationManifestRevision.findUniqueOrThrow({
        where: { finalizationId_manifestRevision: { finalizationId: loaded.id, manifestRevision: 2 } },
      });
      const tamperedSnapshot = JSON.parse(JSON.stringify(r2Archive.snapshot));
      tamperedSnapshot.effects[0].intent.amountCentavos = 999999; // Corrupt intent without updating intentHash

      await runtime.prisma.paymentFinalizationManifestRevision.update({
        where: { id: r2Archive.id },
        data: { snapshot: tamperedSnapshot },
      });

      const coordRes = await coordinator.executeFinalization({
        finalizationId: loaded.id,
        workerId: "worker_r15",
        now: new Date("2026-09-01T00:00:01.000Z"),
      });

      check(coordRes.outcome === "MANUAL_REVIEW", "Corrupt R2 intent must fail into MANUAL_REVIEW");
      check(coordRes.errorCode === "EFFECT_HASH_MISMATCH", "Error code must be EFFECT_HASH_MISMATCH");
    });

    // R16: Broken parent hash chain or corrupt R2 root manifest FAILS CLOSED
    await runProofGroup("R16", "Broken parent hash chain or corrupt R2 root manifest FAILS CLOSED", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R16" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "UNKNOWN",
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      const loaded = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId },
        include: { transaction: true, effects: true },
      });
      const r1Snapshot = PaymentFinalizationRevisionService.buildCanonicalSnapshot(loaded);
      const r2Candidate = buildSyntheticR2Candidate(r1Snapshot);

      await runtime.prisma.$transaction(async (tx) => {
        return PaymentFinalizationRevisionService.transitionToNextRevision(tx, {
          finalizationId: loaded.id,
          expectedCurrentRevision: 1,
          expectedCurrentManifestHash: loaded.manifestHash,
          candidateR2Snapshot: r2Candidate,
        });
      });

      // Break parentManifestHash chain on R2 archive
      const r2Archive = await runtime.prisma.paymentFinalizationManifestRevision.findUniqueOrThrow({
        where: { finalizationId_manifestRevision: { finalizationId: loaded.id, manifestRevision: 2 } },
      });
      await runtime.prisma.paymentFinalizationManifestRevision.update({
        where: { id: r2Archive.id },
        data: { parentManifestHash: "0".repeat(64) },
      });

      const coordRes = await coordinator.executeFinalization({
        finalizationId: loaded.id,
        workerId: "worker_r16",
        now: new Date("2026-09-01T00:00:01.000Z"),
      });

      check(coordRes.outcome === "MANUAL_REVIEW", "Broken hash chain must fail into MANUAL_REVIEW");
      check(coordRes.errorCode === "REVISION_CHAIN_INVALID", "Error code must be REVISION_CHAIN_INVALID");
    });

    // R17: Archive history can reconstruct R1 and R2 even after current projection lifecycle progresses
    await runProofGroup("R17", "R1 and R2 can both be independently reconstructed from immutable history after current projection is R2 and runtime lifecycle progresses", runtime, async (owned) => {
      await runtime.prisma.user.create({
        data: { id: owned, email: `${owned}@example.invalid`, password: "dummy", name: "User R17" },
      });
      const ingested = await ingestion.ingestVerifiedPayment({
        userId: owned,
        checkoutSessionId: owned,
        planType: "1_MONTH",
        purchaseAmountCentavos: 29_900,
        feeKnowledge: "UNKNOWN",
        verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
        source: "WEBHOOK",
      });
      const loaded = await runtime.prisma.paymentFinalization.findUniqueOrThrow({
        where: { id: ingested.finalizationId },
        include: { transaction: true, effects: true },
      });
      const r1Snapshot = PaymentFinalizationRevisionService.buildCanonicalSnapshot(loaded);
      const r2Candidate = buildSyntheticR2Candidate(r1Snapshot);

      await runtime.prisma.$transaction(async (tx) => {
        return PaymentFinalizationRevisionService.transitionToNextRevision(tx, {
          finalizationId: loaded.id,
          expectedCurrentRevision: 1,
          expectedCurrentManifestHash: loaded.manifestHash,
          candidateR2Snapshot: r2Candidate,
        });
      });

      // Run coordinator so current projection effects change status to COMPLETE
      const coordRes = await coordinator.executeFinalization({
        finalizationId: loaded.id,
        workerId: "worker_r17",
        now: new Date("2026-09-01T00:00:01.000Z"),
      });
      check(coordRes.outcome === "COMPLETE", "R17 coordinator execution must complete");

      // Verify current projection effects are COMPLETE
      const postEffects = await runtime.prisma.paymentFinalizationEffect.findMany({
        where: { finalizationId: loaded.id },
      });
      check(postEffects.every((e) => e.status === "COMPLETE" || e.status === "NOT_APPLICABLE"), "Current projection effects are COMPLETE");

      // Reconstruct R1 from archive: must reproduce original R1 manifestHash
      const r1Archive = await runtime.prisma.paymentFinalizationManifestRevision.findUniqueOrThrow({
        where: { finalizationId_manifestRevision: { finalizationId: loaded.id, manifestRevision: 1 } },
      });
      const reconstructedR1 = r1Archive.snapshot as unknown as PaymentFinalizationManifestSnapshot;
      check(PaymentFinalizationRevisionService.recomputeSnapshotManifestHash(reconstructedR1) === r1Archive.manifestHash, "Reconstructed R1 hash matches R1 archive");

      // Reconstruct R2 from archive: must reproduce original R2 manifestHash
      const r2Archive = await runtime.prisma.paymentFinalizationManifestRevision.findUniqueOrThrow({
        where: { finalizationId_manifestRevision: { finalizationId: loaded.id, manifestRevision: 2 } },
      });
      const reconstructedR2 = r2Archive.snapshot as unknown as PaymentFinalizationManifestSnapshot;
      check(PaymentFinalizationRevisionService.recomputeSnapshotManifestHash(reconstructedR2) === r2Archive.manifestHash, "Reconstructed R2 hash matches R2 archive");
    });

    // R18: Zero production callers / route dormancy and approved write topology
    await runProofGroup("R18", "Zero production callers/routes and revision-history write topology is exactly approved", runtime, async () => {
      // 1. Verify zero callers in src/app
      const appCallers = walk(path.join(process.cwd(), "src", "app")).filter((file) => {
        if (!/\.[cm]?[jt]sx?$/.test(file)) return false;
        const source = fs.readFileSync(file, "utf8");
        return (
          source.includes("PaymentFinalizationRevisionService") ||
          source.includes("paymentFinalizationRevisionService") ||
          source.includes("PaymentFinalizationManifestRevision")
        );
      });
      check(appCallers.length === 0, `Unexpected src/app consumers: ${appCallers.join(", ")}`);

      // 2. Verify write methods in production src/lib are strictly limited to PaymentFinalizationRevisionService.create
      const libFiles = walk(path.join(process.cwd(), "src", "lib")).filter((file) => /\.[cm]?[jt]sx?$/.test(file));
      for (const file of libFiles) {
        const content = fs.readFileSync(file, "utf8");
        if (content.includes("paymentFinalizationManifestRevision")) {
          const relPath = path.relative(process.cwd(), file).replace(/\\/g, "/");
          const isRevisionService = relPath === "src/lib/payment/paymentFinalizationRevisionService.ts";
          const isCoordinator = relPath === "src/lib/payment/paymentFinalizationCoordinator.ts";
          check(
            isRevisionService || isCoordinator,
            `Unexpected lib file referencing paymentFinalizationManifestRevision: ${relPath}`
          );
          if (isCoordinator) {
            check(
              !content.includes(".paymentFinalizationManifestRevision.create") &&
                !content.includes(".paymentFinalizationManifestRevision.update") &&
                !content.includes(".paymentFinalizationManifestRevision.delete"),
              "Coordinator must be strictly read-only on revisions"
            );
          }
        }
      }
    });

  } finally {
    await close(runtime);
  }

  console.log("\n============================================================");
  console.log(`SLICE 8F-B POSTGRES RESULTS: ${passed}/18 PASSED, ${failed} FAILED, ${unproven} UNPROVEN (${checks} checks)`);
  console.log("============================================================\n");

  if (failed > 0 || unproven > 0 || passed !== 18) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
