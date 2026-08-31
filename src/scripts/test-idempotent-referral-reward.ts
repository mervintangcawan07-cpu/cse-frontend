// Relative Path: src/scripts/test-idempotent-referral-reward.ts
/**
 * Synthetic Test Suite: Idempotent Referral Reward Executor (P1-001 / Slice 4)
 *
 * In-memory only. No real database, provider, notification, or production call.
 * Real PostgreSQL lock waiting, abort semantics, and deadlock freedom require a
 * later separately authorized disposable-database test.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  Prisma,
  type PaymentFinalization,
  type PaymentFinalizationEffect,
  type Referral,
  type ReferralAuditLog,
  type ReferralReward,
  type Transaction,
} from "@prisma/client";
import {
  buildPaymentFinalizationOperationKey,
  canonicalizeJson,
  computeSha256Hash,
} from "../lib/payment/paymentFinalizationContracts";
import type {
  ExecuteReferralRewardEffectParams,
  ExecuteReferralRewardEffectResult,
  IdempotentReferralRewardService as ServiceType,
  ReferralRewardExecutionError,
  ReferralRewardExecutionErrorCode,
} from "../lib/referral/idempotentReferralRewardService";

type ServiceClass = typeof ServiceType;

type LoadedEffect = PaymentFinalizationEffect & {
  finalization: PaymentFinalization & {
    transaction: Transaction;
  };
};

interface MockRawCall {
  readonly query: string;
  readonly values: readonly unknown[];
}

interface MockReferralUpdateArgs {
  readonly where: {
    readonly id: string;
    readonly inviterId: string;
    readonly referredUserId: string;
    readonly status: { readonly in: readonly string[] };
    readonly qualifyingPaymentId: null;
  };
  readonly data: {
    readonly status: string;
    readonly qualifyingPaymentId: string;
    readonly qualifyingAmount: number;
    readonly effectiveRate: number;
    readonly rewardAmount: number;
    readonly holdingUntil: Date;
    readonly qualifiedAt: Date;
  };
}

interface MockRewardCreateArgs {
  readonly data: {
    readonly referralId: string;
    readonly inviterId: string;
    readonly referredUserId: string;
    readonly transactionId: string;
    readonly finalizationEffectId: string;
    readonly purchaseAmountCentavos: number;
    readonly rewardType: "PERCENTAGE" | "FIXED_AMOUNT";
    readonly effectiveRate: number;
    readonly rewardAmountCentavos: number;
    readonly currency: string;
    readonly status: "PENDING";
    readonly holdingUntil: Date;
    readonly availableAt: null;
  };
}

interface MockAuditCreateArgs {
  readonly data: {
    readonly actorId?: string | null;
    readonly actorRole?: string | null;
    readonly action: string;
    readonly targetType: string;
    readonly targetId?: string | null;
    readonly previousState?: string | null;
    readonly newState?: string | null;
    readonly amountCentavos?: number | null;
    readonly reason?: string | null;
    readonly metadata?: Prisma.InputJsonValue;
  };
}

interface MockFindRewardArgs {
  readonly where: {
    readonly referralId?: string;
    readonly transactionId?: string;
    readonly finalizationEffectId?: string | null;
  };
}

interface MockFindReferralArgs {
  readonly where: {
    readonly id?: string;
    readonly qualifyingPaymentId?: string | null;
  };
}

let Service: ServiceClass;
let totalGroups = 0;
let passedGroups = 0;
let failedGroups = 0;
let totalChecks = 0;

function check(condition: boolean, description: string): void {
  totalChecks++;
  if (!condition) throw new Error(description);
}

async function group(
  name: string,
  run: () => Promise<void> | void
): Promise<void> {
  totalGroups++;
  try {
    await run();
    passedGroups++;
    console.log(`PASS GROUP ${totalGroups}: ${name}`);
  } catch (error: unknown) {
    failedGroups++;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL GROUP ${totalGroups}: ${name} — ${message}`);
  }
}

function fixedDate(value: string): Date {
  return new Date(value);
}

const IDS = {
  transaction: "txn_referral_slice4_001",
  effect: "effect_referral_slice4_001",
  finalization: "finalization_slice4_001",
  referral: "referral_slice4_001",
  inviter: "inviter_slice4_001",
  referred: "referred_slice4_001",
  checkout: "checkout_slice4_001",
} as const;

const VERIFIED_AT = "2026-08-31T10:00:00.000Z";
const HOLDING_UNTIL = "2026-09-07T10:00:00.000Z";
const OPERATION_KEY = buildPaymentFinalizationOperationKey(
  IDS.transaction,
  { kind: "REFERRAL" }
);

function activeIntent(
  overrides: Record<string, Prisma.JsonValue> = {}
): Prisma.JsonObject {
  return {
    effectType: "REFERRAL_REWARD",
    intentVersion: 1,
    status: "PENDING",
    referralId: IDS.referral,
    inviterId: IDS.inviter,
    referredUserId: IDS.referred,
    purchaseAmountCentavos: 29_900,
    rewardType: "PERCENTAGE",
    rewardRateBasisPoints: 2_000,
    rewardAmountCentavos: 5_980,
    currency: "PHP",
    holdingPeriodDays: 7,
    holdingUntil: HOLDING_UNTIL,
    ...overrides,
  };
}

function notApplicableIntent(
  reason:
    | "NO_REFERRAL_ATTRIBUTION"
    | "PROGRAM_DISABLED"
    | "ZERO_REWARD_CALCULATED"
    | "REFERRAL_ALREADY_REWARDED"
    | "NON_POSITIVE_AMOUNT"
): Prisma.JsonObject {
  const noAttribution = reason === "NO_REFERRAL_ATTRIBUTION";
  const zeroPercentage = reason === "ZERO_REWARD_CALCULATED";
  return {
    effectType: "REFERRAL_REWARD",
    intentVersion: 1,
    status: "NOT_APPLICABLE",
    notApplicableReason: reason,
    referralId: noAttribution ? null : IDS.referral,
    inviterId: noAttribution ? null : IDS.inviter,
    referredUserId: IDS.referred,
    purchaseAmountCentavos: 29_900,
    rewardType: noAttribution ? null : "PERCENTAGE",
    rewardRateBasisPoints: noAttribution ? null : zeroPercentage ? 0 : 2_000,
    rewardAmountCentavos: 0,
    currency: "PHP",
    holdingPeriodDays: noAttribution ? null : 7,
    holdingUntil: null,
  };
}

function makeTransaction(): Transaction {
  return {
    id: IDS.transaction,
    userId: IDS.referred,
    checkoutSessionId: IDS.checkout,
    paymentIntentId: "pay_slice4_001",
    amount: 299,
    grossAmountCentavos: 29_900,
    discountAmountCentavos: 0,
    feeAmountCentavos: 0,
    netSettlementCentavos: 29_900,
    planType: "1_MONTH",
    status: "PAID",
    receiptUrl: null,
    createdAt: fixedDate("2026-08-31T09:59:00.000Z"),
    updatedAt: fixedDate("2026-08-31T10:00:00.000Z"),
  };
}

function makeFinalization(transaction: Transaction): PaymentFinalization {
  return {
    id: IDS.finalization,
    transactionId: IDS.transaction,
    checkoutSessionId: IDS.checkout,
    providerPaymentId: "pay_slice4_001",
    providerPaidAt: fixedDate(VERIFIED_AT),
    source: "WEBHOOK",
    origin: "NEW_PAYMENT",
    status: "PENDING",
    manifestVersion: 1,
    manifestRevision: 1,
    manifestHash: "a".repeat(64),
    planType: "1_MONTH",
    currency: "PHP",
    purchaseAmountCentavos: 29_900,
    feeKnowledge: "UNKNOWN",
    feeAmountCentavos: null,
    feeObservedAt: null,
    entitlementBefore: null,
    entitlementAfter: fixedDate("2026-09-30T10:00:00.000Z"),
    verifiedAt: fixedDate(VERIFIED_AT),
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: fixedDate(VERIFIED_AT),
    leaseOwner: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    manualReviewReasonCode: null,
    completedAt: null,
    createdAt: fixedDate(VERIFIED_AT),
    updatedAt: fixedDate(VERIFIED_AT),
  };
}

function makeEffect(intent: Prisma.JsonValue): LoadedEffect {
  const transaction = makeTransaction();
  const finalization = makeFinalization(transaction);
  return {
    id: IDS.effect,
    finalizationId: IDS.finalization,
    effectType: "REFERRAL_REWARD",
    effectKey: "referral",
    operationKey: OPERATION_KEY,
    status:
      typeof intent === "object" &&
      intent !== null &&
      !Array.isArray(intent) &&
      intent.status === "NOT_APPLICABLE"
        ? "NOT_APPLICABLE"
        : "PENDING",
    intentVersion: 1,
    intent,
    intentHash: computeSha256Hash(canonicalizeJson(intent)),
    referralId:
      typeof intent === "object" &&
      intent !== null &&
      !Array.isArray(intent) &&
      typeof intent.referralId === "string"
        ? intent.referralId
        : null,
    partnerId: null,
    taxConfigId: null,
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: fixedDate(VERIFIED_AT),
    lastErrorCode: null,
    lastErrorMessage: null,
    manualReviewReasonCode: null,
    completedAt: null,
    createdAt: fixedDate(VERIFIED_AT),
    updatedAt: fixedDate(VERIFIED_AT),
    finalization: { ...finalization, transaction },
  };
}

function makeReferral(
  overrides: Partial<Referral> = {}
): Referral {
  return {
    id: IDS.referral,
    inviterId: IDS.inviter,
    referredUserId: IDS.referred,
    referralCodeId: "refcode_slice4_001",
    status: "PENDING_PREMIUM",
    qualifyingPaymentId: null,
    qualifyingAmount: null,
    effectiveRate: null,
    rewardAmount: null,
    holdingUntil: null,
    riskLevel: "LOW_RISK",
    riskNotes: null,
    createdAt: fixedDate("2026-08-20T00:00:00.000Z"),
    qualifiedAt: null,
    availableAt: null,
    updatedAt: fixedDate("2026-08-20T00:00:00.000Z"),
    ...overrides,
  };
}

function makeReward(
  overrides: Partial<ReferralReward> = {}
): ReferralReward {
  return {
    id: "reward_slice4_001",
    referralId: IDS.referral,
    inviterId: IDS.inviter,
    referredUserId: IDS.referred,
    transactionId: IDS.transaction,
    finalizationEffectId: IDS.effect,
    purchaseAmountCentavos: 29_900,
    rewardType: "PERCENTAGE",
    effectiveRate: 20,
    rewardAmountCentavos: 5_980,
    currency: "PHP",
    status: "PENDING",
    holdingUntil: fixedDate(HOLDING_UNTIL),
    availableAt: null,
    reversalReason: null,
    reversedAt: null,
    createdAt: fixedDate(VERIFIED_AT),
    updatedAt: fixedDate(VERIFIED_AT),
    ...overrides,
  };
}

function makeReplayReferral(
  overrides: Partial<Referral> = {}
): Referral {
  return makeReferral({
    status: "REWARD_PENDING",
    qualifyingPaymentId: IDS.transaction,
    qualifyingAmount: 29_900,
    effectiveRate: 20,
    rewardAmount: 5_980,
    holdingUntil: fixedDate(HOLDING_UNTIL),
    qualifiedAt: fixedDate(VERIFIED_AT),
    ...overrides,
  });
}

function renderRaw(
  strings: TemplateStringsArray,
  values: readonly unknown[]
): string {
  let output = strings[0];
  for (let index = 0; index < values.length; index++) {
    output += String(values[index]) + strings[index + 1];
  }
  return output.replace(/\s+/g, " ").trim();
}

class MockReferralTransactionClient {
  public effect: LoadedEffect;
  public referrals: Referral[];
  public rewards: ReferralReward[];
  public audits: ReferralAuditLog[] = [];
  public rawCalls: MockRawCall[] = [];
  public advisoryLocks: string[] = [];
  public rewardRowLocks: string[] = [];
  public referralRowLocks: string[] = [];
  public effectRowLocks: string[] = [];
  public readCallCount = 0;
  public writeCallCount = 0;
  public postAbortCallCount = 0;
  public transactionRunCount = 0;
  public simulateP2002At: "cas" | "reward" | null = null;
  public simulateP2002Target: unknown = ["qualifyingPaymentId"];
  public simulateAuditFailure = false;
  public forceCasCount: number | null = null;
  private aborted = false;
  private nextRewardNumber = 10;
  private nextAuditNumber = 10;

  constructor(options?: {
    readonly intent?: Prisma.JsonValue;
    readonly referrals?: Referral[];
    readonly rewards?: ReferralReward[];
  }) {
    this.effect = makeEffect(options?.intent ?? activeIntent());
    this.referrals = options?.referrals
      ? structuredClone(options.referrals)
      : [makeReferral()];
    this.rewards = options?.rewards
      ? structuredClone(options.rewards)
      : [];
  }

  public asTransactionClient(): Prisma.TransactionClient {
    return this as unknown as Prisma.TransactionClient;
  }

  public resetTelemetry(): void {
    this.rawCalls = [];
    this.advisoryLocks = [];
    this.rewardRowLocks = [];
    this.referralRowLocks = [];
    this.effectRowLocks = [];
    this.readCallCount = 0;
    this.writeCallCount = 0;
    this.postAbortCallCount = 0;
    this.aborted = false;
  }

  private beforeDatabaseCall(write: boolean): void {
    if (this.aborted) {
      this.postAbortCallCount++;
      throw new Error("Synthetic client was used after transaction abort.");
    }
    if (write) this.writeCallCount++;
    else this.readCallCount++;
  }

  private throwP2002(): never {
    this.aborted = true;
    throw {
      code: "P2002",
      meta: { target: this.simulateP2002Target },
    };
  }

  public async $queryRaw(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<unknown> {
    this.beforeDatabaseCall(false);
    const query = renderRaw(strings, values);
    this.rawCalls.push({ query, values });

    if (query.includes("pg_advisory_xact_lock")) {
      const lockName = values[0];
      if (typeof lockName === "string") this.advisoryLocks.push(lockName);
    } else if (query.includes('FROM "ReferralReward"')) {
      const rowId = values[0];
      if (typeof rowId === "string") this.rewardRowLocks.push(rowId);
    } else if (query.includes('FROM "Referral"')) {
      const rowId = values[0];
      if (typeof rowId === "string") this.referralRowLocks.push(rowId);
    } else if (query.includes('FROM "PaymentFinalizationEffect"')) {
      const rowId = values[0];
      if (typeof rowId === "string") this.effectRowLocks.push(rowId);
    }

    return [];
  }

  public paymentFinalizationEffect = {
    findUnique: async (): Promise<LoadedEffect | null> => {
      this.beforeDatabaseCall(false);
      return structuredClone(this.effect);
    },
  };

  public referralReward = {
    findUnique: async (
      args: MockFindRewardArgs
    ): Promise<ReferralReward | null> => {
      this.beforeDatabaseCall(false);
      if (args.where.referralId !== undefined) {
        return (
          this.rewards.find((row) => row.referralId === args.where.referralId) ??
          null
        );
      }
      if (args.where.transactionId !== undefined) {
        return (
          this.rewards.find(
            (row) => row.transactionId === args.where.transactionId
          ) ?? null
        );
      }
      return (
        this.rewards.find(
          (row) =>
            row.finalizationEffectId === args.where.finalizationEffectId
        ) ?? null
      );
    },

    create: async (
      args: MockRewardCreateArgs
    ): Promise<ReferralReward> => {
      this.beforeDatabaseCall(true);
      if (this.simulateP2002At === "reward") this.throwP2002();
      const created: ReferralReward = {
        id: `reward_slice4_${this.nextRewardNumber++}`,
        ...args.data,
        reversalReason: null,
        reversedAt: null,
        createdAt: fixedDate("2026-08-31T10:00:01.000Z"),
        updatedAt: fixedDate("2026-08-31T10:00:01.000Z"),
      };
      this.rewards.push(created);
      return structuredClone(created);
    },
  };

  public referral = {
    findUnique: async (
      args: MockFindReferralArgs
    ): Promise<Referral | null> => {
      this.beforeDatabaseCall(false);
      if (args.where.id !== undefined) {
        return this.referrals.find((row) => row.id === args.where.id) ?? null;
      }
      return (
        this.referrals.find(
          (row) =>
            row.qualifyingPaymentId === args.where.qualifyingPaymentId
        ) ?? null
      );
    },

    updateMany: async (
      args: MockReferralUpdateArgs
    ): Promise<{ count: number }> => {
      this.beforeDatabaseCall(true);
      if (this.simulateP2002At === "cas") this.throwP2002();
      if (this.forceCasCount !== null) return { count: this.forceCasCount };

      const referral = this.referrals.find(
        (row) =>
          row.id === args.where.id &&
          row.inviterId === args.where.inviterId &&
          row.referredUserId === args.where.referredUserId &&
          args.where.status.in.includes(row.status) &&
          row.qualifyingPaymentId === null
      );
      if (!referral) return { count: 0 };

      Object.assign(referral, args.data, {
        updatedAt: fixedDate("2026-08-31T10:00:01.000Z"),
      });
      return { count: 1 };
    },
  };

  public referralAuditLog = {
    create: async (
      args: MockAuditCreateArgs
    ): Promise<ReferralAuditLog> => {
      this.beforeDatabaseCall(true);
      if (this.simulateAuditFailure) {
        throw new Error("Synthetic audit failure.");
      }
      const audit: ReferralAuditLog = {
        id: `audit_slice4_${this.nextAuditNumber++}`,
        actorId: args.data.actorId ?? null,
        actorRole: args.data.actorRole ?? null,
        action: args.data.action,
        targetType: args.data.targetType,
        targetId: args.data.targetId ?? null,
        previousState: args.data.previousState ?? null,
        newState: args.data.newState ?? null,
        amountCentavos: args.data.amountCentavos ?? null,
        reason: args.data.reason ?? null,
        metadata: (args.data.metadata ?? null) as Prisma.JsonValue,
        ipAddress: null,
        createdAt: fixedDate("2026-08-31T10:00:01.000Z"),
      };
      this.audits.push(audit);
      return structuredClone(audit);
    },
  };

  public async runTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    this.transactionRunCount++;
    const referralSnapshot = structuredClone(this.referrals);
    const rewardSnapshot = structuredClone(this.rewards);
    const auditSnapshot = structuredClone(this.audits);
    this.aborted = false;
    try {
      return await callback(this.asTransactionClient());
    } catch (error: unknown) {
      this.referrals = referralSnapshot;
      this.rewards = rewardSnapshot;
      this.audits = auditSnapshot;
      throw error;
    }
  }
}

function rehash(mock: MockReferralTransactionClient): void {
  mock.effect.intentHash = computeSha256Hash(
    canonicalizeJson(mock.effect.intent)
  );
}

function setIntent(
  mock: MockReferralTransactionClient,
  intent: Prisma.JsonValue
): void {
  mock.effect.intent = intent;
  mock.effect.referralId =
    typeof intent === "object" &&
    intent !== null &&
    !Array.isArray(intent) &&
    typeof intent.referralId === "string"
      ? intent.referralId
      : null;
  rehash(mock);
}

function addExactReplay(
  mock: MockReferralTransactionClient,
  status: ReferralReward["status"] = "PENDING"
): void {
  mock.referrals = [makeReplayReferral()];
  mock.rewards = [makeReward({ status })];
}

function executionParams(
  mock: MockReferralTransactionClient,
  overrides: Partial<ExecuteReferralRewardEffectParams> = {}
): ExecuteReferralRewardEffectParams {
  return {
    transactionId: IDS.transaction,
    finalizationEffectId: IDS.effect,
    tx: mock.asTransactionClient(),
    ...overrides,
  };
}

async function execute(
  mock: MockReferralTransactionClient,
  overrides: Partial<ExecuteReferralRewardEffectParams> = {}
): Promise<ExecuteReferralRewardEffectResult> {
  return Service.executeReferralRewardEffect(executionParams(mock, overrides));
}

async function expectCode(
  mock: MockReferralTransactionClient,
  code: ReferralRewardExecutionErrorCode,
  overrides: Partial<ExecuteReferralRewardEffectParams> = {}
): Promise<ReferralRewardExecutionError> {
  try {
    await execute(mock, overrides);
  } catch (error: unknown) {
    const candidate = error as Partial<ReferralRewardExecutionError>;
    check(candidate.code === code, `Expected ${code}, received ${String(candidate.code)}`);
    return error as ReferralRewardExecutionError;
  }
  throw new Error(`Expected ${code}, but execution succeeded.`);
}

function sourceFiles(directory: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...sourceFiles(absolute));
    } else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) {
      results.push(absolute);
    }
  }
  return results;
}

async function loadPrismaModule(): Promise<typeof import("../lib/prisma")> {
  const moduleUrl = pathToFileURL(
    path.join(process.cwd(), "src/lib/prisma.ts")
  ).href;
  return import(moduleUrl) as Promise<typeof import("../lib/prisma")>;
}

async function runSuite(): Promise<void> {
  process.env.DATABASE_URL ??=
    "postgresql://synthetic:synthetic@localhost:5432/synthetic";
  const serviceModule = await import(
    "../lib/referral/idempotentReferralRewardService"
  );
  Service = serviceModule.IdempotentReferralRewardService;

  console.log("============================================================");
  console.log("SYNTHETIC SLICE 4 IDEMPOTENT REFERRAL REWARD SUITE");
  console.log("============================================================");

  await group("fresh percentage reward is atomic and deterministic", async () => {
    const mock = new MockReferralTransactionClient();
    const result = await execute(mock);
    check(result.outcome === "CREATED", "Fresh execution must create a reward.");
    check(mock.rewards.length === 1, "Exactly one reward must be stored.");
    check(mock.audits.length === 1, "Exactly one audit must be stored.");
    const referral = mock.referrals[0];
    check(referral.status === "REWARD_PENDING", "Referral must become REWARD_PENDING.");
    check(referral.qualifyingPaymentId === IDS.transaction, "Qualifying payment must be set.");
    check(referral.qualifiedAt?.toISOString() === VERIFIED_AT, "qualifiedAt must use verifiedAt.");
    check(referral.holdingUntil?.toISOString() === HOLDING_UNTIL, "Referral holding time must match intent.");
    check(mock.rewards[0].rewardType === "PERCENTAGE", "Percentage type must persist.");
    check(mock.rewards[0].effectiveRate === 20, "Basis points must derive persisted rate.");
    check(mock.rewards[0].status === "PENDING", "Fresh reward must start PENDING.");
    check(mock.rewards[0].availableAt === null, "Fresh reward availableAt must be null.");
  });

  await group("fresh fixed reward maps FIXED to FIXED_AMOUNT", async () => {
    const mock = new MockReferralTransactionClient({
      intent: activeIntent({
        rewardType: "FIXED",
        rewardRateBasisPoints: 0,
        rewardAmountCentavos: 5_000,
      }),
    });
    const result = await execute(mock);
    check(result.outcome === "CREATED", "Fixed reward must be created.");
    check(mock.rewards[0].rewardType === "FIXED_AMOUNT", "FIXED must map to FIXED_AMOUNT.");
    check(mock.rewards[0].effectiveRate === 0, "Fixed reward persisted rate must be zero.");
    check(mock.rewards[0].rewardAmountCentavos === 5_000, "Fixed amount must come from intent.");
  });

  await group("all actual reward lifecycle states replay without downgrade", async () => {
    const statuses: ReferralReward["status"][] = [
      "PENDING",
      "AVAILABLE",
      "PAID",
      "REVERSED",
      "REFUNDED",
      "CANCELLED",
    ];
    for (const status of statuses) {
      const mock = new MockReferralTransactionClient();
      addExactReplay(mock, status);
      const result = await execute(mock);
      check(result.outcome === "REPLAY", `${status} must replay.`);
      check(mock.rewards[0].status === status, `${status} must be preserved.`);
      check(mock.writeCallCount === 0, `${status} replay must have zero writes.`);
      check(mock.audits.length === 0, `${status} replay must have zero audit writes.`);
    }
  });

  await group("legacy null-effect reward requires Slice 7 classification", async () => {
    const legacy = makeReward({ finalizationEffectId: null });
    const mock = new MockReferralTransactionClient({
      referrals: [makeReplayReferral()],
      rewards: [legacy],
    });
    await expectCode(mock, "LEGACY_REWARD_REQUIRES_CLASSIFICATION");
    check(mock.writeCallCount === 0, "Legacy classification must not write.");
    check(mock.rewards[0].finalizationEffectId === null, "Legacy row must remain unattached.");
  });

  await group("partial and cross-dimensional reward identities fail closed", async () => {
    const cases: Array<{ readonly name: string; readonly rows: ReferralReward[] }> = [
      {
        name: "referral identity only",
        rows: [makeReward({ transactionId: "txn_other", finalizationEffectId: "effect_other" })],
      },
      {
        name: "transaction identity only",
        rows: [makeReward({ referralId: "ref_other", finalizationEffectId: "effect_other" })],
      },
      {
        name: "effect identity only",
        rows: [makeReward({ referralId: "ref_other", transactionId: "txn_other" })],
      },
      {
        name: "same referral different transaction",
        rows: [makeReward({ transactionId: "txn_other" })],
      },
      {
        name: "same transaction different referral",
        rows: [makeReward({ referralId: "ref_other" })],
      },
      {
        name: "same effect different referral",
        rows: [makeReward({ referralId: "ref_other" })],
      },
      {
        name: "three different rows",
        rows: [
          makeReward({ id: "row_c", transactionId: "txn_c", finalizationEffectId: "eff_c" }),
          makeReward({ id: "row_a", referralId: "ref_a", finalizationEffectId: "eff_a" }),
          makeReward({ id: "row_b", referralId: "ref_b", transactionId: IDS.transaction, finalizationEffectId: "eff_b" }),
          makeReward({ id: "row_d", referralId: "ref_d", transactionId: "txn_d", finalizationEffectId: IDS.effect }),
        ],
      },
    ];

    for (const testCase of cases) {
      const mock = new MockReferralTransactionClient({ rewards: testCase.rows });
      await expectCode(mock, "REWARD_IDENTITY_CONFLICT");
      check(mock.writeCallCount === 0, `${testCase.name} must not write.`);
    }
  });

  await group("immutable replay mismatch fails closed", async () => {
    const mock = new MockReferralTransactionClient();
    addExactReplay(mock);
    mock.rewards[0].rewardAmountCentavos++;
    await expectCode(mock, "REWARD_IDENTITY_CONFLICT");
    check(mock.rewards[0].status === "PENDING", "Mismatch must not mutate reward.");
  });

  await group("effect type, key, operation key, and versions are closed", async () => {
    const wrongType = new MockReferralTransactionClient();
    wrongType.effect.effectType = "PAYMENT_LEDGER";
    await expectCode(wrongType, "WRONG_EFFECT_TYPE");

    const wrongKey = new MockReferralTransactionClient();
    wrongKey.effect.effectKey = "other";
    await expectCode(wrongKey, "MANIFEST_LINKAGE_MISMATCH");

    const wrongOperation = new MockReferralTransactionClient();
    wrongOperation.effect.operationKey = "pfin:wrong:referral";
    await expectCode(wrongOperation, "MANIFEST_LINKAGE_MISMATCH");

    const unsupported = new MockReferralTransactionClient();
    unsupported.effect.intentVersion = 2;
    await expectCode(unsupported, "UNSUPPORTED_INTENT_VERSION");

    const mismatch = new MockReferralTransactionClient();
    const mismatchedIntent = activeIntent({ intentVersion: 2 });
    setIntent(mismatch, mismatchedIntent);
    await expectCode(mismatch, "UNSUPPORTED_INTENT_VERSION");
  });

  await group("malformed, missing, extra, and hash-mismatched intents fail", async () => {
    const malformed = new MockReferralTransactionClient();
    malformed.effect.intent = [];
    malformed.effect.intentHash = computeSha256Hash(canonicalizeJson([]));
    await expectCode(malformed, "INVALID_IMMUTABLE_INTENT");

    const missing = new MockReferralTransactionClient();
    const missingIntent = activeIntent();
    delete missingIntent.currency;
    setIntent(missing, missingIntent);
    await expectCode(missing, "INVALID_IMMUTABLE_INTENT");

    const extra = new MockReferralTransactionClient();
    setIntent(extra, activeIntent({ extraField: "forbidden" }));
    await expectCode(extra, "INVALID_IMMUTABLE_INTENT");

    const hashMismatch = new MockReferralTransactionClient();
    hashMismatch.effect.intentHash = "b".repeat(64);
    await expectCode(hashMismatch, "INTENT_HASH_MISMATCH");
  });

  await group("manifest, transaction, purchase, and currency linkage is exact", async () => {
    const badManifest = new MockReferralTransactionClient();
    badManifest.effect.finalization.manifestVersion = 2;
    await expectCode(badManifest, "MANIFEST_LINKAGE_MISMATCH");

    const badManifestHash = new MockReferralTransactionClient();
    badManifestHash.effect.finalization.manifestHash = "not-a-hash";
    await expectCode(badManifestHash, "MANIFEST_LINKAGE_MISMATCH");

    const wrongTransaction = new MockReferralTransactionClient();
    await expectCode(wrongTransaction, "TRANSACTION_IDENTITY_MISMATCH", {
      transactionId: "txn_requested_other",
    });

    const wrongOwner = new MockReferralTransactionClient();
    wrongOwner.effect.finalization.transaction.userId = "user_other";
    await expectCode(wrongOwner, "TRANSACTION_IDENTITY_MISMATCH");

    const wrongPurchase = new MockReferralTransactionClient();
    wrongPurchase.effect.finalization.purchaseAmountCentavos = 1;
    await expectCode(wrongPurchase, "MANIFEST_LINKAGE_MISMATCH");

    const wrongCurrency = new MockReferralTransactionClient();
    wrongCurrency.effect.finalization.currency = "USD";
    await expectCode(wrongCurrency, "MANIFEST_LINKAGE_MISMATCH");
  });

  await group("referral, inviter, and referred-user identities are exact", async () => {
    const missingReferral = new MockReferralTransactionClient({ referrals: [] });
    await expectCode(missingReferral, "REFERRAL_NOT_FOUND");

    const inviterMismatch = new MockReferralTransactionClient({
      referrals: [makeReferral({ inviterId: "inviter_other" })],
    });
    await expectCode(inviterMismatch, "REFERRAL_IDENTITY_MISMATCH");

    const referredMismatch = new MockReferralTransactionClient({
      referrals: [makeReferral({ referredUserId: "referred_other" })],
    });
    await expectCode(referredMismatch, "REFERRAL_IDENTITY_MISMATCH");

    const effectReferralMismatch = new MockReferralTransactionClient();
    effectReferralMismatch.effect.referralId = "referral_other";
    await expectCode(effectReferralMismatch, "MANIFEST_LINKAGE_MISMATCH");
  });

  await group("amount, basis-point, fixed-rate, and currency validation is strict", async () => {
    const cases: Array<Prisma.JsonObject> = [
      activeIntent({ rewardAmountCentavos: 0 }),
      activeIntent({ purchaseAmountCentavos: 0 }),
      activeIntent({ rewardRateBasisPoints: -1 }),
      activeIntent({ rewardRateBasisPoints: 10_001 }),
      activeIntent({ rewardType: "FIXED", rewardRateBasisPoints: 1 }),
      activeIntent({ currency: "USD" }),
    ];
    for (const intent of cases) {
      const mock = new MockReferralTransactionClient({ intent });
      await expectCode(mock, "INVALID_IMMUTABLE_INTENT");
    }

    const fractionalBasisPoints = new MockReferralTransactionClient();
    fractionalBasisPoints.effect.intent = activeIntent({
      rewardRateBasisPoints: 1.5,
    });
    await expectCode(fractionalBasisPoints, "INVALID_IMMUTABLE_INTENT");
  });

  await group("holding period and timestamp validation is deterministic", async () => {
    const invalidDays = new MockReferralTransactionClient({
      intent: activeIntent({ holdingPeriodDays: -1 }),
    });
    await expectCode(invalidDays, "INVALID_IMMUTABLE_INTENT");

    const fractionalDays = new MockReferralTransactionClient();
    fractionalDays.effect.intent = activeIntent({ holdingPeriodDays: 1.5 });
    await expectCode(fractionalDays, "INVALID_IMMUTABLE_INTENT");

    const invalidTime = new MockReferralTransactionClient({
      intent: activeIntent({ holdingUntil: "not-a-time" }),
    });
    await expectCode(invalidTime, "INVALID_IMMUTABLE_INTENT");

    const mismatchedTime = new MockReferralTransactionClient({
      intent: activeIntent({ holdingUntil: "2026-09-08T10:00:00.000Z" }),
    });
    await expectCode(mismatchedTime, "INVALID_IMMUTABLE_INTENT");

    const zeroDays = new MockReferralTransactionClient({
      intent: activeIntent({ holdingPeriodDays: 0, holdingUntil: VERIFIED_AT }),
    });
    const result = await execute(zeroDays);
    check(result.outcome === "CREATED", "Zero holding days must be valid.");
    check(zeroDays.referrals[0].qualifiedAt?.toISOString() === VERIFIED_AT, "qualifiedAt must be deterministic.");
    check(zeroDays.rewards[0].holdingUntil?.toISOString() === VERIFIED_AT, "Zero-day holding must equal verifiedAt.");
  });

  await group("percentage calculation preserves JavaScript v1 ordering", async () => {
    const mock = new MockReferralTransactionClient({
      intent: activeIntent({
        purchaseAmountCentavos: 13_423_625,
        rewardRateBasisPoints: 3_880,
        rewardAmountCentavos: 5_208_366,
      }),
    });
    mock.effect.finalization.purchaseAmountCentavos = 13_423_625;
    const result = await execute(mock);
    check(result.outcome === "CREATED", "38.80% regression must execute.");
    check(mock.rewards[0].rewardAmountCentavos === 5_208_366, "Regression amount must remain 5,208,366.");
    check(
      Math.round((13_423_625 * (3_880 / 100)) / 100) === 5_208_366,
      "Planner-compatible expression must produce regression value."
    );
  });

  await group("four reachable NOT_APPLICABLE reasons produce zero writes", async () => {
    const reasons = [
      "NO_REFERRAL_ATTRIBUTION",
      "PROGRAM_DISABLED",
      "ZERO_REWARD_CALCULATED",
      "REFERRAL_ALREADY_REWARDED",
    ] as const;

    for (const reason of reasons) {
      const referrals = reason === "NO_REFERRAL_ATTRIBUTION" ? [] : [makeReferral()];
      const mock = new MockReferralTransactionClient({
        intent: notApplicableIntent(reason),
        referrals,
      });
      const result = await execute(mock);
      check(result.outcome === "NOT_APPLICABLE", `${reason} must return no-op.`);
      check(
        result.outcome === "NOT_APPLICABLE" && result.reason === reason,
        `${reason} must be returned exactly.`
      );
      check(mock.writeCallCount === 0, `${reason} must produce zero writes.`);
      check(mock.audits.length === 0, `${reason} must produce zero audits.`);
    }
  });

  await group("v1 NON_POSITIVE_AMOUNT is rejected", async () => {
    const mock = new MockReferralTransactionClient({
      intent: notApplicableIntent("NON_POSITIVE_AMOUNT"),
    });
    await expectCode(mock, "INVALID_IMMUTABLE_INTENT");
    check(mock.writeCallCount === 0, "Unreachable reason must not write.");
  });

  await group("NOT_APPLICABLE shape and reward linkage fail closed", async () => {
    const wrongStatus = new MockReferralTransactionClient({
      intent: notApplicableIntent("PROGRAM_DISABLED"),
    });
    wrongStatus.effect.status = "PENDING";
    await expectCode(wrongStatus, "INVALID_LIFECYCLE");

    const wrongShape = new MockReferralTransactionClient({
      intent: {
        ...notApplicableIntent("NO_REFERRAL_ATTRIBUTION"),
        referralId: IDS.referral,
      },
    });
    await expectCode(wrongShape, "INVALID_IMMUTABLE_INTENT");

    const attachedReward = new MockReferralTransactionClient({
      intent: notApplicableIntent("PROGRAM_DISABLED"),
      rewards: [makeReward()],
    });
    await expectCode(attachedReward, "REWARD_IDENTITY_CONFLICT");
  });

  await group("effect lifecycle rules distinguish fresh and replay-only", async () => {
    for (const status of ["PENDING", "FAILED_RETRYABLE"] as const) {
      const fresh = new MockReferralTransactionClient();
      fresh.effect.status = status;
      check((await execute(fresh)).outcome === "CREATED", `${status} must allow fresh.`);

      const replay = new MockReferralTransactionClient();
      replay.effect.status = status;
      addExactReplay(replay);
      check((await execute(replay)).outcome === "REPLAY", `${status} must allow replay.`);
    }

    const completeReplay = new MockReferralTransactionClient();
    completeReplay.effect.status = "COMPLETE";
    addExactReplay(completeReplay, "AVAILABLE");
    check((await execute(completeReplay)).outcome === "REPLAY", "COMPLETE must replay exact reward.");

    const completeFresh = new MockReferralTransactionClient();
    completeFresh.effect.status = "COMPLETE";
    await expectCode(completeFresh, "INVALID_LIFECYCLE");

    for (const status of ["AWAITING_DATA", "MANUAL_REVIEW"] as const) {
      const mock = new MockReferralTransactionClient();
      mock.effect.status = status;
      await expectCode(mock, "INVALID_LIFECYCLE");
    }
  });

  await group("parent lifecycle rules are replay-only or rejected", async () => {
    const completeReplay = new MockReferralTransactionClient();
    completeReplay.effect.finalization.status = "COMPLETE";
    addExactReplay(completeReplay, "PAID");
    check((await execute(completeReplay)).outcome === "REPLAY", "Parent COMPLETE must replay.");

    const completeFresh = new MockReferralTransactionClient();
    completeFresh.effect.finalization.status = "COMPLETE";
    await expectCode(completeFresh, "INVALID_LIFECYCLE");

    const manual = new MockReferralTransactionClient();
    manual.effect.finalization.status = "MANUAL_REVIEW";
    await expectCode(manual, "INVALID_LIFECYCLE");
  });

  await group("fresh Referral CAS permits only reviewed precursor states", async () => {
    for (const status of ["PENDING_PREMIUM", "QUALIFIED"] as const) {
      const mock = new MockReferralTransactionClient({
        referrals: [makeReferral({ status, qualifyingPaymentId: null })],
      });
      check((await execute(mock)).outcome === "CREATED", `${status} with null owner must be eligible.`);
    }

    for (const status of [
      "REWARD_PENDING",
      "AVAILABLE",
      "PAID",
      "REJECTED",
      "CANCELLED",
      "REFUNDED",
      "REVERSED",
      "SUSPICIOUS",
    ] as const) {
      const mock = new MockReferralTransactionClient({
        referrals: [makeReferral({ status })],
      });
      await expectCode(mock, "INVALID_LIFECYCLE");
    }
  });

  await group("qualifying-payment identity state machine is closed", async () => {
    const fresh = new MockReferralTransactionClient();
    check((await execute(fresh)).outcome === "CREATED", "Null owner must allow fresh.");

    const legacy = new MockReferralTransactionClient({
      referrals: [makeReplayReferral()],
      rewards: [makeReward({ finalizationEffectId: null })],
    });
    await expectCode(legacy, "LEGACY_REWARD_REQUIRES_CLASSIFICATION");

    const missingReward = new MockReferralTransactionClient({
      referrals: [makeReplayReferral()],
    });
    await expectCode(missingReward, "REFERRAL_QUALIFYING_PAYMENT_PARTIAL_STATE");

    const otherOwner = makeReferral({
      id: "referral_other_owner",
      referredUserId: "referred_other_owner",
      qualifyingPaymentId: IDS.transaction,
    });
    const ownerConflict = new MockReferralTransactionClient({
      referrals: [makeReferral(), otherOwner],
    });
    await expectCode(ownerConflict, "REFERRAL_QUALIFYING_PAYMENT_CONFLICT");

    const otherTransaction = new MockReferralTransactionClient({
      referrals: [makeReferral({ qualifyingPaymentId: "txn_other" })],
    });
    await expectCode(otherTransaction, "REFERRAL_IDENTITY_MISMATCH");

    const exact = new MockReferralTransactionClient();
    addExactReplay(exact);
    check((await execute(exact)).outcome === "REPLAY", "Exact owner and reward must replay.");

    const conflicting = new MockReferralTransactionClient({
      referrals: [makeReplayReferral()],
      rewards: [makeReward({ rewardAmountCentavos: 1 })],
    });
    await expectCode(conflicting, "REWARD_IDENTITY_CONFLICT");

    const reversePartial = new MockReferralTransactionClient({
      referrals: [makeReferral()],
      rewards: [makeReward()],
    });
    await expectCode(reversePartial, "REFERRAL_QUALIFYING_PAYMENT_PARTIAL_STATE");
  });

  await group("CAS count other than one fails before Reward and audit", async () => {
    const mock = new MockReferralTransactionClient();
    mock.forceCasCount = 0;
    await expectCode(mock, "INVALID_LIFECYCLE");
    check(mock.rewards.length === 0, "Failed CAS must not create Reward.");
    check(mock.audits.length === 0, "Failed CAS must not create audit.");
  });

  await group("exact P2002 recognizer accepts only four identities", () => {
    const approvedArrays = [
      ["referralId"],
      ["transactionId"],
      ["finalizationEffectId"],
      ["qualifyingPaymentId"],
    ];
    const approvedStrings = [
      "ReferralReward_referralId_key",
      "ReferralReward_transactionId_key",
      "ReferralReward_finalizationEffectId_key",
      "Referral_qualifyingPaymentId_key",
    ];

    for (const target of [...approvedArrays, ...approvedStrings]) {
      check(
        serviceModule.isReferralRewardIdentityP2002Error({
          code: "P2002",
          meta: { target },
        }),
        `Approved target ${JSON.stringify(target)} must match.`
      );
    }

    const rejected = [
      ["referralId", "transactionId"],
      ["referredUserId"],
      "Referral_referredUserId_key",
      "prefix_ReferralReward_referralId_key_suffix",
      null,
    ];
    for (const target of rejected) {
      check(
        !serviceModule.isReferralRewardIdentityP2002Error({
          code: "P2002",
          meta: { target },
        }),
        `Unapproved target ${JSON.stringify(target)} must not match.`
      );
    }
    check(
      !serviceModule.isReferralRewardIdentityP2002Error({
        code: "P2025",
        meta: { target: ["referralId"] },
      }),
      "Non-P2002 errors must not match."
    );
  });

  await group("approved runtime P2002 errors stop immediately", async () => {
    const cases: Array<{
      readonly at: "cas" | "reward";
      readonly target: unknown;
    }> = [
      { at: "cas", target: ["qualifyingPaymentId"] },
      { at: "reward", target: ["referralId"] },
      { at: "reward", target: ["transactionId"] },
      { at: "reward", target: ["finalizationEffectId"] },
      { at: "cas", target: "Referral_qualifyingPaymentId_key" },
      { at: "reward", target: "ReferralReward_referralId_key" },
      { at: "reward", target: "ReferralReward_transactionId_key" },
      { at: "reward", target: "ReferralReward_finalizationEffectId_key" },
    ];

    for (const testCase of cases) {
      const mock = new MockReferralTransactionClient();
      mock.simulateP2002At = testCase.at;
      mock.simulateP2002Target = testCase.target;
      await expectCode(mock, "CONCURRENT_IDENTITY_CONFLICT");
      check(mock.postAbortCallCount === 0, "No query or write may follow P2002.");
      check(mock.audits.length === 0, "P2002 must produce zero audit writes.");
    }
  });

  await group("unrelated P2002 is a database failure with zero follow-up", async () => {
    const mock = new MockReferralTransactionClient();
    mock.simulateP2002At = "cas";
    mock.simulateP2002Target = ["referredUserId"];
    await expectCode(mock, "DATABASE_EXECUTION_FAILED");
    check(mock.postAbortCallCount === 0, "Unrelated P2002 must have zero follow-up calls.");
    check(mock.audits.length === 0, "Unrelated P2002 must have zero audit writes.");
  });

  await group("outer retry classifies persistent qualifying conflict", async () => {
    const mock = new MockReferralTransactionClient();
    mock.simulateP2002At = "cas";
    await expectCode(mock, "CONCURRENT_IDENTITY_CONFLICT");

    mock.simulateP2002At = null;
    mock.resetTelemetry();
    mock.referrals.push(
      makeReferral({
        id: "referral_committed_competitor",
        referredUserId: "referred_committed_competitor",
        qualifyingPaymentId: IDS.transaction,
      })
    );
    await expectCode(mock, "REFERRAL_QUALIFYING_PAYMENT_CONFLICT");
    check(mock.writeCallCount === 0, "Persistent retry classification must not write.");
  });

  await group("caller-owned transaction is propagated without nesting", async () => {
    const prismaModule = await loadPrismaModule();
    const mutablePrisma = prismaModule.prisma as unknown as {
      $transaction: <T>(
        callback: (tx: Prisma.TransactionClient) => Promise<T>
      ) => Promise<T>;
    };
    const original = mutablePrisma.$transaction.bind(prismaModule.prisma);
    let selfOwnedCalls = 0;
    mutablePrisma.$transaction = async <T>(
      callback: (tx: Prisma.TransactionClient) => Promise<T>
    ): Promise<T> => {
      selfOwnedCalls++;
      throw new Error(`Unexpected nested transaction callback: ${String(callback)}`);
    };
    try {
      const mock = new MockReferralTransactionClient();
      const result = await execute(mock);
      check(result.outcome === "CREATED", "Caller-owned execution must succeed.");
      check(selfOwnedCalls === 0, "Caller-owned execution must create zero nested transactions.");
      check(mock.rawCalls.length > 0, "Caller client must receive lock queries.");
    } finally {
      mutablePrisma.$transaction = original;
    }
  });

  await group("self-owned mode uses exactly one atomic transaction", async () => {
    const prismaModule = await loadPrismaModule();
    const mutablePrisma = prismaModule.prisma as unknown as {
      $transaction: <T>(
        callback: (tx: Prisma.TransactionClient) => Promise<T>
      ) => Promise<T>;
    };
    const original = mutablePrisma.$transaction.bind(prismaModule.prisma);
    const mock = new MockReferralTransactionClient();
    mutablePrisma.$transaction = <T>(
      callback: (tx: Prisma.TransactionClient) => Promise<T>
    ): Promise<T> => mock.runTransaction(callback);
    try {
      const result = await Service.executeReferralRewardEffect({
        transactionId: IDS.transaction,
        finalizationEffectId: IDS.effect,
      });
      check(result.outcome === "CREATED", "Self-owned execution must succeed.");
      check(mock.transactionRunCount === 1, "Self-owned mode must use exactly one transaction.");
    } finally {
      mutablePrisma.$transaction = original;
    }
  });

  await group("audit failure rolls back Referral, Reward, and audit", async () => {
    const prismaModule = await loadPrismaModule();
    const mutablePrisma = prismaModule.prisma as unknown as {
      $transaction: <T>(
        callback: (tx: Prisma.TransactionClient) => Promise<T>
      ) => Promise<T>;
    };
    const original = mutablePrisma.$transaction.bind(prismaModule.prisma);
    const mock = new MockReferralTransactionClient();
    mock.simulateAuditFailure = true;
    mutablePrisma.$transaction = <T>(
      callback: (tx: Prisma.TransactionClient) => Promise<T>
    ): Promise<T> => mock.runTransaction(callback);
    try {
      await expectCode(mock, "DATABASE_EXECUTION_FAILED", { tx: undefined });
      check(mock.referrals[0].qualifyingPaymentId === null, "Referral CAS must roll back.");
      check(mock.rewards.length === 0, "Reward create must roll back.");
      check(mock.audits.length === 0, "Failed audit transaction must remain empty.");
    } finally {
      mutablePrisma.$transaction = original;
    }
  });

  await group("advisory lock order and stable row lock order are exact", async () => {
    const fresh = new MockReferralTransactionClient();
    await execute(fresh);
    check(
      JSON.stringify(fresh.advisoryLocks) ===
        JSON.stringify([
          IDS.transaction,
          `referral-reward:effect:${IDS.effect}`,
          `referral-reward:referral:${IDS.referral}`,
          `referral-finance:${IDS.inviter}`,
        ]),
      "Advisory locks must use exact sequential global order."
    );
    check(
      fresh.effectRowLocks.join(",") === IDS.effect,
      "Effect row must be stabilized after advisory locks."
    );

    const rowA = makeReward({
      id: "reward_c",
      transactionId: "txn_c",
      finalizationEffectId: "effect_c",
    });
    const rowB = makeReward({
      id: "reward_a",
      referralId: "referral_a",
      finalizationEffectId: "effect_a",
    });
    const rowC = makeReward({
      id: "reward_b",
      referralId: "referral_b",
      transactionId: IDS.transaction,
      finalizationEffectId: IDS.effect,
    });
    const conflict = new MockReferralTransactionClient({ rewards: [rowA, rowB, rowC] });
    await expectCode(conflict, "REWARD_IDENTITY_CONFLICT");
    check(
      JSON.stringify(conflict.rewardRowLocks) ===
        JSON.stringify([...new Set(conflict.rewardRowLocks)].sort()),
      "Reward rows must lock once in stable ID order."
    );

    const owner = makeReferral({
      id: "referral_a_owner",
      referredUserId: "referred_a_owner",
      qualifyingPaymentId: IDS.transaction,
    });
    const referralConflict = new MockReferralTransactionClient({
      referrals: [makeReferral({ id: "referral_z_intended" }), owner],
      intent: activeIntent({ referralId: "referral_z_intended" }),
    });
    referralConflict.effect.referralId = "referral_z_intended";
    await expectCode(referralConflict, "REFERRAL_QUALIFYING_PAYMENT_CONFLICT");
    check(
      JSON.stringify(referralConflict.referralRowLocks) ===
        JSON.stringify([...new Set(referralConflict.referralRowLocks)].sort()),
      "Referral rows must lock once in stable ID order."
    );
  });

  await group("static dormancy and safety invariants hold", () => {
    const servicePath = path.join(
      process.cwd(),
      "src/lib/referral/idempotentReferralRewardService.ts"
    );
    const testPath = path.join(
      process.cwd(),
      "src/scripts/test-idempotent-referral-reward.ts"
    );
    const serviceSource = fs.readFileSync(servicePath, "utf8");
    const testSource = fs.readFileSync(testPath, "utf8");
    const forbiddenQueryRaw = "$queryRaw" + "Unsafe";
    const forbiddenExecuteRaw = "$execute" + "Raw";
    const forbiddenTopType = new RegExp("\\b" + "an" + "y\\b");

    check(!forbiddenTopType.test(serviceSource), "Service must contain zero unsafe top types.");
    check(!serviceSource.includes(forbiddenQueryRaw), "Service must contain zero unsafe raw queries.");
    check(!serviceSource.includes(forbiddenExecuteRaw), "Service must contain zero raw mutation calls.");
    check(serviceSource.includes("$queryRaw`"), "Service must use tagged safe raw queries.");
    check(!serviceSource.includes("ReferralProgramSetting"), "Service must not read current referral settings.");
    check(!serviceSource.includes("ReferralService"), "Service must not invoke the legacy writer.");
    check(
      !/createNotification|from\s+["'][^"']*notification/i.test(serviceSource),
      "Service must have zero notification side effects."
    );
    check(!serviceSource.includes("PayMongo"), "Service must have zero provider calls.");
    check(!/new Date\(\s*\)/.test(serviceSource), "Service must have zero ambient semantic timestamps.");
    check(!/paymentFinalizationEffect\.(?:update|updateMany)/.test(serviceSource), "Service must not write effect lifecycle.");
    check(!/paymentFinalization\.(?:update|updateMany)/.test(serviceSource), "Service must not write parent lifecycle.");
    check(!serviceSource.includes("while ("), "Service must have zero retry loop.");
    check(!forbiddenTopType.test(testSource), "Focused test must contain zero unsafe top types.");

    const runtimeFiles = sourceFiles(path.join(process.cwd(), "src")).filter(
      (file) =>
        !file.includes(`${path.sep}scripts${path.sep}`) &&
        file !== servicePath
    );
    const productionCallers = runtimeFiles.filter((file) =>
      fs
        .readFileSync(file, "utf8")
        .includes("idempotentReferralRewardService")
    );
    check(productionCallers.length === 0, "Service must have zero production callers.");

    check(
      fs.existsSync(servicePath),
      "Authorized Slice 4 service file must exist."
    );
    check(
      fs.existsSync(testPath),
      "Authorized Slice 4 focused test file must exist."
    );

    const authorizedSlice4Paths = new Set([
      "src/lib/referral/idempotentReferralRewardService.ts",
      "src/scripts/test-idempotent-referral-reward.ts",
    ]);

    const unstagedTrackedPaths = execFileSync(
      "git",
      ["diff", "--name-only"],
      { encoding: "utf8" }
    )
      .split(/\r?\n/)
      .filter(Boolean);

    const stagedTrackedPaths = execFileSync(
      "git",
      ["diff", "--cached", "--name-only"],
      { encoding: "utf8" }
    )
      .split(/\r?\n/)
      .filter(Boolean);

    check(
      [...unstagedTrackedPaths, ...stagedTrackedPaths].every((file) =>
        authorizedSlice4Paths.has(file)
      ),
      "Tracked or staged changes must remain within the authorized Slice 4 files."
    );
  });

  console.log("------------------------------------------------------------");
  console.log(
    `Slice 4 synthetic summary: ${passedGroups}/${totalGroups} groups passed; ${totalChecks} checks executed; ${failedGroups} groups failed.`
  );
  console.log(
    "LIMITATION: synthetic tests cannot prove real PostgreSQL advisory waiting, row locking, unique-race scheduling, transaction abort behavior, or deadlock freedom."
  );

  if (failedGroups > 0) process.exitCode = 1;
}

runSuite().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FATAL SLICE 4 SYNTHETIC FAILURE: ${message}`);
  process.exitCode = 1;
});
