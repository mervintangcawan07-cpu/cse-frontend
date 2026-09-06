// Relative Path: src/lib/payment/paymentFinalizationManifestService.ts
/**
 * GovStudyX Durable Payment Finalization Recovery Engine (Phase 1 / Slice 2.1)
 *
 * Authoritative, deterministic, read-only Payment Finalization Manifest Planner.
 * Generates immutable financial intent manifests and cryptographic SHA-256 hashes.
 *
 * STRICTLY READ-ONLY / DORMANT — ZERO APPLICATION SIDE-EFFECTS OR WRITES.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { DEFAULT_REFERRAL_CONFIG, REFERRAL_SETTING_KEYS } from "@/lib/referral/config";
import { sanitizeRewardPercentage } from "@/lib/referral/rewardCalculator";
import {
  MANIFEST_VERSION,
  INTENT_VERSION,
  SUPPORTED_CURRENCY,
  SupportedPlanType,
  FinalizationPlanningInput,
  PlannedManifest,
  PlannedEffect,
  PaymentLedgerIntent,
  ProviderFeeLedgerIntent,
  ReferralRewardIntent,
  PartnerCommissionIntent,
  PartnerLiabilityLedgerIntent,
  TaxProvisionIntent,
  ReconciliationIntent,
  PartnerCommissionNotApplicableReason,
  IFinalizationDataReader,
  TransactionIdentityForPlanning,
  UserRecordForPlanning,
  ReferralAttributionForPlanning,
  PartnerAttributionForPlanning,
  PartnerCommissionRecordForPlanning,
  TaxConfigForPlanning,
  PaymentFinalizationV1TaxType,
  PAYMENT_FINALIZATION_V1_TAX_TYPES,
  MissingAuthoritativeGrossError,
  DuplicateEffectKeyError,
  InvalidFeeStateError,
  UserNotFoundError,
  TransactionNotFoundError,
  TransactionIdentityMismatchError,
  ExistingReferralRewardConflictError,
  ExistingPartnerCommissionConflictError,
  PaymentFinalizationPlanningError,
  InvalidMonetaryAmountError,
  InvalidTimestampError,
  validatePlanType,
  validateCurrency,
  validateTransactionId,
  validateContextIdentifier,
  validateSafeCentavos,
  validateSafeRate,
  rateToBasisPoints,
  validateIdentifier,
  validateIsoUtcTimestamp,
  buildPaymentFinalizationOperationKey,
  canonicalizeJson,
  computeSha256Hash,
} from "./paymentFinalizationContracts";

const POSTGRESQL_INTEGER_MAX = 2_147_483_647;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ReferralPlanningConfig {
  readonly programEnabled: boolean;
  readonly rewardType: "PERCENTAGE" | "FIXED";
  readonly rewardPercentage: number;
  readonly fixedRewardAmountCentavos: number;
  readonly holdingPeriodDays: number;
}

function parsePresentFiniteNumber(
  rawValue: string,
  fieldName: string,
  errorCode: "PLANNING_ERROR" | "INVALID_RATE"
): number {
  if (rawValue.trim().length === 0) {
    throw new PaymentFinalizationPlanningError(
      `${fieldName} setting is invalid.`,
      errorCode
    );
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    throw new PaymentFinalizationPlanningError(
      `${fieldName} setting is invalid.`,
      errorCode
    );
  }

  return parsed;
}

function validateFixedRewardAmountCentavos(value: number): number {
  if (
    !Number.isFinite(value) ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > POSTGRESQL_INTEGER_MAX
  ) {
    throw new InvalidMonetaryAmountError(
      "Referral fixed reward amount setting is invalid."
    );
  }

  return value;
}

function parseFixedRewardAmountCentavos(rawValue: string): number {
  if (rawValue.trim().length === 0) {
    throw new InvalidMonetaryAmountError(
      "Referral fixed reward amount setting is invalid."
    );
  }

  return validateFixedRewardAmountCentavos(Number(rawValue));
}

function validateHoldingPeriodDays(value: number): number {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0) {
    throw new PaymentFinalizationPlanningError(
      "Referral holding period setting is invalid.",
      "PLANNING_ERROR"
    );
  }

  return value;
}

function validatePartnerHoldingPeriodDays(value: number): number {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0) {
    throw new PaymentFinalizationPlanningError(
      "Partner holding period setting is invalid.",
      "PLANNING_ERROR"
    );
  }

  return value;
}

function validateFixedCommissionCentavos(value: number): number {
  if (
    !Number.isFinite(value) ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > POSTGRESQL_INTEGER_MAX
  ) {
    throw new InvalidMonetaryAmountError(
      "Partner fixed commission amount setting is invalid."
    );
  }

  return value;
}

const PAYMENT_FINALIZATION_V1_TAX_TYPE_SET: ReadonlySet<string> = new Set(
  PAYMENT_FINALIZATION_V1_TAX_TYPES
);

function validatePaymentFinalizationV1TaxType(
  value: unknown
): PaymentFinalizationV1TaxType {
  if (
    typeof value !== "string" ||
    !PAYMENT_FINALIZATION_V1_TAX_TYPE_SET.has(value)
  ) {
    throw new PaymentFinalizationPlanningError(
      "tax.taxType is unsupported for payment-finalization manifest version 1.",
      "PLANNING_ERROR"
    );
  }

  return value as PaymentFinalizationV1TaxType;
}

function validateTaxFixedAmountCentavos(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > POSTGRESQL_INTEGER_MAX
  ) {
    throw new InvalidMonetaryAmountError(
      "tax.fixedAmountCentavos must be a non-negative PostgreSQL INTEGER centavo amount."
    );
  }

  return value;
}

function validateTaxCalculationBasis(
  value: unknown
): "CUSTOMER_PAYMENT" | "GROSS_SALE" {
  if (value !== "CUSTOMER_PAYMENT" && value !== "GROSS_SALE") {
    throw new PaymentFinalizationPlanningError(
      "tax.calculationBasis is unsupported for payment-finalization manifest version 1.",
      "PLANNING_ERROR"
    );
  }

  return value;
}

function validateTaxApplicableTransactionType(value: unknown): "ALL" {
  if (value !== "ALL") {
    throw new PaymentFinalizationPlanningError(
      'tax.applicableTransactionType must be exactly "ALL" for payment-finalization manifest version 1.',
      "PLANNING_ERROR"
    );
  }

  return value;
}

export function parseReferralPlanningConfig(
  settings: readonly { readonly key: string; readonly value: string }[]
): ReferralPlanningConfig {
  const settingsMap = new Map<string, string>(
    settings.map((setting) => [setting.key, setting.value])
  );

  const rawProgramEnabled = settingsMap.get(REFERRAL_SETTING_KEYS.PROGRAM_ENABLED);
  let programEnabled = DEFAULT_REFERRAL_CONFIG.programEnabled;
  if (rawProgramEnabled !== undefined) {
    if (rawProgramEnabled === "true") {
      programEnabled = true;
    } else if (rawProgramEnabled === "false") {
      programEnabled = false;
    } else {
      throw new PaymentFinalizationPlanningError(
        "Referral program enabled setting is invalid.",
        "PLANNING_ERROR"
      );
    }
  }

  const rawRewardType = settingsMap.get(REFERRAL_SETTING_KEYS.REWARD_TYPE);
  let rewardType: "PERCENTAGE" | "FIXED";
  if (rawRewardType === undefined) {
    rewardType =
      DEFAULT_REFERRAL_CONFIG.rewardType === "FIXED_AMOUNT" ? "FIXED" : "PERCENTAGE";
  } else if (rawRewardType === "PERCENTAGE") {
    rewardType = "PERCENTAGE";
  } else if (rawRewardType === "FIXED_AMOUNT") {
    rewardType = "FIXED";
  } else {
    throw new PaymentFinalizationPlanningError(
      "Referral reward type setting is invalid.",
      "PLANNING_ERROR"
    );
  }

  const rawRewardPercentage = settingsMap.get(REFERRAL_SETTING_KEYS.REWARD_PERCENTAGE);
  const rewardPercentage =
    rawRewardPercentage === undefined
      ? DEFAULT_REFERRAL_CONFIG.rewardPercentage
      : sanitizeRewardPercentage(
          parsePresentFiniteNumber(
            rawRewardPercentage,
            "Referral reward percentage",
            "INVALID_RATE"
          ),
          DEFAULT_REFERRAL_CONFIG.rewardPercentage
        );

  const rawFixedRewardAmount = settingsMap.get(
    REFERRAL_SETTING_KEYS.FIXED_REWARD_AMOUNT_CENTAVOS
  );
  const fixedRewardAmountCentavos = validateFixedRewardAmountCentavos(
    rawFixedRewardAmount === undefined
      ? DEFAULT_REFERRAL_CONFIG.fixedRewardAmountCentavos
      : parseFixedRewardAmountCentavos(rawFixedRewardAmount)
  );

  const rawHoldingPeriodDays = settingsMap.get(REFERRAL_SETTING_KEYS.HOLDING_PERIOD_DAYS);
  const holdingPeriodDays = validateHoldingPeriodDays(
    rawHoldingPeriodDays === undefined
      ? DEFAULT_REFERRAL_CONFIG.holdingPeriodDays
      : parsePresentFiniteNumber(
          rawHoldingPeriodDays,
          "Referral holding period",
          "PLANNING_ERROR"
        )
  );

  return {
    programEnabled,
    rewardType,
    rewardPercentage,
    fixedRewardAmountCentavos,
    holdingPeriodDays,
  };
}

/**
 * Production read-only data reader backed by Prisma Client queries.
 * Strictly invokes only read-only queries (findUnique, findMany, findFirst).
 * Contains ZERO mutating calls (no create, update, delete, upsert, executeRaw).
 */
