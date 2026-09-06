// Relative Path: src/lib/referral/idempotentReferralRewardService.ts
/**
 * Dormant payment-finalization referral-reward executor (P1-001 / Slice 4).
 *
 * This primitive consumes one persisted immutable REFERRAL_REWARD effect. It
 * deliberately has no production caller, no policy/configuration reads, no
 * notifications, and no payment-finalization lifecycle writes.
 */

import {
  Prisma,
  type Referral,
  type ReferralReward,
} from "@prisma/client";
import { prisma } from "../prisma";
import {
  buildPaymentFinalizationOperationKey,
  canonicalizeJson,
  computeSha256Hash,
  validateIsoUtcTimestamp,
  validateTransactionId,
} from "../payment/paymentFinalizationContracts";

const POSTGRESQL_INTEGER_MAX = 2_147_483_647;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SUPPORTED_MANIFEST_VERSION = 1;
const SUPPORTED_INTENT_VERSION = 1;
const IDENTIFIER_MAX_LENGTH = 128;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

export interface ExecuteReferralRewardEffectParams {
  readonly transactionId: string;
  readonly finalizationEffectId: string;
  readonly tx?: Prisma.TransactionClient;
}

export type V1ReferralNotApplicableReason =
  | "NO_REFERRAL_ATTRIBUTION"
  | "PROGRAM_DISABLED"
  | "ZERO_REWARD_CALCULATED"
  | "REFERRAL_ALREADY_REWARDED";

export type ExecuteReferralRewardEffectResult =
  | {
      readonly outcome: "CREATED";
      readonly reward: ReferralReward;
      readonly isReplay: false;
    }
  | {
      readonly outcome: "REPLAY";
      readonly reward: ReferralReward;
      readonly isReplay: true;
    }
  | {
      readonly outcome: "NOT_APPLICABLE";
      readonly reward: null;
      readonly reason: V1ReferralNotApplicableReason;
    };

export type ReferralRewardExecutionErrorCode =
  | "EFFECT_NOT_FOUND"
  | "WRONG_EFFECT_TYPE"
  | "UNSUPPORTED_INTENT_VERSION"
  | "INTENT_HASH_MISMATCH"
  | "MANIFEST_LINKAGE_MISMATCH"
  | "TRANSACTION_IDENTITY_MISMATCH"
  | "REFERRAL_NOT_FOUND"
  | "REFERRAL_IDENTITY_MISMATCH"
  | "REFERRAL_QUALIFYING_PAYMENT_CONFLICT"
  | "REFERRAL_QUALIFYING_PAYMENT_PARTIAL_STATE"
  | "LEGACY_REWARD_REQUIRES_CLASSIFICATION"
  | "REWARD_IDENTITY_CONFLICT"
  | "CONCURRENT_IDENTITY_CONFLICT"
  | "INVALID_IMMUTABLE_INTENT"
  | "INVALID_LIFECYCLE"
  | "DATABASE_EXECUTION_FAILED";

export class ReferralRewardExecutionError extends Error {
  public readonly code: ReferralRewardExecutionErrorCode;

