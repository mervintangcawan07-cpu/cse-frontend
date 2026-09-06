/**
 * Slice 8D isolated PostgreSQL validation.
 * Runtime database/application imports intentionally occur only after gate().
 */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { Pool, PoolClient } from "pg";
import type {
  PaymentFinalizationCoordinatorTestDependencies as Dependencies,
  createPaymentFinalizationCoordinatorForTesting as CreateCoordinator,
} from "../lib/payment/paymentFinalizationCoordinator";
import type {
  FinalizationPlanningInput,
  IFinalizationDataReader,
  PlannedManifest,
} from "../lib/payment/paymentFinalizationContracts";
import type {
  PostBalancedDoubleEntryIdempotentParams as LedgerParams,
  PostBalancedDoubleEntryResult as LedgerResult,
} from "../lib/accounting/idempotentLedgerService";
import type {
  ExecuteReconciliationEffectParams as ReconciliationParams,
  ExecuteReconciliationEffectResult as ReconciliationResult,
} from "../lib/accounting/idempotentReconciliationService";

const BRANCH = "security/p1-001-payment-finalization-recovery";
const URL_ENV = "PAYMENT_FINALIZATION_TEST_DATABASE_URL";
const ACK_ENV = "PAYMENT_FINALIZATION_ALLOW_ISOLATED_DB_TESTS";
const LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))";
const WAIT_MS = 5_000;
type Factory = typeof CreateCoordinator;
type Letter = "A"|"B"|"C"|"D"|"E"|"F"|"G"|"H"|"I"|"J"|"K"|"L";
type Planner = (input: FinalizationPlanningInput, reader: IFinalizationDataReader) => Promise<PlannedManifest>;

interface SafeTarget { raw: string; url: URL; database: string }
interface Runtime { prisma: PrismaClient; pool: Pool }
interface Fixture {
  transactionId: string;
  finalizationId: string;
  effects: Record<string, string>;
}
interface FixtureOptions {
  name: string;
  fee?: "KNOWN"|"UNKNOWN";
  status?: "PENDING"|"PROCESSING"|"FAILED_RETRYABLE"|"COMPLETE"|"MANUAL_REVIEW";
  attempts?: number;
  owner?: string|null;
  expiry?: Date|null;
  payment?: "PENDING"|"FAILED_RETRYABLE"|"COMPLETE"|"MANUAL_REVIEW";
}
interface Hooks {
  first?: () => Promise<void>;
  ledger?: (p: LedgerParams, tx: Prisma.TransactionClient) => Promise<LedgerResult>;
  reconciliation?: (p: ReconciliationParams) => Promise<ReconciliationResult>;
}

class NotProven extends Error {}
class Barrier {
  private count = 0;
  private waiters: Array<() => void> = [];
  constructor(private size: number) {}
  wait(): Promise<void> {
    if (++this.count === this.size) {
      this.waiters.splice(0).forEach((release) => release());
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }
}

let checks = 0, passed = 0, failed = 0, unproven = 0, sequence = 0;
let prefix = "";
function check(value: unknown, text: string): asserts value {
  checks++;
  if (!value) throw new Error(text);
}
function errorCode(error: unknown): string|null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value : null;
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
function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)) }
async function bounded<T>(promise: Promise<T>, label: string, ms = WAIT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>|undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(label + " exceeded safe wait")), ms);
    })]);
  } finally { if (timer) clearTimeout(timer) }
}
function ownedId(label: string): string { return `${prefix}_${++sequence}_${label}` }

function getDatabaseName(url: URL): string {
  let name = "";
  try { name = decodeURIComponent(url.pathname.replace(/^\/+/, "")) } catch { throw new Error("Invalid encoded database name") }
  if (!name || name.includes("/")) throw new Error("Exactly one database name is required");
  return name;
}
function normalized(raw: string): string|null { try { return new URL(raw).toString() } catch { return null } }
function gate(env: NodeJS.ProcessEnv): SafeTarget {
  if (env[ACK_ENV] !== "true") throw new Error(`${ACK_ENV}=true is required`);
  const raw = env[URL_ENV]?.trim();
  if (!raw) throw new Error(`${URL_ENV} is required; DATABASE_URL is never a fallback`);
  const production = env.DATABASE_URL?.trim();
  if (production && (production === raw || normalized(production) === normalized(raw))) throw new Error("Candidate equals DATABASE_URL");
  let url: URL;
  try { url = new URL(raw) } catch { throw new Error("Malformed candidate URL") }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) throw new Error("A PostgreSQL URL with a hostname is required");
  const database = getDatabaseName(url);
  const prod = /govstudyx|(?:^|[-_.])(prod|production|live|main)(?:[-_.]|$)/i;
  if ([url.hostname, url.username, database].some((part) => prod.test(part))) throw new Error("Production-like identifier rejected");
  if (/(?:^|\.)neon\.tech$/i.test(url.hostname)) throw new Error("Neon targets are rejected; Neon/PgBouncer is outside Slice 8D");
  const isolation = /(?:^|[-_.])(test|testing|isolated|disposable|sandbox|ci)(?:[-_.]|$)/i;
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase());
  if (!/slice8d/i.test(database) || !isolation.test(database) || (!local && !isolation.test(url.hostname))) throw new Error("Strong Slice 8D test/isolation naming evidence is required");
  return { raw, url, database };
}
function safeLabel(target: SafeTarget): string {
  return `${target.url.protocol}//[credentials-redacted]@${target.url.hostname}${target.url.port ? `:${target.url.port}` : ""}/${target.database}`;
}