export class PrismaFinalizationDataReader implements IFinalizationDataReader {
  async findTransactionIdentity(transactionId: string): Promise<TransactionIdentityForPlanning | null> {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, userId: true, checkoutSessionId: true },
    });
    if (!tx) return null;
    return {
      id: tx.id,
      userId: tx.userId,
      checkoutSessionId: tx.checkoutSessionId ?? "",
    };
  }

  async findUser(userId: string): Promise<UserRecordForPlanning | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isPaid: true, paidUntil: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      isPaid: user.isPaid,
      paidUntil: user.paidUntil ? user.paidUntil.toISOString() : null,
    };
  }

  async findReferralAttribution(userId: string): Promise<ReferralAttributionForPlanning | null> {
    const referral = await prisma.referral.findUnique({
      where: { referredUserId: userId },
      include: {
        reward: true,
      },
    });

    if (!referral) return null;

    let settings: readonly { readonly key: string; readonly value: string }[];
    try {
      settings = await prisma.referralProgramSetting.findMany();
    } catch {
      throw new PaymentFinalizationPlanningError(
        "Referral planning configuration could not be read.",
        "PLANNING_ERROR"
      );
    }
    const planningConfig = parseReferralPlanningConfig(settings);

    const existingReward = referral.reward
      ? { id: referral.reward.id, transactionId: referral.reward.transactionId }
      : null;

    return {
      referralId: referral.id,
      inviterId: referral.inviterId,
      ...planningConfig,
      existingReward,
    };
  }

  async findExistingPartnerCommission(transactionId: string): Promise<PartnerCommissionRecordForPlanning | null> {
    const commission = await prisma.partnerCommission.findUnique({
      where: { transactionId },
      select: { id: true, partnerId: true, transactionId: true },
    });
    if (!commission) return null;
    return {
      id: commission.id,
      partnerId: commission.partnerId,
      transactionId: commission.transactionId,
    };
  }

  async findPartnerAttribution(userId: string): Promise<PartnerAttributionForPlanning | null> {
    const attribution = await prisma.partnerAttribution.findUnique({
      where: { referredUserId: userId },
      include: { partner: true },
    });

    if (!attribution) return null;

    return {
      partnerId: attribution.partner.id,
      partnerCode: attribution.partner.code,
      status: attribution.partner.status,
      commissionModel: attribution.partner.commissionModel,
      commissionRate: attribution.partner.commissionRate,
      fixedCommissionCentavos: attribution.partner.fixedCommissionCentavos ?? 0,
      holdingPeriodDays: attribution.partner.holdingPeriodDays ?? 7,
      defaultCampaignSource: attribution.campaignSource,
    };
  }

  async findActiveTaxConfigs(referenceDate: Date): Promise<TaxConfigForPlanning[]> {
    const configs = await prisma.taxConfiguration.findMany({
      where: {
        status: "ACTIVE",
        effectiveDate: { lte: referenceDate },
        OR: [{ expirationDate: null }, { expirationDate: { gte: referenceDate } }],
      },
      orderBy: { id: "asc" },
    });

    return configs.map((c) => ({
      id: c.id,
      name: c.name,
      taxType: c.taxType,
      rate: c.rate,
      fixedAmountCentavos: c.fixedAmountCentavos,
      calculationBasis: c.calculationBasis,
      applicableTransactionType: c.applicableTransactionType,
    }));
  }
}

/**
 * Transaction-scoped finalization data reader.
 * Enables deterministic manifest planning within an active uncommitted database transaction.
 * Pure read-only; delegates strictly to the provided Prisma.TransactionClient with zero fallback.
 */
export class TransactionScopedFinalizationDataReader implements IFinalizationDataReader {
  constructor(private readonly tx: Prisma.TransactionClient) {
    if (!tx || typeof tx !== "object" || !("$queryRaw" in tx)) {
      throw new TypeError(
        "TransactionScopedFinalizationDataReader requires a valid Prisma.TransactionClient."
      );
    }
  }