  constructor(code: ReferralRewardExecutionErrorCode, message: string) {
    super(message);
    this.name = "ReferralRewardExecutionError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type LoadedEffect = Prisma.PaymentFinalizationEffectGetPayload<{
  include: {
    finalization: {
      include: {
        transaction: true;
      };
    };
  };
}>;

interface ActiveReferralIntent {
  readonly effectType: "REFERRAL_REWARD";
  readonly intentVersion: 1;
  readonly status: "PENDING";
  readonly referralId: string;
  readonly inviterId: string;
  readonly referredUserId: string;
  readonly purchaseAmountCentavos: number;
  readonly rewardType: "PERCENTAGE" | "FIXED";
  readonly rewardRateBasisPoints: number;
  readonly rewardAmountCentavos: number;
  readonly currency: "PHP";
  readonly holdingPeriodDays: number;
  readonly holdingUntil: string;
}

interface NotApplicableReferralIntent {
  readonly effectType: "REFERRAL_REWARD";
  readonly intentVersion: 1;
  readonly status: "NOT_APPLICABLE";
  readonly notApplicableReason: V1ReferralNotApplicableReason;
  readonly referralId: string | null;
  readonly inviterId: string | null;
  readonly referredUserId: string;
  readonly purchaseAmountCentavos: number;
  readonly rewardType: "PERCENTAGE" | "FIXED" | null;
  readonly rewardRateBasisPoints: number | null;
  readonly rewardAmountCentavos: 0;
  readonly currency: "PHP";
  readonly holdingPeriodDays: number | null;
  readonly holdingUntil: null;
}

type ParsedReferralIntent = ActiveReferralIntent | NotApplicableReferralIntent;

interface PreliminaryIdentity {
  readonly referralId: string | null;
  readonly inviterId: string | null;
}

interface RewardIdentityState {
  readonly byReferral: ReferralReward | null;
  readonly byTransaction: ReferralReward | null;
  readonly byEffect: ReferralReward | null;
}

type ClassifiedRewardIdentity =
  | { readonly kind: "NONE" }
  | { readonly kind: "EXACT"; readonly reward: ReferralReward }
  | { readonly kind: "LEGACY"; readonly reward: ReferralReward }
  | { readonly kind: "CONFLICT" };

const ACTIVE_INTENT_KEYS = [
  "currency",
  "effectType",
  "holdingPeriodDays",
  "holdingUntil",
  "intentVersion",
  "inviterId",
  "purchaseAmountCentavos",
  "referralId",
  "referredUserId",
  "rewardAmountCentavos",
  "rewardRateBasisPoints",
  "rewardType",
  "status",
] as const;

const NOT_APPLICABLE_INTENT_KEYS = [
  ...ACTIVE_INTENT_KEYS,
  "notApplicableReason",
] as const;

const APPROVED_P2002_FIELDS = new Set([
  "referralId",
  "transactionId",
  "finalizationEffectId",
  "qualifyingPaymentId",
]);

const APPROVED_P2002_CONSTRAINTS = new Set([
  "ReferralReward_referralId_key",
  "ReferralReward_transactionId_key",
  "ReferralReward_finalizationEffectId_key",
  "Referral_qualifyingPaymentId_key",
]);

function fail(
  code: ReferralRewardExecutionErrorCode,
  message: string
): never {
  throw new ReferralRewardExecutionError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[]
): void {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Persisted referral intent does not match the exact supported v1 shape."
    );
  }
}

function requireExactIdentifier(value: unknown, fieldName: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > IDENTIFIER_MAX_LENGTH ||
    value !== value.trim()
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      `${fieldName} is not a valid exact persisted identifier.`
    );
  }
  return value;
}

function requireInputEffectIdentifier(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > IDENTIFIER_MAX_LENGTH ||
    value !== value.trim()
  ) {
    fail("EFFECT_NOT_FOUND", "The requested finalization effect was not found.");
  }
  return value;
}

function requirePositivePostgresInteger(
  value: unknown,
  fieldName: string
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > POSTGRESQL_INTEGER_MAX
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      `${fieldName} must be a positive PostgreSQL-compatible integer.`
    );
  }
  return value;
}

function requireNonNegativeSafeInteger(
  value: unknown,
  fieldName: string
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      `${fieldName} must be a nonnegative safe integer.`
    );
  }
  return value;
}

function requireBasisPoints(value: unknown): number {
  const basisPoints = requireNonNegativeSafeInteger(
    value,
    "rewardRateBasisPoints"
  );
  if (basisPoints > 10_000) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "rewardRateBasisPoints exceeds the supported range."
    );
  }
  return basisPoints;
}

function requireRewardType(
  value: unknown
): "PERCENTAGE" | "FIXED" {
  if (value !== "PERCENTAGE" && value !== "FIXED") {
    fail("INVALID_IMMUTABLE_INTENT", "Unsupported referral reward type.");
  }
  return value;
}

function requireCanonicalIso(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    fail("INVALID_IMMUTABLE_INTENT", `${fieldName} must be a timestamp string.`);
  }

  let normalized: string | null;
  try {
    normalized = validateIsoUtcTimestamp(value, fieldName, false);
  } catch {
    fail("INVALID_IMMUTABLE_INTENT", `${fieldName} is not a valid UTC timestamp.`);
  }

  if (normalized === null || normalized !== value) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      `${fieldName} must be an exact canonical UTC ISO timestamp.`
    );
  }
  return normalized;
}