function git(...args: string[]): string[] {
  return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
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
  const approvedChanges = new Set([
    "src/lib/payment/paymentFinalizationContracts.ts",
    "src/lib/payment/paymentFinalizationManifestService.ts",
    "src/lib/accounting/idempotentLedgerService.ts",
    "prisma/schema.prisma",
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
    "status", "--porcelain=v1", "--untracked-files=all", "--",
    "src/lib/payment/paymentFinalizationService.ts",
    "src/app/api/paymongo/verify/route.ts",
    "src/app/api/paymongo/webhook/route.ts",
    "src/app/api/webhooks/paymongo/route.ts"
  );
  check(protectedStatus.length === 0, "Protected legacy service or route path changed");
  const callers = walk(path.join(process.cwd(), "src", "app")).filter((file) => {
    if (!/\.[cm]?[jt]sx?$/.test(file)) return false;
    const source = fs.readFileSync(file, "utf8");
    return source.includes("paymentFinalizationCoordinator") || source.includes("PaymentFinalizationCoordinator");
  });
  check(callers.length === 0, "Production app coordinator caller found");
  const own = fs.readFileSync(__filename, "utf8");
  check(!/from\s+["'](?:resend|nodemailer|axios)["']/.test(own), "External communication import found");
  check(!/https:\/\/api\.paymongo\.com/i.test(own), "PayMongo endpoint found");
  const coordinator = fs.readFileSync(path.join(process.cwd(), "src/lib/payment/paymentFinalizationCoordinator.ts"), "utf8");
  check(coordinator.includes("const TRANSACTION_TIMEOUT_MS = 25_000;") && coordinator.includes("const TRANSACTION_MAX_WAIT_MS = 15_000;"), "Production transaction constants changed");
  check(coordinator.includes("pg_advisory_xact_lock") && coordinator.includes("hashtextextended(${transactionId}, 0)"), "Canonical root lock changed");
}

async function makeRuntime(connectionString: string, max = 4): Promise<Runtime> {
  const [{ Pool: PgPool }, { PrismaPg }, { PrismaClient: Client }] = await Promise.all([import("pg"), import("@prisma/adapter-pg"), import("@prisma/client")]);
  const pool = new PgPool({ connectionString, max, connectionTimeoutMillis: 2_000, idleTimeoutMillis: 2_000, application_name: "govstudyx_slice8d_isolated_test" });
  return { pool, prisma: new Client({ adapter: new PrismaPg(pool) }) };
}
async function close(value: Runtime): Promise<void> { await value.prisma.$disconnect(); await value.pool.end() }
async function inspectTarget(pool: Pool, target: SafeTarget): Promise<void> {
  const identity = await pool.query<{ database: string; read_only: string }>("SELECT current_database() AS database, current_setting('transaction_read_only') AS read_only");
  check(identity.rows[0]?.database === target.database, "Connected database differs from gated target");
  check(identity.rows[0]?.read_only === "off", "Target is read-only");
  const required = ["User", "Transaction", "PaymentFinalization", "PaymentFinalizationEffect", "FinancialLedgerEntry", "ReferralReward", "PartnerCommission", "TaxRecord", "ReconciliationRecord"];
  const tableRows = await pool.query<{ table_name: string }>("SELECT tablename AS table_name FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])", [required]);
  const present = new Set(tableRows.rows.map((row) => row.table_name));
  check(required.every((name) => present.has(name)), "Required schema missing; migrations are forbidden");
  const result = await pool.query<Record<string, string>>(`SELECT
    (SELECT count(*)::text FROM "User") users,
    (SELECT count(*)::text FROM "Transaction") transactions,
    (SELECT count(*)::text FROM "PaymentFinalization") finalizations,
    (SELECT count(*)::text FROM "PaymentFinalizationEffect") effects,
    (SELECT count(*)::text FROM "FinancialLedgerEntry") ledger,
    (SELECT count(*)::text FROM "ReferralReward") referrals,
    (SELECT count(*)::text FROM "PartnerCommission") commissions,
    (SELECT count(*)::text FROM "TaxRecord") taxes,
    (SELECT count(*)::text FROM "ReconciliationRecord") reconciliations`);
  check(Object.values(result.rows[0] ?? {}).every((count) => count === "0"), "Unexpected business data found; fixture creation refused");
}

function fixtureReader(transactionId: string, userId: string, checkout: string): IFinalizationDataReader {
  return {
    findTransactionIdentity: async (value) => value === transactionId ? { id: transactionId, userId, checkoutSessionId: checkout } : null,
    findUser: async (value) => value === userId ? { id: userId, isPaid: false, paidUntil: null } : null,
    findReferralAttribution: async () => null,
    findExistingPartnerCommission: async () => null,
    findPartnerAttribution: async () => null,
    findActiveTaxConfigs: async () => [],
  };
}
async function createFixture(prisma: PrismaClient, plan: Planner, options: FixtureOptions): Promise<Fixture> {
  const userId = ownedId(options.name + "_user"), transactionId = ownedId(options.name + "_tx");
  const checkout = ownedId(options.name + "_checkout"), finalizationId = ownedId(options.name + "_final");
  const now = new Date(), verified = new Date(now.getTime() - 60_000), fee = options.fee ?? "KNOWN";
  await prisma.user.create({ data: { id: userId, email: `${userId}@slice8d.invalid`, password: "slice8d-noncredential", name: "Slice 8D fixture" } });
  await prisma.transaction.create({ data: { id: transactionId, userId, checkoutSessionId: checkout, paymentIntentId: ownedId(options.name + "_payment"), amount: 299, grossAmountCentavos: 29_900, discountAmountCentavos: 0, feeAmountCentavos: fee === "KNOWN" ? 0 : null, netSettlementCentavos: fee === "KNOWN" ? 29_900 : null, planType: "1_MONTH", status: "PAID" } });
  const manifest = await plan({ transactionId, checkoutSessionId: checkout, userId, planType: "1_MONTH", purchaseAmountCentavos: 29_900, authoritativeGrossAmountCentavos: 29_900, feeKnowledge: fee, feeAmountCentavos: fee === "KNOWN" ? 0 : undefined, feeObservedAtIso: fee === "KNOWN" ? verified.toISOString() : undefined, providerPaymentId: ownedId(options.name + "_provider"), providerPaidAtIso: verified.toISOString(), source: "WEBHOOK", origin: "NEW_PAYMENT", currency: "PHP", verifiedAtIso: verified.toISOString() }, fixtureReader(transactionId, userId, checkout));
  const rows = manifest.effects.map((effect) => {
    const status = effect.effectType === "PAYMENT_LEDGER" && options.payment ? options.payment : effect.status;
    return { id: ownedId(`${options.name}_${effect.effectType.toLowerCase()}_${effect.effectKey.replace(/[^a-z0-9]+/gi, "_")}`), effectType: effect.effectType, effectKey: effect.effectKey, operationKey: effect.operationKey, status, intentVersion: effect.intentVersion, intent: effect.intent as unknown as Prisma.InputJsonValue, intentHash: effect.intentHash, attemptCount: 0, nextAttemptAt: now, completedAt: status === "COMPLETE" ? now : null };
  });
  await prisma.paymentFinalization.create({ data: { id: finalizationId, transactionId, checkoutSessionId: checkout, providerPaymentId: manifest.providerPaymentId, providerPaidAt: manifest.providerPaidAt ? new Date(manifest.providerPaidAt) : null, source: manifest.source, origin: manifest.origin, status: options.status ?? "PENDING", manifestVersion: manifest.manifestVersion, manifestRevision: manifest.manifestRevision, manifestHash: manifest.manifestHash, planType: manifest.planType, currency: manifest.currency, purchaseAmountCentavos: manifest.purchaseAmountCentavos, feeKnowledge: manifest.feeKnowledge, feeAmountCentavos: manifest.feeAmountCentavos, feeObservedAt: manifest.feeObservedAt ? new Date(manifest.feeObservedAt) : null, entitlementBefore: manifest.entitlementBefore ? new Date(manifest.entitlementBefore) : null, entitlementAfter: manifest.entitlementAfter ? new Date(manifest.entitlementAfter) : null, verifiedAt: new Date(manifest.verifiedAt), attemptCount: options.attempts ?? 0, nextAttemptAt: now, leaseOwner: options.owner ?? null, leaseExpiresAt: options.expiry ?? null, effects: { create: rows } } });
  return { transactionId, finalizationId, effects: Object.fromEntries(rows.map((row) => [row.effectType, row.id])) };
}

async function insertLedgerPair(tx: Prisma.TransactionClient, p: LedgerParams, label: string): Promise<LedgerResult> {
  const common = { transactionId: p.transactionId, transactionType: p.transactionType, amountCentavos: p.amountCentavos, currency: p.currency, sourceEntity: p.sourceEntity, sourceId: p.sourceId, operationKey: p.operationKey, finalizationEffectId: p.finalizationEffectId, description: p.description, effectiveDate: p.effectiveDate, periodId: p.periodId, createdBy: p.createdBy };
  const debitEntry = await tx.financialLedgerEntry.create({ data: { id: ownedId(label + "_debit"), entryNumber: ownedId(label + "_debit_number"), ...common, accountCategory: p.debitCategory, entryType: "DEBIT" } });
  const creditEntry = await tx.financialLedgerEntry.create({ data: { id: ownedId(label + "_credit"), entryNumber: ownedId(label + "_credit_number"), ...common, accountCategory: p.creditCategory, entryType: "CREDIT" } });
  return { debitEntry, creditEntry, isReplay: false };
}
async function createReconciliation(p: ReconciliationParams, status: "MATCHED"|"MISMATCHED" = "MATCHED"): Promise<ReconciliationResult> {
  if (!p.tx) throw new Error("Coordinator omitted transaction client");
  const record = await p.tx.reconciliationRecord.create({ data: { id: ownedId("reconciliation_" + status.toLowerCase()), sourceType: "INTERNAL_TRANSACTION", sourceId: p.transactionId, matchedTransactionId: p.transactionId, finalizationEffectId: p.reconciliationEffectId, status, discrepancyCentavos: status === "MATCHED" ? 0 : 1, discrepancyNotes: status === "MATCHED" ? null : "Slice 8D controlled discrepancy", reconciledAt: new Date() } });
  return status === "MATCHED" ? { outcome: "MATCHED", record, isReplay: false } : { outcome: "DISCREPANCY", record, status: "MISMATCHED", isReplay: false };
}
function makeDependencies(prisma: PrismaClient, label: string, hooks: Hooks = {}): Dependencies {
  let first = true;
  return {
    runInTransaction: async <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) => {
      if (first && hooks.first) { first = false; await hooks.first() } else first = false;
      return prisma.$transaction(operation, { timeout: 25_000, maxWait: 15_000 });
    },
    findDueFinalizationIds: async (now, take) => (await prisma.paymentFinalization.findMany({ where: { id: { startsWith: prefix }, nextAttemptAt: { lte: now } }, select: { id: true }, take })).map((row) => row.id),
    postLedger: hooks.ledger ?? ((p, tx) => insertLedgerPair(tx, p, label)),
    executeReferral: async () => { throw new Error("Unexpected referral executor") },
    executePartnerPair: async () => { throw new Error("Unexpected partner executor") },
    executeTax: async () => { throw new Error("Unexpected tax executor") },
    executeReconciliation: hooks.reconciliation ?? createReconciliation,
  };
}
async function runGroup(letter: Letter, name: string, test: () => Promise<void>): Promise<void> {
  try { await test(); passed++; console.log(`PASS GROUP ${letter}: ${name}`) }
  catch (error) {
    if (error instanceof NotProven) { unproven++; console.log(`NOT PROVEN GROUP ${letter}: ${name} — ${sanitizeRuntimeError(error)}`) }
    else { failed++; console.error(`FAIL GROUP ${letter}: ${name} — ${sanitizeRuntimeError(error)}`) }
  }
}
async function rollback(client: PoolClient): Promise<void> { try { await client.query("ROLLBACK") } catch {} }

async function groupA(pool: Pool): Promise<void> {
  const a = await pool.connect(), b = await pool.connect(), other = await pool.connect();
  try {
    const shared = ownedId("a_shared"), different = ownedId("a_different");
    await a.query("BEGIN"); await a.query(LOCK_SQL, [shared]);
    await b.query("BEGIN");
    let entered = false;
    const contender = b.query(LOCK_SQL, [shared]).then(() => { entered = true });
    await sleep(125); check(!entered, "Contender entered before root lock release");
    await other.query("BEGIN");
    await bounded(other.query(LOCK_SQL, [different]), "Independent root lock", 1_000);
    check(!entered, "Different transaction ID disturbed contention");
    await other.query("COMMIT"); await a.query("COMMIT");
    await bounded(contender, "Contending root lock");
    check(entered, "Contender did not enter after commit");
    await b.query("COMMIT");
  } finally {
    await rollback(a); await rollback(b); await rollback(other);
    a.release(); b.release(); other.release();
  }
}

async function groupB(a: PrismaClient, b: PrismaClient, factory: Factory, plan: Planner): Promise<void> {
  const item = await createFixture(a, plan, { name: "b" });
  const start = new Barrier(2), calls: string[] = [];
  const coordinator = (client: PrismaClient, worker: string) => factory(makeDependencies(client, `b_${worker}`, {
    first: () => start.wait(),
    ledger: async (params, tx) => { calls.push(worker); return insertLedgerPair(tx, params, `b_${worker}`) },
  }));
  const now = new Date();
  const results = await Promise.all([
    coordinator(a, "worker_a").executeFinalization({ finalizationId: item.finalizationId, workerId: "slice8d-worker-a", now }),
    coordinator(b, "worker_b").executeFinalization({ finalizationId: item.finalizationId, workerId: "slice8d-worker-b", now }),
  ]);
  check(results.filter((result) => result.outcome === "COMPLETE").length === 1, "Exactly one worker must complete");
  check(calls.length === 1, "Losing worker executed a financial effect");
  const parent = await a.paymentFinalization.findUniqueOrThrow({ where: { id: item.finalizationId } });
  check(parent.attemptCount === 1, "Winning claim did not increment exactly once");
  check(parent.status === "COMPLETE" && parent.leaseOwner === null, "Winner lifecycle/lease is invalid");
}

async function takeover(prisma: PrismaClient, factory: Factory, plan: Planner, sameWorker: boolean): Promise<void> {
  const oldWorker = sameWorker ? "slice8d-same-worker" : "slice8d-old-worker";
  const newWorker = sameWorker ? oldWorker : "slice8d-new-worker";
  const item = await createFixture(prisma, plan, { name: sameWorker ? "d" : "c", status: "PROCESSING", attempts: 1, owner: oldWorker, expiry: new Date(Date.now() - 60_000) });
  const result = await factory(makeDependencies(prisma, sameWorker ? "d" : "c")).executeFinalization({ finalizationId: item.finalizationId, workerId: newWorker, now: new Date() });
  check(result.outcome === "COMPLETE", "Expired takeover did not complete");
  const parent = await prisma.paymentFinalization.findUniqueOrThrow({ where: { id: item.finalizationId } });
  check(parent.attemptCount === 2, "Takeover did not advance exactly one generation");
  const stale = await prisma.paymentFinalization.updateMany({ where: { id: item.finalizationId, status: "PROCESSING", leaseOwner: oldWorker, attemptCount: 1 }, data: { lastErrorCode: "STALE_WRITE" } });
  check(stale.count === 0, "Stale generation committed lifecycle state");
}

async function groupE(prisma: PrismaClient, factory: Factory, plan: Planner): Promise<void> {
  const item = await createFixture(prisma, plan, { name: "e" });
  const temporary = "SLICE8D_UNCOMMITTED_LIFECYCLE";
  const coordinator = factory(makeDependencies(prisma, "e", {
    ledger: async (params, tx) => {
      await insertLedgerPair(tx, params, "e_rollback");
      await tx.paymentFinalizationEffect.update({ where: { id: params.finalizationEffectId }, data: { lastErrorCode: temporary } });
      throw new Error("Slice 8D deliberate rollback after domain mutation");
    },
  }));
  const result = await coordinator.executeFinalization({ finalizationId: item.finalizationId, workerId: "slice8d-rollback", now: new Date() });
  check(result.outcome === "MANUAL_REVIEW", "Controlled rollback was not classified safely");
  check(await prisma.financialLedgerEntry.count({ where: { transactionId: item.transactionId } }) === 0, "Domain write survived rollback");
  const effect = await prisma.paymentFinalizationEffect.findUniqueOrThrow({ where: { id: item.effects.PAYMENT_LEDGER } });
  check(effect.lastErrorCode !== temporary, "Uncommitted lifecycle write survived rollback");
}

async function rawLedger(client: PoolClient, item: { id: string; number: string; transaction: string; operation: string }): Promise<void> {
  await client.query(`INSERT INTO "FinancialLedgerEntry" (
    "id", "entryNumber", "transactionId", "transactionType", "accountCategory", "entryType",
    "amountCentavos", "currency", "sourceEntity", "sourceId", "operationKey", "description", "effectiveDate"
  ) VALUES ($1,$2,$3,'PAYMENT_RECEIVED','CASH_PAYMONGO','DEBIT',29900,'PHP','Slice8D',$3,$4,'Slice 8D identity race',now())`,
  [item.id, item.number, item.transaction, item.operation]);
}
async function groupF(pool: Pool, item: Fixture): Promise<void> {
  const a = await pool.connect(), b = await pool.connect(), operation = ownedId("f_operation");
  try {
    await a.query("BEGIN"); await b.query("BEGIN");
    await rawLedger(a, { id: ownedId("f_winner"), number: ownedId("f_winner_number"), transaction: item.transactionId, operation });
    let settled = false;
    const loser = rawLedger(b, { id: ownedId("f_loser"), number: ownedId("f_loser_number"), transaction: item.transactionId, operation })
      .then(() => null, (error: unknown) => errorCode(error)).finally(() => { settled = true });
    await sleep(125); check(!settled, "Durable identity race did not contend");
    await a.query("COMMIT");
    check(await bounded(loser, "Unique race") === "23505", "Loser was not a PostgreSQL unique conflict");
    await b.query("ROLLBACK");
    const count = await pool.query<{ count: string }>(`SELECT count(*)::text count FROM "FinancialLedgerEntry" WHERE "operationKey"=$1 AND "entryType"='DEBIT'`, [operation]);
    check(count.rows[0]?.count === "1", "Duplicate durable identity survived");
    const replay = await pool.query(`SELECT "id" FROM "FinancialLedgerEntry" WHERE "operationKey"=$1 AND "entryType"='DEBIT'`, [operation]);
    check(replay.rowCount === 1, "Fresh replay did not converge on existing identity");
  } finally { await rollback(a); await rollback(b); a.release(); b.release() }
}

async function groupG(pool: Pool, item: Fixture): Promise<void> {
  const number = ownedId("g_duplicate_number");
  await pool.query(`INSERT INTO "FinancialLedgerEntry" (
    "id", "entryNumber", "transactionId", "transactionType", "accountCategory", "entryType",
    "amountCentavos", "currency", "sourceEntity", "sourceId", "operationKey", "description", "effectiveDate"
  ) VALUES ($1,$2,$3,'PAYMENT_RECEIVED','CASH_PAYMONGO','DEBIT',29900,'PHP','Slice8D',$3,$4,'Slice 8D abort seed',now())`,
  [ownedId("g_seed"), number, item.transactionId, ownedId("g_seed_operation")]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let violation: string|null = null;
    try { await rawLedger(client, { id: ownedId("g_conflict"), number, transaction: item.transactionId, operation: ownedId("g_conflict_operation") }) }
    catch (error) { violation = errorCode(error) }
    check(violation === "23505", "Deliberate PostgreSQL error not induced");
    let aborted: string|null = null;
    try { await client.query("SELECT 1") } catch (error) { aborted = errorCode(error) }
    check(aborted === "25P02", "SQL was not rejected in aborted transaction");
    await client.query("ROLLBACK");
    const fresh = await client.query<{ recovered: number }>("SELECT 1 AS recovered");
    check(fresh.rows[0]?.recovered === 1, "Recovery did not use a fresh transaction");
  } finally { await rollback(client); client.release() }
}

async function groupH(a: PrismaClient, b: PrismaClient, factory: Factory, plan: Planner): Promise<void> {
  const conflict = await createFixture(a, plan, { name: "h_conflict" });
  const barrier = new Barrier(2);
  const writers = [a, b].map((client) => client.$transaction(async (tx) => {
    const parent = await tx.paymentFinalization.findUniqueOrThrow({ where: { id: conflict.finalizationId } });
    await barrier.wait();
    await tx.paymentFinalization.update({ where: { id: conflict.finalizationId }, data: { attemptCount: parent.attemptCount + 1 } });
  }, { isolationLevel: "Serializable", timeout: 5_000, maxWait: 2_000 }));
  const results = await bounded(Promise.allSettled(writers), "Serializable conflict");
  const actual = results.find((result): result is PromiseRejectedResult => result.status === "rejected" && errorCode(result.reason) === "P2034");
  if (!actual) throw new NotProven("Installed PostgreSQL/Prisma did not reliably surface a real P2034");
  check(results.filter((result) => result.status === "fulfilled").length === 1, "Serializable conflict did not leave one writer");

  const retry = await createFixture(a, plan, { name: "h_retry" });
  const retryResult = await factory(makeDependencies(a, "h_retry", { ledger: async () => Promise.reject(actual.reason) }))
    .executeFinalization({ finalizationId: retry.finalizationId, workerId: "slice8d-p2034-retry", now: new Date() });
  check(retryResult.outcome === "RETRY_SCHEDULED" && retryResult.errorCode === "P2034", "Real P2034 was not classified retryable");
  const ceiling = await createFixture(a, plan, { name: "h_ceiling", attempts: 4 });
  const ceilingResult = await factory(makeDependencies(a, "h_ceiling", { ledger: async () => Promise.reject(actual.reason) }))
    .executeFinalization({ finalizationId: ceiling.finalizationId, workerId: "slice8d-p2034-ceiling", now: new Date() });
  check(ceilingResult.outcome === "MANUAL_REVIEW" && ceilingResult.errorCode === "MAX_ATTEMPTS_EXCEEDED", "P2034 retry ceiling was not bounded");
}

async function groupI(pool: Pool): Promise<void> {
  const a = await pool.connect(), b = await pool.connect();
  const actor = `partner-finance:${ownedId("i_partner")}`;
  try {
    await a.query("BEGIN"); await a.query(LOCK_SQL, [ownedId("i_tx_a")]); await a.query(LOCK_SQL, [actor]);
    await b.query("BEGIN"); await bounded(b.query(LOCK_SQL, [ownedId("i_tx_b")]), "Distinct root lock", 1_000);
    let entered = false;
    const contention = b.query(LOCK_SQL, [actor]).then(() => { entered = true });
    await sleep(125); check(!entered, "Shared actor lock did not serialize distinct transactions");
    await a.query("COMMIT"); await bounded(contention, "Shared actor lock");
    check(entered, "Second transaction never acquired shared actor lock");
    await b.query("COMMIT");
  } finally { await rollback(a); await rollback(b); a.release(); b.release() }
}

async function groupJ(connectionString: string): Promise<void> {
  const timeoutRuntime = await makeRuntime(connectionString, 2);
  try {
    const started = Date.now(); let timeout: string|null = null;
    try { await timeoutRuntime.prisma.$transaction(async (tx) => { await tx.$queryRaw`SELECT pg_sleep(${0.25})` }, { timeout: 100, maxWait: 1_000 }) }
    catch (error) { timeout = errorCode(error) }
    check(timeout !== null, "Reduced isolated transaction timeout was not enforced");
    check(Date.now() - started < 2_000, "Reduced timeout exceeded safe bound");
  } finally { await close(timeoutRuntime) }

  const waitRuntime = await makeRuntime(connectionString, 1);
  let releaseHolder: (() => void)|undefined, announceHolder: (() => void)|undefined;
  const holderReady = new Promise<void>((resolve) => { announceHolder = resolve });
  const release = new Promise<void>((resolve) => { releaseHolder = resolve });
  try {
    const holder = waitRuntime.prisma.$transaction(async (tx) => { await tx.$queryRaw`SELECT 1`; announceHolder?.(); await release }, { timeout: 2_000, maxWait: 1_000 });
    await holderReady;
    let waitError: unknown;
    const waiting = waitRuntime.prisma.$transaction(async (tx) => tx.$queryRaw`SELECT 1`, { timeout: 1_000, maxWait: 100 }).catch((error) => { waitError = error });
    await bounded(waiting, "Reduced maxWait", 1_500);
    check(waitError !== undefined, "Reduced isolated maxWait was not enforced");
    releaseHolder?.(); await bounded(holder, "Held maxWait transaction", 2_000);
  } finally { releaseHolder?.(); await close(waitRuntime) }
}

async function groupK(prisma: PrismaClient, factory: Factory, plan: Planner): Promise<void> {
  const item = await createFixture(prisma, plan, { name: "k", fee: "UNKNOWN" });
  let paymentCalls = 0, reconciliationCalls = 0;
  const coordinator = factory(makeDependencies(prisma, "k", {
    ledger: async (params, tx) => { paymentCalls++; return insertLedgerPair(tx, params, "k_payment") },
    reconciliation: async (params) => { reconciliationCalls++; return createReconciliation(params) },
  }));
  const first = await coordinator.executeFinalization({ finalizationId: item.finalizationId, workerId: "slice8d-awaiting", now: new Date() });
  check(first.outcome === "AWAITING_DATA", "Unknown provider fee did not park");
  const parked = await prisma.paymentFinalization.findUniqueOrThrow({ where: { id: item.finalizationId }, include: { effects: true } });
  const attempts = parked.attemptCount;
  check(parked.effects.find((effect) => effect.effectType === "PROVIDER_FEE_LEDGER")?.attemptCount === 0, "Fee attempt incremented");
  check(parked.effects.find((effect) => effect.effectType === "RECONCILIATION")?.attemptCount === 0, "Reconciliation attempt incremented");
  for (let index = 0; index < 3; index++) {
    const repeated = await coordinator.executeFinalization({ finalizationId: item.finalizationId, workerId: "slice8d-awaiting", now: new Date() });
    check(repeated.outcome === "AWAITING_DATA", "Repeated parked outcome changed");
  }
  const after = await prisma.paymentFinalization.findUniqueOrThrow({ where: { id: item.finalizationId }, include: { effects: true } });
  check(after.attemptCount === attempts, "Repeated calls incremented parent attempts");
  check(after.effects.find((effect) => effect.effectType === "PROVIDER_FEE_LEDGER")?.attemptCount === 0, "Repeated calls incremented fee attempts");
  check(after.effects.find((effect) => effect.effectType === "RECONCILIATION")?.attemptCount === 0, "Repeated calls incremented reconciliation attempts");
  check(paymentCalls === 1 && reconciliationCalls === 0, "Parked call reacquired work or polled an external prerequisite");
}

async function groupL(prisma: PrismaClient, factory: Factory, plan: Planner): Promise<void> {
  const ordered = await createFixture(prisma, plan, { name: "l_order" });
  const calls: string[] = []; let terminal = false;
  const coordinator = factory(makeDependencies(prisma, "l_order", {
    ledger: async (params, tx) => { calls.push("PAYMENT"); return insertLedgerPair(tx, params, "l_order_payment") },
    reconciliation: async (params) => {
      if (!params.tx) throw new Error("Coordinator omitted transaction client");
      const siblings = await params.tx.paymentFinalizationEffect.findMany({ where: { finalizationId: ordered.finalizationId, effectType: { not: "RECONCILIATION" } }, select: { status: true } });
      terminal = siblings.every((effect) => effect.status === "COMPLETE" || effect.status === "NOT_APPLICABLE");
      calls.push("RECONCILIATION");
      return createReconciliation(params);
    },
  }));
  const result = await coordinator.executeFinalization({ finalizationId: ordered.finalizationId, workerId: "slice8d-order", now: new Date() });
  check(result.outcome === "COMPLETE", "Ordered fixture did not complete");
  check(calls.join(",") === "PAYMENT,RECONCILIATION" && terminal, "Reconciliation was not last after committed siblings");

  const discrepancy = await createFixture(prisma, plan, { name: "l_discrepancy", payment: "COMPLETE" });
  const discrepancyResult = await factory(makeDependencies(prisma, "l_discrepancy", { reconciliation: (params) => createReconciliation(params, "MISMATCHED") }))
    .executeFinalization({ finalizationId: discrepancy.finalizationId, workerId: "slice8d-discrepancy", now: new Date() });
  check(discrepancyResult.outcome === "MANUAL_REVIEW", "Discrepancy did not escalate");
  const parent = await prisma.paymentFinalization.findUniqueOrThrow({ where: { id: discrepancy.finalizationId } });
  const effect = await prisma.paymentFinalizationEffect.findUniqueOrThrow({ where: { id: discrepancy.effects.RECONCILIATION } });
  const record = await prisma.reconciliationRecord.findUniqueOrThrow({ where: { finalizationEffectId: discrepancy.effects.RECONCILIATION } });
  check(parent.status === "MANUAL_REVIEW" && effect.status === "MANUAL_REVIEW" && record.status === "MISMATCHED", "Atomic discrepancy state is incomplete");
}

async function cleanup(prisma: PrismaClient): Promise<void> {
  const owned = { startsWith: prefix } as const;
  await prisma.$transaction(async (tx) => {
    await tx.reconciliationRecord.deleteMany({ where: { id: owned } });
    await tx.taxRecord.deleteMany({ where: { id: owned } });
    await tx.partnerCommission.deleteMany({ where: { id: owned } });
    await tx.referralReward.deleteMany({ where: { id: owned } });
    await tx.financialLedgerEntry.deleteMany({ where: { id: owned } });
    await tx.paymentFinalizationEffect.deleteMany({ where: { id: owned } });
    await tx.paymentFinalization.deleteMany({ where: { id: owned } });
    await tx.transaction.deleteMany({ where: { id: owned } });
    await tx.user.deleteMany({ where: { id: owned } });
  });
  check(await prisma.paymentFinalization.count({ where: { id: owned } }) === 0, "Owned cleanup left residue");
}

async function suite(target: SafeTarget): Promise<void> {
  process.env.DATABASE_URL = target.raw;
  const a = await makeRuntime(target.raw, 8), b = await makeRuntime(target.raw, 8);
  let targetAccepted = false;
  try {
    await inspectTarget(a.pool, target);
    targetAccepted = true;
    staticChecks();
    const [coordinatorModule, manifestModule] = await Promise.all([
      import("../lib/payment/paymentFinalizationCoordinator"),
      import("../lib/payment/paymentFinalizationManifestService"),
    ]);
    const factory = coordinatorModule.createPaymentFinalizationCoordinatorForTesting;
    const plan: Planner = (input, dataReader) => manifestModule.PaymentFinalizationManifestService.planFinalization(input, dataReader);
    await runGroup("A", "root advisory lock contention", () => groupA(a.pool));
    await runGroup("B", "concurrent parent claim", () => groupB(a.prisma, b.prisma, factory, plan));
    await runGroup("C", "expired lease takeover", () => takeover(a.prisma, factory, plan, false));
    await runGroup("D", "same-worker-ID stale generation", () => takeover(a.prisma, factory, plan, true));
    await runGroup("E", "real transaction rollback", () => groupE(a.prisma, factory, plan));
    const shared = await createFixture(a.prisma, plan, { name: "fg", payment: "COMPLETE" });
    await runGroup("F", "unique-constraint and replay race", () => groupF(a.pool, shared));
    await runGroup("G", "PostgreSQL aborted transaction behavior", () => groupG(a.pool, shared));
    await runGroup("H", "real P2034 classification and bounded retry", () => groupH(a.prisma, b.prisma, factory, plan));
    await runGroup("I", "multi-transaction shared actor locking", () => groupI(a.pool));
    await runGroup("J", "safe timeout and max-wait equivalents", () => groupJ(target.raw));
    await runGroup("K", "parked AWAITING_DATA", () => groupK(a.prisma, factory, plan));
    await runGroup("L", "reconciliation last and atomic discrepancy", () => groupL(a.prisma, factory, plan));
  } finally {
    try {
      if (targetAccepted) await cleanup(a.prisma);
    } finally {
      await close(b);
      await close(a);
    }
  }
  console.log("SLICE 8D POSTGRESQL RESULT:");
  console.log(`${passed}/12 groups passed`); console.log(`${checks} checks executed`);
  console.log(`${failed} groups failed`); console.log(`${unproven} groups NOT PROVEN`);
  console.log("DATABASE SAFETY:");
  console.log("- isolated URL supplied: YES"); console.log("- equal to DATABASE_URL: NO");
  console.log("- target: " + safeLabel(target)); console.log("- external providers invoked: NO");
  console.log("- production app callers added: NO"); console.log("- schema modified: NO"); console.log("- migration added: NO");
  console.log("LIMITATIONS:");
  for (const item of ["exact 25-second timeout timing (safe reduced equivalent only)", "exact 15-second max-wait timing (safe reduced equivalent only)", "network timeout after commit", "operating-system process kill during transaction", "Neon/PgBouncer and production pool behavior", "regional latency/failover", "real PayMongo callback races", "production load characteristics"]) console.log("- " + item + ": NOT PROVEN");
  if (failed) process.exitCode = 1;
}

async function main(): Promise<void> {
  console.log("SLICE 8D ISOLATED POSTGRESQL COORDINATOR SUITE");
  let target: SafeTarget;
  try { target = gate(process.env) }
  catch (error) {
    console.error("DATABASE SAFETY GATE: REFUSED");
    console.error(sanitizeRuntimeError(error));
    console.error("No PostgreSQL, Prisma adapter, or coordinator runtime module was loaded.");
    process.exitCode = 2;
    return;
  }
  prefix = `slice8d_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  console.log("DATABASE SAFETY GATE: PRE-CONNECTION CHECKS PASSED");
  console.log("Candidate target: " + safeLabel(target));
  await suite(target);
}

void main().catch((error) => {
  console.error("SLICE 8D POSTGRESQL RESULT: FAIL");
  console.error(sanitizeRuntimeError(error));
  process.exitCode = 1;
});