  async findTransactionIdentity(transactionId: string): Promise<TransactionIdentityForPlanning | null> {
    const record = await this.tx.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, userId: true, checkoutSessionId: true },
    });
    if (!record) return null;
    return {
      id: record.id,
      userId: record.userId,
      checkoutSessionId: record.checkoutSessionId ?? "",
    };
  }

  async findUser(userId: string): Promise<UserRecordForPlanning | null> {
    const user = await this.tx.user.findUnique({
      where: { id: userId },
      select: { id: true, isPaid: true, paidUntil: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      isPaid: user.isPaid,
      paidUntil: user.paidUntil ? user.paidUntil.toISOString() : null,
    };
  }

  async findReferralAttribution(userId: string): Promise<ReferralAttributionForPlanning | null> {
    const referral = await this.tx.referral.findUnique({
      where: { referredUserId: userId },
      include: {
        reward: true,
      },
    });

    if (!referral) return null;

    let settings: readonly { readonly key: string; readonly value: string }[];
    try {
      settings = await this.tx.referralProgramSetting.findMany();
    } catch {
      throw new PaymentFinalizationPlanningError(
        "Referral planning configuration could not be read.",
        "PLANNING_ERROR"
      );
    }
    const planningConfig = parseReferralPlanningConfig(settings);

    const existingReward = referral.reward
      ? { id: referral.reward.id, transactionId: referral.reward.transactionId }
      : null;

    return {
      referralId: referral.id,
      inviterId: referral.inviterId,
      ...planningConfig,
      existingReward,
    };
  }

  async findExistingPartnerCommission(transactionId: string): Promise<PartnerCommissionRecordForPlanning | null> {
    const commission = await this.tx.partnerCommission.findUnique({
      where: { transactionId },
      select: { id: true, partnerId: true, transactionId: true },
    });
    if (!commission) return null;
    return {
      id: commission.id,
      partnerId: commission.partnerId,
      transactionId: commission.transactionId,
    };
  }

  async findPartnerAttribution(userId: string): Promise<PartnerAttributionForPlanning | null> {
    const attribution = await this.tx.partnerAttribution.findUnique({
      where: { referredUserId: userId },
      include: { partner: true },
    });

    if (!attribution) return null;

    return {
      partnerId: attribution.partner.id,
      partnerCode: attribution.partner.code,
      status: attribution.partner.status,
      commissionModel: attribution.partner.commissionModel,
      commissionRate: attribution.partner.commissionRate,
      fixedCommissionCentavos: attribution.partner.fixedCommissionCentavos ?? 0,
      holdingPeriodDays: attribution.partner.holdingPeriodDays ?? 7,
      defaultCampaignSource: attribution.campaignSource,
    };
  }

  async findActiveTaxConfigs(referenceDate: Date): Promise<TaxConfigForPlanning[]> {
    const configs = await this.tx.taxConfiguration.findMany({
      where: {
        status: "ACTIVE",
        effectiveDate: { lte: referenceDate },
        OR: [{ expirationDate: null }, { expirationDate: { gte: referenceDate } }],
      },
      orderBy: { id: "asc" },
    });

    return configs.map((c) => ({
      id: c.id,
      name: c.name,
      taxType: c.taxType,
      rate: c.rate,
      fixedAmountCentavos: c.fixedAmountCentavos,
      calculationBasis: c.calculationBasis,
      applicableTransactionType: c.applicableTransactionType,
    }));
  }
}


/**
 * Pure, deterministic finalization manifest planner.
 * Given verified payment input and a read-only reader, plans all required
 * downstream ledger, commission, tax, and reconciliation effects with zero database mutation.
 */
export class PaymentFinalizationManifestService {
  private static defaultReader: IFinalizationDataReader = new PrismaFinalizationDataReader();

  /**
   * Plans the complete immutable Payment Finalization Manifest.
   */
  static async planFinalization(
    input: FinalizationPlanningInput,
    reader: IFinalizationDataReader = PaymentFinalizationManifestService.defaultReader
  ): Promise<PlannedManifest> {
    const validatedTxId = validateTransactionId(input.transactionId);
    const validatedCheckoutSessionId = validateContextIdentifier(
      input.checkoutSessionId,
      "checkoutSessionId"
    );
    const validatedUserId = validateContextIdentifier(input.userId, "userId");
    const validatedPlan = validatePlanType(input.planType);
    const validatedCurrency = validateCurrency(input.currency);

    // Mandatory authoritative verified timestamp (zero ambient wall-clock fallback)
    const normalizedVerifiedAt = validateIsoUtcTimestamp(
      input.verifiedAtIso,
      "verifiedAtIso",
      false
    )!;
    const verifiedAtDate = new Date(normalizedVerifiedAt);

    // Optional provider payment timestamps (strictly normalized UTC strings when supplied)
    const providerPaymentId = input.providerPaymentId
      ? validateContextIdentifier(input.providerPaymentId, "providerPaymentId")
      : null;
    const providerPaidAt = validateIsoUtcTimestamp(
      input.providerPaidAtIso,
      "providerPaidAtIso",
      true
    );

    // 🔒 1. BIND TRANSACTION IDENTITY TO DATABASE SOURCE OF TRUTH
    const txIdentity = await reader.findTransactionIdentity(validatedTxId);
    if (!txIdentity) {
      throw new TransactionNotFoundError(
        `Transaction with ID "${validatedTxId}" not found in database.`
      );
    }
    if (txIdentity.id !== validatedTxId) {
      throw new TransactionIdentityMismatchError(
        `Transaction ID mismatch: expected "${validatedTxId}", found "${txIdentity.id}".`
      );
    }
    if (txIdentity.userId !== validatedUserId) {
      throw new TransactionIdentityMismatchError(
        `Transaction ownership mismatch: requested userId "${validatedUserId}" does not match transaction record userId "${txIdentity.userId}".`
      );
    }
    if (txIdentity.checkoutSessionId !== validatedCheckoutSessionId) {
      throw new TransactionIdentityMismatchError(
        `Transaction checkoutSessionId mismatch: requested "${validatedCheckoutSessionId}" does not match transaction record "${txIdentity.checkoutSessionId}".`
      );
    }

    // 🔒 2. USER & ENTITLEMENT SNAPSHOT
    const user = await reader.findUser(validatedUserId);
    if (!user) {
      throw new UserNotFoundError(`User with ID "${validatedUserId}" not found in database.`);
    }

    const entitlementBefore = user.paidUntil
      ? validateIsoUtcTimestamp(user.paidUntil, "user.paidUntil", true)
      : null;

    const baseEntitlementDate =
      entitlementBefore && new Date(entitlementBefore).getTime() > verifiedAtDate.getTime()
        ? new Date(entitlementBefore)
        : new Date(verifiedAtDate);

    const durationDays =
      validatedPlan === "1_MONTH" ? 30 : validatedPlan === "6_MONTHS" ? 180 : 365;

    const entitlementAfterDate = new Date(baseEntitlementDate);
    entitlementAfterDate.setDate(entitlementAfterDate.getDate() + durationDays);
    const entitlementAfter = entitlementAfterDate.toISOString();

    // 🔒 3. STRICT FEE KNOWLEDGE CONTRACT
    let feeAmountCentavos: number | null = null;
    let feeObservedAt: string | null = null;

    if (input.feeKnowledge === "UNKNOWN") {
      if (input.feeAmountCentavos !== undefined && input.feeAmountCentavos !== null) {
        throw new InvalidFeeStateError(
          "feeAmountCentavos must not be supplied when feeKnowledge is UNKNOWN."
        );
      }
      if (input.feeObservedAtIso !== undefined && input.feeObservedAtIso !== null) {
        throw new InvalidFeeStateError(
          "feeObservedAtIso must not be supplied when feeKnowledge is UNKNOWN."
        );
      }
      feeAmountCentavos = null;
      feeObservedAt = null;
    } else {
      // KNOWN fee knowledge requires explicit feeAmountCentavos
      if (input.feeAmountCentavos === undefined || input.feeAmountCentavos === null) {
        throw new InvalidFeeStateError(
          "feeAmountCentavos must be explicitly provided when feeKnowledge is KNOWN."
        );
      }
      feeAmountCentavos = validateSafeCentavos(
        input.feeAmountCentavos,
        "feeAmountCentavos",
        true
      );
      feeObservedAt = validateIsoUtcTimestamp(
        input.feeObservedAtIso,
        "feeObservedAtIso",
        true
      );
    }

    const customerPaymentCentavos = validateSafeCentavos(
      input.purchaseAmountCentavos,
      "purchaseAmountCentavos",
      false
    );

    // 🔒 4. PLAN ALL DOWNSTREAM FINANCIAL EFFECTS
    const paymentLedgerEffect = this.planPaymentLedgerEffect(
      validatedTxId,
      validatedUserId,
      validatedPlan,
      customerPaymentCentavos
    );

    const providerFeeLedgerEffect = this.planProviderFeeLedgerEffect(
      validatedTxId,
      input.feeKnowledge,
      feeAmountCentavos
    );

    const referralRewardEffect = await this.planReferralRewardEffect(
      validatedTxId,
      validatedUserId,
      customerPaymentCentavos,
      normalizedVerifiedAt,
      reader
    );

    const partnerEffects = await this.planPartnerCommissionEffects(
      validatedTxId,
      validatedUserId,
      customerPaymentCentavos,
      input.authoritativeGrossAmountCentavos,
      input.campaignSource,
      normalizedVerifiedAt,
      reader
    );

    const taxEffects = await this.planTaxProvisionEffects(
      validatedTxId,
      customerPaymentCentavos,
      input.authoritativeGrossAmountCentavos,
      verifiedAtDate,
      reader
    );

    const reconciliationEffect = this.planReconciliationEffect(
      validatedTxId,
      customerPaymentCentavos,
      input.feeKnowledge,
      feeAmountCentavos
    );

    const allEffects: readonly PlannedEffect[] = [
      paymentLedgerEffect,
      providerFeeLedgerEffect,
      referralRewardEffect,
      ...partnerEffects,
      ...taxEffects,
      reconciliationEffect,
    ];

    // Enforce uniqueness of effectKey and operationKey across manifest
    const seenEffectKeys = new Set<string>();
    const seenOperationKeys = new Set<string>();

    for (const effect of allEffects) {
      const compositeEffectKey = `${effect.effectType}:${effect.effectKey}`;
      if (seenEffectKeys.has(compositeEffectKey)) {
        throw new DuplicateEffectKeyError(
          `Duplicate composite effect key within manifest: ${compositeEffectKey}`
        );
      }
      seenEffectKeys.add(compositeEffectKey);

      if (seenOperationKeys.has(effect.operationKey)) {
        throw new DuplicateEffectKeyError(
          `Duplicate operation key within manifest: ${effect.operationKey}`
        );
      }
      seenOperationKeys.add(effect.operationKey);
    }

    // 🔒 5. COMPLETE ROOT SNAPSHOT & CANONICAL MANIFEST HASH
    const manifestSummary = {
      manifestVersion: MANIFEST_VERSION,
      manifestRevision: 1,
      transactionId: validatedTxId,
      checkoutSessionId: validatedCheckoutSessionId,
      userId: validatedUserId,
      providerPaymentId,
      providerPaidAt,
      source: input.source,
      origin: input.origin ?? "NEW_PAYMENT",
      planType: validatedPlan,
      currency: validatedCurrency,
      purchaseAmountCentavos: customerPaymentCentavos,
      feeKnowledge: input.feeKnowledge,
      feeAmountCentavos,
      feeObservedAt,
      verifiedAt: normalizedVerifiedAt,
      entitlementBefore,
      entitlementAfter,
      effects: allEffects.map((e) => ({
        effectType: e.effectType,
        effectKey: e.effectKey,
        operationKey: e.operationKey,
        status: e.status,
        intentVersion: e.intentVersion,
        intentHash: e.intentHash,
      })),
    };

    const manifestHash = computeSha256Hash(canonicalizeJson(manifestSummary));

    return {
      manifestVersion: MANIFEST_VERSION,
      manifestRevision: 1,
      transactionId: validatedTxId,
      checkoutSessionId: validatedCheckoutSessionId,
      userId: validatedUserId,
      providerPaymentId,
      providerPaidAt,
      source: input.source,
      origin: input.origin ?? "NEW_PAYMENT",
      planType: validatedPlan,
      currency: validatedCurrency,
      purchaseAmountCentavos: customerPaymentCentavos,
      feeKnowledge: input.feeKnowledge,
      feeAmountCentavos,
      feeObservedAt,
      verifiedAt: normalizedVerifiedAt,
      entitlementBefore,
      entitlementAfter,
      manifestHash,
      effects: allEffects,
    };
  }

  /**
   * Plans the primary double-entry payment ledger entry (Debit CASH_PAYMONGO, Credit REVENUE_PREMIUM).
   * Operation Key: pfin:<transactionId>:payment
   */
  static planPaymentLedgerEffect(
    transactionId: string,
    userId: string,
    planType: SupportedPlanType,
    amountCentavos: number
  ): PlannedEffect {
    const effectKey = "payment";
    const operationKey = buildPaymentFinalizationOperationKey(transactionId, { kind: "PAYMENT" });

    const intent: PaymentLedgerIntent = {
      effectType: "PAYMENT_LEDGER",
      intentVersion: INTENT_VERSION,
      status: "PENDING",
      amountCentavos,
      userId,
      planType,
      debitCategory: "CASH_PAYMONGO",
      creditCategory: "REVENUE_PREMIUM",
    };

    const intentHash = computeSha256Hash(canonicalizeJson(intent));

    return {
      effectType: "PAYMENT_LEDGER",
      effectKey,
      operationKey,
      status: "PENDING",
      intentVersion: INTENT_VERSION,
      intent,
      intentHash,
    };
  }

  /**
   * Plans provider gateway fee entry (Debit EXPENSE_PAYMENT_FEE, Credit CASH_PAYMONGO).
   * Operation Key: pfin:<transactionId>:fee
   */
  static planProviderFeeLedgerEffect(
    transactionId: string,
    feeKnowledge: "UNKNOWN" | "KNOWN",
    feeAmountCentavos: number | null
  ): PlannedEffect {
    const effectKey = "fee";
    const operationKey = buildPaymentFinalizationOperationKey(transactionId, { kind: "FEE" });

    if (feeKnowledge === "UNKNOWN") {
      const intent: ProviderFeeLedgerIntent = {
        effectType: "PROVIDER_FEE_LEDGER",
        intentVersion: INTENT_VERSION,
        feeKnowledge: "UNKNOWN",
        feeAmountCentavos: null,
        status: "AWAITING_DATA",
        debitCategory: null,
        creditCategory: null,
      };
      const intentHash = computeSha256Hash(canonicalizeJson(intent));
      return {
        effectType: "PROVIDER_FEE_LEDGER",
        effectKey,
        operationKey,
        status: "AWAITING_DATA",
        intentVersion: INTENT_VERSION,
        intent,
        intentHash,
      };
    }

    if (feeAmountCentavos === 0) {
      const intent: ProviderFeeLedgerIntent = {
        effectType: "PROVIDER_FEE_LEDGER",
        intentVersion: INTENT_VERSION,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 0,
        status: "NOT_APPLICABLE",
        notApplicableReason: "ZERO_PROVIDER_FEE",
        debitCategory: null,
        creditCategory: null,
      };
      const intentHash = computeSha256Hash(canonicalizeJson(intent));
      return {
        effectType: "PROVIDER_FEE_LEDGER",
        effectKey,
        operationKey,
        status: "NOT_APPLICABLE",
        intentVersion: INTENT_VERSION,
        intent,
        intentHash,
      };
    }

    const intent: ProviderFeeLedgerIntent = {
      effectType: "PROVIDER_FEE_LEDGER",
      intentVersion: INTENT_VERSION,
      feeKnowledge: "KNOWN",
      feeAmountCentavos,
      status: "PENDING",
      debitCategory: "EXPENSE_PAYMENT_FEE",
      creditCategory: "CASH_PAYMONGO",
    };
    const intentHash = computeSha256Hash(canonicalizeJson(intent));

    return {
      effectType: "PROVIDER_FEE_LEDGER",
      effectKey,
      operationKey,
      status: "PENDING",
      intentVersion: INTENT_VERSION,
      intent,
      intentHash,
    };
  }

  /**
   * Plans student referral reward effect.
   * Operation Key: pfin:<transactionId>:referral
   */
  static async planReferralRewardEffect(
    transactionId: string,
    userId: string,
    customerPaymentCentavos: number,
    verifiedAtIso: string,
    reader: IFinalizationDataReader
  ): Promise<PlannedEffect> {
    const effectKey = "referral";
    const operationKey = buildPaymentFinalizationOperationKey(transactionId, { kind: "REFERRAL" });

    const attribution = await reader.findReferralAttribution(userId);

    if (!attribution) {
      const intent: ReferralRewardIntent = {
        effectType: "REFERRAL_REWARD",
        intentVersion: INTENT_VERSION,
        status: "NOT_APPLICABLE",
        notApplicableReason: "NO_REFERRAL_ATTRIBUTION",
        referralId: null,
        inviterId: null,
        referredUserId: userId,
        purchaseAmountCentavos: customerPaymentCentavos,
        rewardType: null,
        rewardRateBasisPoints: null,
        rewardAmountCentavos: 0,
        currency: SUPPORTED_CURRENCY,
        holdingPeriodDays: null,
        holdingUntil: null,
      };
      const intentHash = computeSha256Hash(canonicalizeJson(intent));
      return {
        effectType: "REFERRAL_REWARD",
        effectKey,
        operationKey,
        status: "NOT_APPLICABLE",
        intentVersion: INTENT_VERSION,
        intent,
        intentHash,
      };
    }

    // Preserve same-transaction conflict precedence before producing any intent.
    if (attribution.existingReward !== null) {
      if (attribution.existingReward.transactionId === transactionId) {
        throw new ExistingReferralRewardConflictError(
          `A ReferralReward already exists for this transaction (Reward ID: "${attribution.existingReward.id}").`
        );
      }
    }

    const normalizedHoldingPeriodDays = validateHoldingPeriodDays(
      attribution.holdingPeriodDays
    );
    let rewardRateBasisPoints = 0;
    let canonicalRewardPercentage = 0;
    if (attribution.rewardType === "PERCENTAGE") {
      const safeRate = validateSafeRate(attribution.rewardPercentage, "rewardPercentage");
      rewardRateBasisPoints = rateToBasisPoints(safeRate);
      canonicalRewardPercentage = rewardRateBasisPoints / 100;
    }

    if (attribution.existingReward !== null) {
      if (attribution.existingReward.transactionId !== transactionId) {
        // Referral was already rewarded on an earlier transaction (1 reward per referral lifetime)
        const intent: ReferralRewardIntent = {
          effectType: "REFERRAL_REWARD",
          intentVersion: INTENT_VERSION,
          status: "NOT_APPLICABLE",
          notApplicableReason: "REFERRAL_ALREADY_REWARDED",
          referralId: attribution.referralId,
          inviterId: attribution.inviterId,
          referredUserId: userId,
          purchaseAmountCentavos: customerPaymentCentavos,
          rewardType: attribution.rewardType,
          rewardRateBasisPoints,
          rewardAmountCentavos: 0,
          currency: SUPPORTED_CURRENCY,
          holdingPeriodDays: normalizedHoldingPeriodDays,
          holdingUntil: null,
        };
        const intentHash = computeSha256Hash(canonicalizeJson(intent));
        return {
          effectType: "REFERRAL_REWARD",
          effectKey,
          operationKey,
          status: "NOT_APPLICABLE",
          intentVersion: INTENT_VERSION,
          intent,
          intentHash,
          referralId: attribution.referralId,
        };
      }
    }

    if (!attribution.programEnabled) {
      const intent: ReferralRewardIntent = {
        effectType: "REFERRAL_REWARD",
        intentVersion: INTENT_VERSION,
        status: "NOT_APPLICABLE",
        notApplicableReason: "PROGRAM_DISABLED",
        referralId: attribution.referralId,
        inviterId: attribution.inviterId,
        referredUserId: userId,
        purchaseAmountCentavos: customerPaymentCentavos,
        rewardType: attribution.rewardType,
        rewardRateBasisPoints,
        rewardAmountCentavos: 0,
        currency: SUPPORTED_CURRENCY,
        holdingPeriodDays: normalizedHoldingPeriodDays,
        holdingUntil: null,
      };
      const intentHash = computeSha256Hash(canonicalizeJson(intent));
      return {
        effectType: "REFERRAL_REWARD",
        effectKey,
        operationKey,
        status: "NOT_APPLICABLE",
        intentVersion: INTENT_VERSION,
        intent,
        intentHash,
        referralId: attribution.referralId,
      };
    }

    let calculatedRewardCentavos = 0;

    if (attribution.rewardType === "FIXED") {
      calculatedRewardCentavos = validateFixedRewardAmountCentavos(
        attribution.fixedRewardAmountCentavos
      );
    } else {
      calculatedRewardCentavos = Math.round(
        (customerPaymentCentavos * canonicalRewardPercentage) / 100
      );
    }

    if (calculatedRewardCentavos <= 0) {
      const intent: ReferralRewardIntent = {
        effectType: "REFERRAL_REWARD",
        intentVersion: INTENT_VERSION,
        status: "NOT_APPLICABLE",
        notApplicableReason: "ZERO_REWARD_CALCULATED",
        referralId: attribution.referralId,
        inviterId: attribution.inviterId,
        referredUserId: userId,
        purchaseAmountCentavos: customerPaymentCentavos,
        rewardType: attribution.rewardType,
        rewardRateBasisPoints,
        rewardAmountCentavos: 0,
        currency: SUPPORTED_CURRENCY,
        holdingPeriodDays: normalizedHoldingPeriodDays,
        holdingUntil: null,
      };
      const intentHash = computeSha256Hash(canonicalizeJson(intent));
      return {
        effectType: "REFERRAL_REWARD",
        effectKey,
        operationKey,
        status: "NOT_APPLICABLE",
        intentVersion: INTENT_VERSION,
        intent,
        intentHash,
        referralId: attribution.referralId,
      };
    }

    const verifiedDate = new Date(verifiedAtIso);
    const verifiedTimestamp = verifiedDate.getTime();
    const holdingDurationMilliseconds = normalizedHoldingPeriodDays * MILLISECONDS_PER_DAY;
    const holdingUntilTimestamp = verifiedTimestamp + holdingDurationMilliseconds;
    if (
      !Number.isFinite(verifiedTimestamp) ||
      !Number.isSafeInteger(holdingDurationMilliseconds) ||
      !Number.isSafeInteger(holdingUntilTimestamp)
    ) {
      throw new InvalidTimestampError("Referral holding-until timestamp is invalid.");
    }

    const holdingUntilDate = new Date(holdingUntilTimestamp);
    if (!Number.isFinite(holdingUntilDate.getTime())) {
      throw new InvalidTimestampError("Referral holding-until timestamp is invalid.");
    }

    const intent: ReferralRewardIntent = {
      effectType: "REFERRAL_REWARD",
      intentVersion: INTENT_VERSION,
      status: "PENDING",
      referralId: attribution.referralId,
      inviterId: attribution.inviterId,
      referredUserId: userId,
      purchaseAmountCentavos: customerPaymentCentavos,
      rewardType: attribution.rewardType,
      rewardRateBasisPoints,
      rewardAmountCentavos: calculatedRewardCentavos,
      currency: SUPPORTED_CURRENCY,
      holdingPeriodDays: normalizedHoldingPeriodDays,
      holdingUntil: holdingUntilDate.toISOString(),
    };

    const intentHash = computeSha256Hash(canonicalizeJson(intent));

    return {
      effectType: "REFERRAL_REWARD",
      effectKey,
      operationKey,
      status: "PENDING",
      intentVersion: INTENT_VERSION,
      intent,
      intentHash,
      referralId: attribution.referralId,
    };
  }

  /**
   * Plans partner commission and partner liability ledger effects.
   * Operation Keys:
   *   Commission: pfin:<transactionId>:partner-commission
   *   Liability:  pfin:<transactionId>:partner-liability
   */
  static async planPartnerCommissionEffects(
    transactionId: string,
    userId: string,
    customerPaymentCentavos: number,
    authoritativeGrossAmountCentavos: number | undefined,
    campaignSource: string | null | undefined,
    verifiedAtIso: string,
    reader: IFinalizationDataReader
  ): Promise<PlannedEffect[]> {
    const commissionEffectKey = "partner-commission";
    const liabilityEffectKey = "partner-liability";
    const commissionOpKey = buildPaymentFinalizationOperationKey(transactionId, {
      kind: "PARTNER_COMMISSION",
    });
    const liabilityOpKey = buildPaymentFinalizationOperationKey(transactionId, {
      kind: "PARTNER_LIABILITY",
    });

    // 🔒 Check existing partner commission on THIS transaction
    const existingCommission = await reader.findExistingPartnerCommission(transactionId);
    if (existingCommission !== null) {
      throw new ExistingPartnerCommissionConflictError(
        `A PartnerCommission already exists for this transaction (Commission ID: "${existingCommission.id}").`
      );
    }

    const attribution = await reader.findPartnerAttribution(userId);

    if (!attribution || attribution.status !== "ACTIVE") {
      const notApplicableReason: PartnerCommissionNotApplicableReason = !attribution
        ? "NO_PARTNER_ATTRIBUTION"
        : "INACTIVE_PARTNER";

      const commIntent: PartnerCommissionIntent = {
        effectType: "PARTNER_COMMISSION",
        intentVersion: INTENT_VERSION,
        status: "NOT_APPLICABLE",
        notApplicableReason,
        partnerId: attribution?.partnerId ?? null,
        partnerCode: attribution?.partnerCode ?? null,
        commissionModel: attribution?.commissionModel ?? null,
        commissionRateBasisPoints: null,
        calculationBasis: null,
        baseAmountCentavos: null,
        commissionAmountCentavos: 0,
        currency: SUPPORTED_CURRENCY,
        campaignSource: campaignSource ?? attribution?.defaultCampaignSource ?? null,
        holdingPeriodDays: null,
        holdingUntil: null,
      };

      const liabIntent: PartnerLiabilityLedgerIntent = {
        effectType: "PARTNER_LIABILITY_LEDGER",
        intentVersion: INTENT_VERSION,
        status: "NOT_APPLICABLE",
        notApplicableReason: "NO_PARTNER_COMMISSION",
        partnerId: attribution?.partnerId ?? null,
        amountCentavos: 0,
        debitCategory: null,
        creditCategory: null,
      };

      return [
        {
          effectType: "PARTNER_COMMISSION",
          effectKey: commissionEffectKey,
          operationKey: commissionOpKey,
          status: "NOT_APPLICABLE",
          intentVersion: INTENT_VERSION,
          intent: commIntent,
          intentHash: computeSha256Hash(canonicalizeJson(commIntent)),
          partnerId: attribution?.partnerId ?? null,
        },
        {
          effectType: "PARTNER_LIABILITY_LEDGER",
          effectKey: liabilityEffectKey,
          operationKey: liabilityOpKey,
          status: "NOT_APPLICABLE",
          intentVersion: INTENT_VERSION,
          intent: liabIntent,
          intentHash: computeSha256Hash(canonicalizeJson(liabIntent)),
          partnerId: attribution?.partnerId ?? null,
        },
      ];
    }

    // 🔒 1. CLASSIFY ACTIVE MODEL BEFORE HOLDING VALIDATION (Fail closed immediately on unsupported models)
    if (
      attribution.commissionModel !== "PERCENTAGE_OF_CUSTOMER_PAYMENT" &&
      attribution.commissionModel !== "PERCENTAGE_OF_GROSS" &&
      attribution.commissionModel !== "FIXED_PER_PURCHASE"
    ) {
      throw new PaymentFinalizationPlanningError(
        `Unsupported partner commission model: "${attribution.commissionModel}".`,
        "PLANNING_ERROR"
      );
    }

    // 🔒 2. VALIDATE HOLDING PERIOD FOR SUPPORTED ACTIVE MODELS
    const normalizedHoldingPeriodDays = validatePartnerHoldingPeriodDays(
      attribution.holdingPeriodDays
    );

    // 🔒 3. MODEL-SPECIFIC FINANCIAL INPUT VALIDATION & CALCULATION
    let calculationBasis: "CUSTOMER_PAYMENT" | "GROSS_PRICE" | "FIXED_AMOUNT";
    let baseAmountCentavos: number | null;
    let commissionAmountCentavos = 0;
    let effectiveRateBps: number;

    if (attribution.commissionModel === "PERCENTAGE_OF_GROSS") {
      const safeRate = validateSafeRate(attribution.commissionRate, "commissionRate");
      const rateBps = rateToBasisPoints(safeRate);
      const canonicalPercentage = rateBps / 100;

      if (
        authoritativeGrossAmountCentavos === undefined ||
        authoritativeGrossAmountCentavos === null
      ) {
        throw new MissingAuthoritativeGrossError(
          "authoritativeGrossAmountCentavos is required for PERCENTAGE_OF_GROSS partner commission model."
        );
      }
      const grossCentavos = validateSafeCentavos(
        authoritativeGrossAmountCentavos,
        "authoritativeGrossAmountCentavos",
        false
      );
      calculationBasis = "GROSS_PRICE";
      baseAmountCentavos = grossCentavos;
      commissionAmountCentavos = Math.round((grossCentavos * canonicalPercentage) / 100);
      effectiveRateBps = rateBps;
    } else if (attribution.commissionModel === "PERCENTAGE_OF_CUSTOMER_PAYMENT") {
      const safeRate = validateSafeRate(attribution.commissionRate, "commissionRate");
      const rateBps = rateToBasisPoints(safeRate);
      const canonicalPercentage = rateBps / 100;

      calculationBasis = "CUSTOMER_PAYMENT";
      baseAmountCentavos = customerPaymentCentavos;
      commissionAmountCentavos = Math.round((customerPaymentCentavos * canonicalPercentage) / 100);
      effectiveRateBps = rateBps;
    } else {
      // attribution.commissionModel === "FIXED_PER_PURCHASE"
      calculationBasis = "FIXED_AMOUNT";
      baseAmountCentavos = null;
      commissionAmountCentavos = validateFixedCommissionCentavos(
        attribution.fixedCommissionCentavos
      );
      effectiveRateBps = 0;
    }

    const effectiveCampaignSource =
      campaignSource ?? attribution.defaultCampaignSource ?? "direct";

    if (commissionAmountCentavos <= 0) {
      const commIntent: PartnerCommissionIntent = {
        effectType: "PARTNER_COMMISSION",
        intentVersion: INTENT_VERSION,
        status: "NOT_APPLICABLE",
        notApplicableReason: "ZERO_COMMISSION_CALCULATED",
        partnerId: attribution.partnerId,
        partnerCode: attribution.partnerCode,
        commissionModel: attribution.commissionModel,
        commissionRateBasisPoints: effectiveRateBps,
        calculationBasis,
        baseAmountCentavos,
        commissionAmountCentavos: 0,
        currency: SUPPORTED_CURRENCY,
        campaignSource: effectiveCampaignSource,
        holdingPeriodDays: normalizedHoldingPeriodDays,
        holdingUntil: null,
      };

      const liabIntent: PartnerLiabilityLedgerIntent = {
        effectType: "PARTNER_LIABILITY_LEDGER",
        intentVersion: INTENT_VERSION,
        status: "NOT_APPLICABLE",
        notApplicableReason: "NO_PARTNER_COMMISSION",
        partnerId: attribution.partnerId,
        amountCentavos: 0,
        debitCategory: null,
        creditCategory: null,
      };

      return [
        {
          effectType: "PARTNER_COMMISSION",
          effectKey: commissionEffectKey,
          operationKey: commissionOpKey,
          status: "NOT_APPLICABLE",
          intentVersion: INTENT_VERSION,
          intent: commIntent,
          intentHash: computeSha256Hash(canonicalizeJson(commIntent)),
          partnerId: attribution.partnerId,
        },
        {
          effectType: "PARTNER_LIABILITY_LEDGER",
          effectKey: liabilityEffectKey,
          operationKey: liabilityOpKey,
          status: "NOT_APPLICABLE",
          intentVersion: INTENT_VERSION,
          intent: liabIntent,
          intentHash: computeSha256Hash(canonicalizeJson(liabIntent)),
          partnerId: attribution.partnerId,
        },
      ];
    }

    // 🔒 4. DETERMINISTIC HOLDING TIMESTAMP ARITHMETIC (Integer ms arithmetic)
    const verifiedDate = new Date(verifiedAtIso);
    const verifiedTimestamp = verifiedDate.getTime();
    const holdingDurationMilliseconds = normalizedHoldingPeriodDays * MILLISECONDS_PER_DAY;
    const holdingUntilTimestamp = verifiedTimestamp + holdingDurationMilliseconds;

    if (
      !Number.isFinite(verifiedTimestamp) ||
      !Number.isSafeInteger(holdingDurationMilliseconds) ||
      !Number.isSafeInteger(holdingUntilTimestamp)
    ) {
      throw new InvalidTimestampError("Partner holding-until timestamp is invalid.");
    }

    const holdingUntilDate = new Date(holdingUntilTimestamp);
    if (!Number.isFinite(holdingUntilDate.getTime())) {
      throw new InvalidTimestampError("Partner holding-until timestamp is invalid.");
    }

    const commIntent: PartnerCommissionIntent = {
      effectType: "PARTNER_COMMISSION",
      intentVersion: INTENT_VERSION,
      status: "PENDING",
      partnerId: attribution.partnerId,
      partnerCode: attribution.partnerCode,
      commissionModel: attribution.commissionModel,
      commissionRateBasisPoints: effectiveRateBps,
      calculationBasis,
      baseAmountCentavos,
      commissionAmountCentavos,
      currency: SUPPORTED_CURRENCY,
      campaignSource: effectiveCampaignSource,
      holdingPeriodDays: normalizedHoldingPeriodDays,
      holdingUntil: holdingUntilDate.toISOString(),
    };

    const liabIntent: PartnerLiabilityLedgerIntent = {
      effectType: "PARTNER_LIABILITY_LEDGER",
      intentVersion: INTENT_VERSION,
      status: "PENDING",
      partnerId: attribution.partnerId,
      amountCentavos: commissionAmountCentavos,
      debitCategory: "EXPENSE_PARTNER",
      creditCategory: "LIABILITY_PARTNER_PAYABLE",
    };

    return [
      {
        effectType: "PARTNER_COMMISSION",
        effectKey: commissionEffectKey,
        operationKey: commissionOpKey,
        status: "PENDING",
        intentVersion: INTENT_VERSION,
        intent: commIntent,
        intentHash: computeSha256Hash(canonicalizeJson(commIntent)),
        partnerId: attribution.partnerId,
      },
      {
        effectType: "PARTNER_LIABILITY_LEDGER",
        effectKey: liabilityEffectKey,
        operationKey: liabilityOpKey,
        status: "PENDING",
        intentVersion: INTENT_VERSION,
        intent: liabIntent,
        intentHash: computeSha256Hash(canonicalizeJson(liabIntent)),
        partnerId: attribution.partnerId,
      },
    ];
  }

  /**
   * Plans tax provision effects across all active tax configurations.
   * Operation Keys:
   *   Active tax: pfin:<transactionId>:tax:<taxConfigId>
   *   Zero taxes: pfin:<transactionId>:tax:none
   */
  static async planTaxProvisionEffects(
    transactionId: string,
    customerPaymentCentavos: number,
    authoritativeGrossAmountCentavos: number | undefined,
    verifiedAtDate: Date,
    reader: IFinalizationDataReader
  ): Promise<PlannedEffect[]> {
    const activeTaxes = await reader.findActiveTaxConfigs(verifiedAtDate);

    if (!activeTaxes.length) {
      const effectKey = "tax:none";
      const operationKey = buildPaymentFinalizationOperationKey(transactionId, {
        kind: "TAX_NONE",
      });
      const intent: TaxProvisionIntent = {
        effectType: "TAX_PROVISION",
        intentVersion: INTENT_VERSION,
        status: "NOT_APPLICABLE",
        notApplicableReason: "NO_ACTIVE_TAX_RULES",
        taxConfigId: null,
        taxName: null,
        taxType: null,
        calculationBasis: null,
        taxableAmountCentavos: 0,
        taxRateBasisPoints: null,
        taxAmountCentavos: 0,
        debitCategory: null,
        creditCategory: null,
      };
      const intentHash = computeSha256Hash(canonicalizeJson(intent));
      return [
        {
          effectType: "TAX_PROVISION",
          effectKey,
          operationKey,
          status: "NOT_APPLICABLE",
          intentVersion: INTENT_VERSION,
          intent,
          intentHash,
        },
      ];
    }

    const effects: PlannedEffect[] = [];

    for (const tax of activeTaxes) {
      const taxConfigId = validateIdentifier(tax.id, "taxConfigId");
      if (taxConfigId !== tax.id) {
        throw new PaymentFinalizationPlanningError(
          "tax.id must already be in canonical operation-key form.",
          "PLANNING_ERROR"
        );
      }
      const taxType = validatePaymentFinalizationV1TaxType(tax.taxType);
      const safeRate = validateSafeRate(tax.rate, "tax.rate");
      const fixedAmountCentavos = validateTaxFixedAmountCentavos(
        tax.fixedAmountCentavos
      );
      const calculationBasis = validateTaxCalculationBasis(
        tax.calculationBasis
      );
      validateTaxApplicableTransactionType(tax.applicableTransactionType);

      const effectKey = `tax:${taxConfigId}`;
      const operationKey = buildPaymentFinalizationOperationKey(transactionId, {
        kind: "TAX",
        taxConfigId,
      });

      let taxableAmountCentavos = customerPaymentCentavos;

      if (calculationBasis === "GROSS_SALE") {
        if (
          authoritativeGrossAmountCentavos === undefined ||
          authoritativeGrossAmountCentavos === null
        ) {
          throw new MissingAuthoritativeGrossError(
            `authoritativeGrossAmountCentavos is required for GROSS_SALE tax policy "${tax.name}".`
          );
        }
        taxableAmountCentavos = validateSafeCentavos(
          authoritativeGrossAmountCentavos,
          "authoritativeGrossAmountCentavos",
          false
        );
      }

      let taxAmountCentavos = 0;
      let taxRateBasisPoints: number | null = null;
      const canonicalRateBasisPoints = rateToBasisPoints(safeRate);

      if (canonicalRateBasisPoints > 0) {
        taxRateBasisPoints = canonicalRateBasisPoints;
        const canonicalPercentage = taxRateBasisPoints / 100;
        taxAmountCentavos = Math.round(
          (taxableAmountCentavos * canonicalPercentage) / 100
        );
      } else if (fixedAmountCentavos > 0) {
        taxAmountCentavos = fixedAmountCentavos;
      }

      if (taxAmountCentavos <= 0) {
        const intent: TaxProvisionIntent = {
          effectType: "TAX_PROVISION",
          intentVersion: INTENT_VERSION,
          status: "NOT_APPLICABLE",
          notApplicableReason: "ZERO_TAX_CALCULATED",
          taxConfigId,
          taxName: tax.name,
          taxType,
          calculationBasis,
          taxableAmountCentavos,
          taxRateBasisPoints,
          taxAmountCentavos: 0,
          debitCategory: null,
          creditCategory: null,
        };
        const intentHash = computeSha256Hash(canonicalizeJson(intent));
        effects.push({
          effectType: "TAX_PROVISION",
          effectKey,
          operationKey,
          status: "NOT_APPLICABLE",
          intentVersion: INTENT_VERSION,
          intent,
          intentHash,
          taxConfigId,
        });
      } else {
        const intent: TaxProvisionIntent = {
          effectType: "TAX_PROVISION",
          intentVersion: INTENT_VERSION,
          status: "PENDING",
          taxConfigId,
          taxName: tax.name,
          taxType,
          calculationBasis,
          taxableAmountCentavos,
          taxRateBasisPoints,
          taxAmountCentavos,
          debitCategory: "EXPENSE_TAX",
          creditCategory: "LIABILITY_TAX_PAYABLE",
        };
        const intentHash = computeSha256Hash(canonicalizeJson(intent));
        effects.push({
          effectType: "TAX_PROVISION",
          effectKey,
          operationKey,
          status: "PENDING",
          intentVersion: INTENT_VERSION,
          intent,
          intentHash,
          taxConfigId,
        });
      }
    }

    return effects;
  }

  /**
   * Plans the internal transaction reconciliation effect.
   * Operation Key: pfin:<transactionId>:reconciliation
   */
  static planReconciliationEffect(
    transactionId: string,
    expectedPaymentCentavos: number,
    feeKnowledge: "UNKNOWN" | "KNOWN",
    expectedFeeCentavos: number | null
  ): PlannedEffect {
    const effectKey = "reconciliation";
    const operationKey = buildPaymentFinalizationOperationKey(transactionId, {
      kind: "RECONCILIATION",
    });

    const intent: ReconciliationIntent = {
      effectType: "RECONCILIATION",
      intentVersion: INTENT_VERSION,
      status: "PENDING",
      expectedPaymentCentavos,
      expectedFeeCentavos,
      feeKnowledge,
      sourceType: "INTERNAL_TRANSACTION",
    };

    const intentHash = computeSha256Hash(canonicalizeJson(intent));

    return {
      effectType: "RECONCILIATION",
      effectKey,
      operationKey,
      status: "PENDING",
      intentVersion: INTENT_VERSION,
      intent,
      intentHash,
    };
  }
}