function parseActiveIntent(value: Record<string, unknown>): ActiveReferralIntent {
  requireExactKeys(value, ACTIVE_INTENT_KEYS);

  if (
    value.effectType !== "REFERRAL_REWARD" ||
    value.intentVersion !== SUPPORTED_INTENT_VERSION ||
    value.status !== "PENDING" ||
    value.currency !== "PHP"
  ) {
    fail("INVALID_IMMUTABLE_INTENT", "Persisted active referral intent is invalid.");
  }

  const referralId = requireExactIdentifier(value.referralId, "referralId");
  const inviterId = requireExactIdentifier(value.inviterId, "inviterId");
  const referredUserId = requireExactIdentifier(
    value.referredUserId,
    "referredUserId"
  );
  const purchaseAmountCentavos = requirePositivePostgresInteger(
    value.purchaseAmountCentavos,
    "purchaseAmountCentavos"
  );
  const rewardAmountCentavos = requirePositivePostgresInteger(
    value.rewardAmountCentavos,
    "rewardAmountCentavos"
  );
  const rewardType = requireRewardType(value.rewardType);
  const rewardRateBasisPoints = requireBasisPoints(
    value.rewardRateBasisPoints
  );
  const holdingPeriodDays = requireNonNegativeSafeInteger(
    value.holdingPeriodDays,
    "holdingPeriodDays"
  );
  const holdingUntil = requireCanonicalIso(value.holdingUntil, "holdingUntil");

  if (rewardType === "FIXED" && rewardRateBasisPoints !== 0) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "A fixed referral reward must use zero basis points."
    );
  }

  if (rewardType === "PERCENTAGE") {
    const canonicalPercentage = rewardRateBasisPoints / 100;
    const expectedReward = Math.round(
      (purchaseAmountCentavos * canonicalPercentage) / 100
    );
    if (rewardAmountCentavos !== expectedReward) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "Persisted percentage reward does not match the immutable v1 calculation."
      );
    }
  }

  return {
    effectType: "REFERRAL_REWARD",
    intentVersion: 1,
    status: "PENDING",
    referralId,
    inviterId,
    referredUserId,
    purchaseAmountCentavos,
    rewardType,
    rewardRateBasisPoints,
    rewardAmountCentavos,
    currency: "PHP",
    holdingPeriodDays,
    holdingUntil,
  };
}

function parseNotApplicableIntent(
  value: Record<string, unknown>
): NotApplicableReferralIntent {
  requireExactKeys(value, NOT_APPLICABLE_INTENT_KEYS);

  if (value.notApplicableReason === "NON_POSITIVE_AMOUNT") {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "NON_POSITIVE_AMOUNT is unreachable for persisted manifest version 1."
    );
  }

  if (
    value.notApplicableReason !== "NO_REFERRAL_ATTRIBUTION" &&
    value.notApplicableReason !== "PROGRAM_DISABLED" &&
    value.notApplicableReason !== "ZERO_REWARD_CALCULATED" &&
    value.notApplicableReason !== "REFERRAL_ALREADY_REWARDED"
  ) {
    fail("INVALID_IMMUTABLE_INTENT", "Unsupported v1 not-applicable reason.");
  }

  if (
    value.effectType !== "REFERRAL_REWARD" ||
    value.intentVersion !== SUPPORTED_INTENT_VERSION ||
    value.status !== "NOT_APPLICABLE" ||
    value.currency !== "PHP" ||
    value.rewardAmountCentavos !== 0 ||
    value.holdingUntil !== null
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Persisted not-applicable referral intent is invalid."
    );
  }

  const referredUserId = requireExactIdentifier(
    value.referredUserId,
    "referredUserId"
  );
  const purchaseAmountCentavos = requirePositivePostgresInteger(
    value.purchaseAmountCentavos,
    "purchaseAmountCentavos"
  );

  if (value.notApplicableReason === "NO_REFERRAL_ATTRIBUTION") {
    if (
      value.referralId !== null ||
      value.inviterId !== null ||
      value.rewardType !== null ||
      value.rewardRateBasisPoints !== null ||
      value.holdingPeriodDays !== null
    ) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "NO_REFERRAL_ATTRIBUTION has inconsistent persisted identities."
      );
    }

    return {
      effectType: "REFERRAL_REWARD",
      intentVersion: 1,
      status: "NOT_APPLICABLE",
      notApplicableReason: "NO_REFERRAL_ATTRIBUTION",
      referralId: null,
      inviterId: null,
      referredUserId,
      purchaseAmountCentavos,
      rewardType: null,
      rewardRateBasisPoints: null,
      rewardAmountCentavos: 0,
      currency: "PHP",
      holdingPeriodDays: null,
      holdingUntil: null,
    };
  }

  const referralId = requireExactIdentifier(value.referralId, "referralId");
  const inviterId = requireExactIdentifier(value.inviterId, "inviterId");
  const rewardType = requireRewardType(value.rewardType);
  const rewardRateBasisPoints = requireBasisPoints(
    value.rewardRateBasisPoints
  );
  const holdingPeriodDays = requireNonNegativeSafeInteger(
    value.holdingPeriodDays,
    "holdingPeriodDays"
  );

  if (rewardType === "FIXED" && rewardRateBasisPoints !== 0) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "A fixed not-applicable referral intent must use zero basis points."
    );
  }

  if (
    value.notApplicableReason === "ZERO_REWARD_CALCULATED" &&
    rewardType === "PERCENTAGE"
  ) {
    const canonicalPercentage = rewardRateBasisPoints / 100;
    const expectedReward = Math.round(
      (purchaseAmountCentavos * canonicalPercentage) / 100
    );
    if (expectedReward !== 0) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "ZERO_REWARD_CALCULATED does not match its immutable percentage inputs."
      );
    }
  }

  return {
    effectType: "REFERRAL_REWARD",
    intentVersion: 1,
    status: "NOT_APPLICABLE",
    notApplicableReason: value.notApplicableReason,
    referralId,
    inviterId,
    referredUserId,
    purchaseAmountCentavos,
    rewardType,
    rewardRateBasisPoints,
    rewardAmountCentavos: 0,
    currency: "PHP",
    holdingPeriodDays,
    holdingUntil: null,
  };
}

function parseAndValidateIntent(effect: LoadedEffect): ParsedReferralIntent {
  if (!isRecord(effect.intent)) {
    fail("INVALID_IMMUTABLE_INTENT", "Persisted referral intent must be a JSON object.");
  }

  let canonical: string;
  try {
    canonical = canonicalizeJson(effect.intent);
  } catch {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Persisted referral intent cannot be canonically serialized."
    );
  }

  if (computeSha256Hash(canonical) !== effect.intentHash) {
    fail("INTENT_HASH_MISMATCH", "Persisted referral intent hash does not match.");
  }

  if (effect.intentVersion !== SUPPORTED_INTENT_VERSION) {
    fail(
      "UNSUPPORTED_INTENT_VERSION",
      "Persisted referral effect uses an unsupported intent version."
    );
  }

  if (effect.intent.intentVersion !== SUPPORTED_INTENT_VERSION) {
    fail(
      "UNSUPPORTED_INTENT_VERSION",
      "Persisted referral intent uses an unsupported version."
    );
  }

  if (effect.intentVersion !== effect.intent.intentVersion) {
    fail(
      "UNSUPPORTED_INTENT_VERSION",
      "Persisted effect and intent versions do not agree."
    );
  }

  if (effect.intent.status === "PENDING") {
    return parseActiveIntent(effect.intent);
  }
  if (effect.intent.status === "NOT_APPLICABLE") {
    return parseNotApplicableIntent(effect.intent);
  }

  fail("INVALID_IMMUTABLE_INTENT", "Unsupported persisted referral intent status.");
}

function extractPreliminaryIdentity(effect: LoadedEffect): PreliminaryIdentity {
  if (!isRecord(effect.intent)) {
    fail("INVALID_IMMUTABLE_INTENT", "Persisted referral intent must be a JSON object.");
  }

  const referralValue = effect.intent.referralId;
  const inviterValue = effect.intent.inviterId;

  if (referralValue === null && inviterValue === null) {
    if (effect.referralId !== null) {
      fail(
        "MANIFEST_LINKAGE_MISMATCH",
        "Effect referral linkage does not match its persisted intent."
      );
    }
    return { referralId: null, inviterId: null };
  }

  const referralId = requireExactIdentifier(referralValue, "referralId");
  const inviterId = requireExactIdentifier(inviterValue, "inviterId");
  if (effect.referralId !== referralId) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Effect referral linkage does not match its persisted intent."
    );
  }
  return { referralId, inviterId };
}

function validateEffectAndParent(
  effect: LoadedEffect,
  intent: ParsedReferralIntent,
  transactionId: string
): { readonly replayOnly: boolean } {
  if (effect.effectType !== "REFERRAL_REWARD") {
    fail("WRONG_EFFECT_TYPE", "The requested effect is not a referral reward effect.");
  }

  if (effect.effectKey !== "referral") {
    fail("MANIFEST_LINKAGE_MISMATCH", "Referral effect key is invalid.");
  }

  const finalization = effect.finalization;
  if (!finalization || !finalization.transaction) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Referral effect is not linked to a complete payment finalization."
    );
  }

  if (
    finalization.manifestVersion !== SUPPORTED_MANIFEST_VERSION ||
    !Number.isSafeInteger(finalization.manifestRevision) ||
    finalization.manifestRevision <= 0 ||
    !HASH_PATTERN.test(finalization.manifestHash)
  ) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Payment finalization manifest linkage is invalid."
    );
  }

  if (
    finalization.transactionId !== transactionId ||
    finalization.transaction.id !== transactionId
  ) {
    fail(
      "TRANSACTION_IDENTITY_MISMATCH",
      "Payment finalization transaction identity does not match the request."
    );
  }

  const expectedOperationKey = buildPaymentFinalizationOperationKey(
    transactionId,
    { kind: "REFERRAL" }
  );
  if (effect.operationKey !== expectedOperationKey) {
    fail("MANIFEST_LINKAGE_MISMATCH", "Referral operation key is invalid.");
  }

  if (finalization.transaction.userId !== intent.referredUserId) {
    fail(
      "TRANSACTION_IDENTITY_MISMATCH",
      "Payment transaction ownership does not match the referral intent."
    );
  }

  if (
    finalization.purchaseAmountCentavos !== intent.purchaseAmountCentavos ||
    finalization.currency !== "PHP" ||
    intent.currency !== "PHP"
  ) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Payment finalization financial fields do not match the referral intent."
    );
  }

  if (
    effect.referralId !== intent.referralId ||
    effect.partnerId !== null ||
    effect.taxConfigId !== null
  ) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Referral effect identity columns do not match the immutable intent."
    );
  }

  if (finalization.status === "MANUAL_REVIEW") {
    fail("INVALID_LIFECYCLE", "Payment finalization is in manual review.");
  }

  if (intent.status === "NOT_APPLICABLE") {
    if (effect.status !== "NOT_APPLICABLE") {
      fail(
        "INVALID_LIFECYCLE",
        "Not-applicable referral intent has an inconsistent effect lifecycle."
      );
    }
    return { replayOnly: true };
  }

  if (effect.status === "AWAITING_DATA" || effect.status === "MANUAL_REVIEW") {
    fail("INVALID_LIFECYCLE", "Referral effect is not executable in its current state.");
  }

  if (
    effect.status !== "PENDING" &&
    effect.status !== "FAILED_RETRYABLE" &&
    effect.status !== "COMPLETE"
  ) {
    fail("INVALID_LIFECYCLE", "Referral effect lifecycle is inconsistent.");
  }

  return {
    replayOnly:
      effect.status === "COMPLETE" || finalization.status === "COMPLETE",
  };
}

function validateHoldingTime(
  effect: LoadedEffect,
  intent: ActiveReferralIntent
): Date {
  const verifiedAt = effect.finalization.verifiedAt;
  const verifiedTimestamp = verifiedAt.getTime();
  const holdingDuration = intent.holdingPeriodDays * MILLISECONDS_PER_DAY;
  const expectedTimestamp = verifiedTimestamp + holdingDuration;

  if (
    !Number.isFinite(verifiedTimestamp) ||
    !Number.isSafeInteger(holdingDuration) ||
    !Number.isSafeInteger(expectedTimestamp)
  ) {
    fail("INVALID_IMMUTABLE_INTENT", "Referral holding timestamp overflows v1 limits.");
  }

  const expectedDate = new Date(expectedTimestamp);
  if (
    !Number.isFinite(expectedDate.getTime()) ||
    expectedDate.toISOString() !== intent.holdingUntil
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Referral holding timestamp does not match finalization verification time."
    );
  }

  return expectedDate;
}

async function acquireAdvisoryLock(
  client: Prisma.TransactionClient,
  lockName: string
): Promise<void> {
  await client.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${lockName}, 0)
    )::text AS lock_result
  `;
}

async function lockEffectRow(
  client: Prisma.TransactionClient,
  effectId: string
): Promise<void> {
  await client.$queryRaw`
    SELECT "id"
    FROM "PaymentFinalizationEffect"
    WHERE "id" = ${effectId}
    FOR UPDATE
  `;
}

async function lockRewardRows(
  client: Prisma.TransactionClient,
  rewardIds: readonly string[]
): Promise<void> {
  for (const rewardId of [...new Set(rewardIds)].sort()) {
    await client.$queryRaw`
      SELECT "id"
      FROM "ReferralReward"
      WHERE "id" = ${rewardId}
      FOR UPDATE
    `;
  }
}

async function lockReferralRows(
  client: Prisma.TransactionClient,
  referralIds: readonly string[]
): Promise<void> {
  for (const referralId of [...new Set(referralIds)].sort()) {
    await client.$queryRaw`
      SELECT "id"
      FROM "Referral"
      WHERE "id" = ${referralId}
      FOR UPDATE
    `;
  }
}

async function loadEffect(
  client: Prisma.TransactionClient,
  effectId: string
): Promise<LoadedEffect | null> {
  return client.paymentFinalizationEffect.findUnique({
    where: { id: effectId },
    include: {
      finalization: {
        include: {
          transaction: true,
        },
      },
    },
  });
}

async function readRewardIdentities(
  client: Prisma.TransactionClient,
  transactionId: string,
  effectId: string,
  referralId: string | null
): Promise<RewardIdentityState> {
  const byReferral = referralId
    ? await client.referralReward.findUnique({ where: { referralId } })
    : null;
  const byTransaction = await client.referralReward.findUnique({
    where: { transactionId },
  });
  const byEffect = await client.referralReward.findUnique({
    where: { finalizationEffectId: effectId },
  });
  return { byReferral, byTransaction, byEffect };
}

function classifyRewardIdentities(
  state: RewardIdentityState
): ClassifiedRewardIdentity {
  const { byReferral, byTransaction, byEffect } = state;

  if (!byReferral && !byTransaction && !byEffect) {
    return { kind: "NONE" };
  }

  if (byReferral && byTransaction && byEffect) {
    if (
      byReferral.id === byTransaction.id &&
      byReferral.id === byEffect.id
    ) {
      return { kind: "EXACT", reward: byReferral };
    }
    return { kind: "CONFLICT" };
  }

  if (
    byReferral &&
    byTransaction &&
    !byEffect &&
    byReferral.id === byTransaction.id &&
    byReferral.finalizationEffectId === null
  ) {
    return { kind: "LEGACY", reward: byReferral };
  }

  return { kind: "CONFLICT" };
}

function validateReferralIdentity(
  referral: Referral | null,
  intent: ActiveReferralIntent | NotApplicableReferralIntent
): Referral {
  if (!referral || intent.referralId === null || intent.inviterId === null) {
    fail("REFERRAL_NOT_FOUND", "The intended referral record was not found.");
  }

  if (
    referral.id !== intent.referralId ||
    referral.inviterId !== intent.inviterId ||
    referral.referredUserId !== intent.referredUserId
  ) {
    fail(
      "REFERRAL_IDENTITY_MISMATCH",
      "Referral ownership does not match the immutable intent."
    );
  }
  return referral;
}

function validateRewardReplay(
  reward: ReferralReward,
  intent: ActiveReferralIntent,
  transactionId: string,
  effectId: string
): void {
  const expectedRewardType =
    intent.rewardType === "FIXED" ? "FIXED_AMOUNT" : "PERCENTAGE";
  const expectedEffectiveRate = intent.rewardRateBasisPoints / 100;

  if (
    reward.referralId !== intent.referralId ||
    reward.inviterId !== intent.inviterId ||
    reward.referredUserId !== intent.referredUserId ||
    reward.transactionId !== transactionId ||
    reward.finalizationEffectId !== effectId ||
    reward.purchaseAmountCentavos !== intent.purchaseAmountCentavos ||
    reward.rewardType !== expectedRewardType ||
    reward.effectiveRate !== expectedEffectiveRate ||
    reward.rewardAmountCentavos !== intent.rewardAmountCentavos ||
    reward.currency !== "PHP" ||
    reward.holdingUntil?.toISOString() !== intent.holdingUntil
  ) {
    fail(
      "REWARD_IDENTITY_CONFLICT",
      "Existing referral reward does not match the immutable effect."
    );
  }
}

function validateReferralReplayMirror(
  referral: Referral,
  intent: ActiveReferralIntent,
  effect: LoadedEffect
): void {
  const expectedRate = intent.rewardRateBasisPoints / 100;
  if (
    referral.qualifyingPaymentId !== effect.finalization.transactionId ||
    referral.qualifyingAmount !== intent.purchaseAmountCentavos ||
    referral.effectiveRate !== expectedRate ||
    referral.rewardAmount !== intent.rewardAmountCentavos ||
    referral.holdingUntil?.toISOString() !== intent.holdingUntil ||
    referral.qualifiedAt?.toISOString() !==
      effect.finalization.verifiedAt.toISOString()
  ) {
    fail(
      "INVALID_LIFECYCLE",
      "Referral qualification mirror does not match its immutable reward."
    );
  }
}

function isPrismaP2002(error: unknown): error is {
  readonly code: "P2002";
  readonly meta?: { readonly target?: unknown };
} {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    readonly code?: unknown;
    readonly meta?: unknown;
  };
  return candidate.code === "P2002";
}

export function isReferralRewardIdentityP2002Error(error: unknown): boolean {
  if (!isPrismaP2002(error)) return false;
  if (!error.meta || typeof error.meta !== "object") return false;

  const target = (error.meta as { readonly target?: unknown }).target;
  if (Array.isArray(target)) {
    return (
      target.length === 1 &&
      typeof target[0] === "string" &&
      APPROVED_P2002_FIELDS.has(target[0])
    );
  }

  return typeof target === "string" && APPROVED_P2002_CONSTRAINTS.has(target);
}

function normalizeExecutionError(error: unknown): never {
  if (error instanceof ReferralRewardExecutionError) {
    throw error;
  }

  if (isReferralRewardIdentityP2002Error(error)) {
    fail(
      "CONCURRENT_IDENTITY_CONFLICT",
      "A concurrent referral reward identity collision requires an outer transaction retry."
    );
  }

  fail(
    "DATABASE_EXECUTION_FAILED",
    "Referral reward execution failed without exposing database internals."
  );
}

export class IdempotentReferralRewardService {
  static async executeReferralRewardEffect(
    params: ExecuteReferralRewardEffectParams
  ): Promise<ExecuteReferralRewardEffectResult> {
    let transactionId: string;
    try {
      transactionId = validateTransactionId(params.transactionId);
    } catch {
      fail(
        "TRANSACTION_IDENTITY_MISMATCH",
        "The requested transaction identity is invalid."
      );
    }

    if (transactionId !== params.transactionId) {
      fail(
        "TRANSACTION_IDENTITY_MISMATCH",
        "The requested transaction identity is not exact."
      );
    }

    const effectId = requireInputEffectIdentifier(params.finalizationEffectId);

    try {
      if (params.tx) {
        return await this.executeInsideTransaction(
          transactionId,
          effectId,
          params.tx
        );
      }

      return await prisma.$transaction((tx) =>
        this.executeInsideTransaction(transactionId, effectId, tx)
      );
    } catch (error: unknown) {
      return normalizeExecutionError(error);
    }
  }

  private static async executeInsideTransaction(
    transactionId: string,
    effectId: string,
    client: Prisma.TransactionClient
  ): Promise<ExecuteReferralRewardEffectResult> {
    // Global advisory order: transaction -> effect -> referral -> finance.
    await acquireAdvisoryLock(client, transactionId);
    await acquireAdvisoryLock(client, `referral-reward:effect:${effectId}`);

    const preliminaryEffect = await loadEffect(client, effectId);
    if (!preliminaryEffect) {
      fail("EFFECT_NOT_FOUND", "The requested finalization effect was not found.");
    }
    const preliminaryIdentity = extractPreliminaryIdentity(preliminaryEffect);

    if (
      preliminaryIdentity.referralId !== null &&
      preliminaryIdentity.inviterId !== null
    ) {
      await acquireAdvisoryLock(
        client,
        `referral-reward:referral:${preliminaryIdentity.referralId}`
      );
      await acquireAdvisoryLock(
        client,
        `referral-finance:${preliminaryIdentity.inviterId}`
      );
    }

    // Stabilize and re-read the effect after every applicable advisory lock.
    await lockEffectRow(client, effectId);
    const effect = await loadEffect(client, effectId);
    if (!effect) {
      fail("EFFECT_NOT_FOUND", "The requested finalization effect was not found.");
    }

    const intent = parseAndValidateIntent(effect);
    if (
      intent.referralId !== preliminaryIdentity.referralId ||
      intent.inviterId !== preliminaryIdentity.inviterId
    ) {
      fail(
        "MANIFEST_LINKAGE_MISMATCH",
        "Referral identities changed during locked effect resolution."
      );
    }

    const { replayOnly } = validateEffectAndParent(
      effect,
      intent,
      transactionId
    );

    const preliminaryRewards = await readRewardIdentities(
      client,
      transactionId,
      effectId,
      intent.referralId
    );
    await lockRewardRows(
      client,
      [
        preliminaryRewards.byReferral?.id,
        preliminaryRewards.byTransaction?.id,
        preliminaryRewards.byEffect?.id,
      ].filter((value): value is string => typeof value === "string")
    );

    const preliminaryReferral = intent.referralId
      ? await client.referral.findUnique({ where: { id: intent.referralId } })
      : null;
    const preliminaryQualifyingOwner =
      intent.status === "PENDING"
        ? await client.referral.findUnique({
            where: { qualifyingPaymentId: transactionId },
          })
        : null;

    await lockReferralRows(
      client,
      [preliminaryReferral?.id, preliminaryQualifyingOwner?.id].filter(
        (value): value is string => typeof value === "string"
      )
    );

    // Authoritative reads occur only after stable row-lock acquisition.
    const rewards = await readRewardIdentities(
      client,
      transactionId,
      effectId,
      intent.referralId
    );
    const referral = intent.referralId
      ? await client.referral.findUnique({ where: { id: intent.referralId } })
      : null;
    const qualifyingOwner =
      intent.status === "PENDING"
        ? await client.referral.findUnique({
            where: { qualifyingPaymentId: transactionId },
          })
        : null;

    if (intent.status === "NOT_APPLICABLE") {
      if (intent.referralId !== null) {
        validateReferralIdentity(referral, intent);
      } else if (referral !== null) {
        fail(
          "REFERRAL_IDENTITY_MISMATCH",
          "No-attribution intent unexpectedly resolved a referral."
        );
      }

      if (rewards.byTransaction || rewards.byEffect) {
        fail(
          "REWARD_IDENTITY_CONFLICT",
          "A not-applicable effect is already associated with a reward identity."
        );
      }

      return {
        outcome: "NOT_APPLICABLE",
        reward: null,
        reason: intent.notApplicableReason,
      };
    }

    const validatedReferral = validateReferralIdentity(referral, intent);
    const holdingUntil = validateHoldingTime(effect, intent);

    // Qualifying-payment ownership has deterministic precedence.
    if (qualifyingOwner && qualifyingOwner.id !== validatedReferral.id) {
      fail(
        "REFERRAL_QUALIFYING_PAYMENT_CONFLICT",
        "Another referral owns the requested qualifying payment."
      );
    }

    if (
      validatedReferral.qualifyingPaymentId !== null &&
      validatedReferral.qualifyingPaymentId !== transactionId
    ) {
      fail(
        "REFERRAL_IDENTITY_MISMATCH",
        "The intended referral already belongs to another qualifying payment."
      );
    }

    const rewardIdentity = classifyRewardIdentities(rewards);
    if (rewardIdentity.kind === "CONFLICT") {
      fail(
        "REWARD_IDENTITY_CONFLICT",
        "Referral reward identities resolve to an inconsistent state."
      );
    }

    if (rewardIdentity.kind === "LEGACY") {
      fail(
        "LEGACY_REWARD_REQUIRES_CLASSIFICATION",
        "A legacy reward requires explicit Slice 7 classification."
      );
    }

    if (rewardIdentity.kind === "EXACT") {
      if (validatedReferral.qualifyingPaymentId !== transactionId) {
        fail(
          "REFERRAL_QUALIFYING_PAYMENT_PARTIAL_STATE",
          "Reward exists but its Referral qualifying-payment mirror is incomplete."
        );
      }
      validateRewardReplay(
        rewardIdentity.reward,
        intent,
        transactionId,
        effectId
      );
      validateReferralReplayMirror(validatedReferral, intent, effect);
      return {
        outcome: "REPLAY",
        reward: rewardIdentity.reward,
        isReplay: true,
      };
    }

    if (replayOnly) {
      fail(
        "INVALID_LIFECYCLE",
        "Completed referral lifecycle has no equivalent reward to replay."
      );
    }

    if (validatedReferral.qualifyingPaymentId === transactionId) {
      fail(
        "REFERRAL_QUALIFYING_PAYMENT_PARTIAL_STATE",
        "Referral owns the qualifying payment but its reward is missing."
      );
    }

    const expectedEffectiveRate = intent.rewardRateBasisPoints / 100;
    const cas = await client.referral.updateMany({
      where: {
        id: intent.referralId,
        inviterId: intent.inviterId,
        referredUserId: intent.referredUserId,
        status: { in: ["PENDING_PREMIUM", "QUALIFIED"] },
        qualifyingPaymentId: null,
      },
      data: {
        status: "REWARD_PENDING",
        qualifyingPaymentId: transactionId,
        qualifyingAmount: intent.purchaseAmountCentavos,
        effectiveRate: expectedEffectiveRate,
        rewardAmount: intent.rewardAmountCentavos,
        holdingUntil,
        qualifiedAt: effect.finalization.verifiedAt,
      },
    });

    if (cas.count !== 1) {
      fail(
        "INVALID_LIFECYCLE",
        "Referral was not eligible for the guarded reward transition."
      );
    }

    const reward = await client.referralReward.create({
      data: {
        referralId: intent.referralId,
        inviterId: intent.inviterId,
        referredUserId: intent.referredUserId,
        transactionId,
        finalizationEffectId: effectId,
        purchaseAmountCentavos: intent.purchaseAmountCentavos,
        rewardType:
          intent.rewardType === "FIXED" ? "FIXED_AMOUNT" : "PERCENTAGE",
        effectiveRate: expectedEffectiveRate,
        rewardAmountCentavos: intent.rewardAmountCentavos,
        currency: "PHP",
        status: "PENDING",
        holdingUntil,
        availableAt: null,
      },
    });

    await client.referralAuditLog.create({
      data: {
        actorId: "SYSTEM_PAYMENT_FINALIZATION",
        actorRole: "SYSTEM",
        action: "REWARD_CREATED",
        targetType: "REWARD",
        targetId: reward.id,
        previousState: null,
        newState: "PENDING",
        amountCentavos: intent.rewardAmountCentavos,
        reason: "Immutable payment-finalization referral reward executed.",
        metadata: {
          finalizationEffectId: effectId,
          finalizationId: effect.finalizationId,
          referralId: intent.referralId,
          inviterId: intent.inviterId,
          referredUserId: intent.referredUserId,
          transactionId,
          rewardType: intent.rewardType,
          rewardRateBasisPoints: intent.rewardRateBasisPoints,
          effectiveRate: expectedEffectiveRate,
          purchaseAmountCentavos: intent.purchaseAmountCentavos,
          rewardAmountCentavos: intent.rewardAmountCentavos,
          holdingPeriodDays: intent.holdingPeriodDays,
          holdingUntil: intent.holdingUntil,
          qualifiedAt: effect.finalization.verifiedAt.toISOString(),
        },
      },
    });

    return { outcome: "CREATED", reward, isReplay: false };
  }
}
