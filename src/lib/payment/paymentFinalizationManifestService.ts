// Relative Path: src/lib/payment/paymentFinalizationManifestService.ts
/**
 * GovStudyX Durable Payment Finalization Recovery Engine (Phase 1 / Slice 2)
 *
 * Authoritative, deterministic, read-only Payment Finalization Manifest Planner.
 * Generates immutable financial intent manifests and cryptographic SHA-256 hashes.
 *
 * STRICTLY READ-ONLY / DORMANT — ZERO APPLICATION SIDE-EFFECTS OR WRITES.
 */

import { prisma } from "@/lib/prisma";
import {
  MANIFEST_VERSION,
  INTENT_VERSION,
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
  UserRecordForPlanning,
  ReferralAttributionForPlanning,
  PartnerAttributionForPlanning,
  TaxConfigForPlanning,
  MissingAuthoritativeGrossError,
  DuplicateEffectKeyError,
  validatePlanType,
  validateTransactionId,
  validateSafeCentavos,
  validateSafeRate,
  rateToBasisPoints,
  validateIsoUtcTimestamp,
  buildPaymentFinalizationOperationKey,
  canonicalizeJson,
  computeSha256Hash,
} from "./paymentFinalizationContracts";

/**
 * Production read-only data reader backed by Prisma Client queries.
 * Strictly invokes only read-only queries (findUnique, findMany, findFirst).
 * Contains ZERO mutating calls (no create, update, delete, upsert, executeRaw).
 */
export class PrismaFinalizationDataReader implements IFinalizationDataReader {
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

    const settings = await prisma.referralProgramSetting.findMany();
    const settingsMap = new Map<string, string>(settings.map((s) => [s.key, s.value]));

    const programEnabled = settingsMap.has("PROGRAM_ENABLED")
      ? settingsMap.get("PROGRAM_ENABLED") === "true"
      : true;
    const rawRewardType = settingsMap.get("REWARD_TYPE") ?? "PERCENTAGE";
    const rewardType: "PERCENTAGE" | "FIXED" =
      rawRewardType === "FIXED" ? "FIXED" : "PERCENTAGE";

    const rewardPercentage = settingsMap.has("REWARD_PERCENTAGE")
      ? Number(settingsMap.get("REWARD_PERCENTAGE")) || 20.0
      : 20.0;
    const fixedRewardAmountCentavos = settingsMap.has("FIXED_REWARD_AMOUNT_CENTAVOS")
      ? Number(settingsMap.get("FIXED_REWARD_AMOUNT_CENTAVOS")) || 5000
      : 5000;
    const holdingPeriodDays = settingsMap.has("HOLDING_PERIOD_DAYS")
      ? Number(settingsMap.get("HOLDING_PERIOD_DAYS")) || 7
      : 7;

    return {
      referralId: referral.id,
      inviterId: referral.inviterId,
      alreadyRewarded: referral.reward !== null,
      programEnabled,
      rewardType,
      rewardPercentage,
      fixedRewardAmountCentavos,
      holdingPeriodDays,
    };
  }

  async findPartnerAttribution(
    userId: string,
    partnerCode?: string | null
  ): Promise<PartnerAttributionForPlanning | null> {
    const attribution = await prisma.partnerAttribution.findUnique({
      where: { referredUserId: userId },
      include: { partner: true },
    });

    if (!attribution && partnerCode) {
      const trimmed = partnerCode.trim();
      const partner = await prisma.partner.findFirst({
        where: {
          OR: [
            { code: { equals: trimmed, mode: "insensitive" } },
            { slug: { equals: trimmed, mode: "insensitive" } },
          ],
        },
      });
      if (partner) {
        return {
          partnerId: partner.id,
          partnerCode: partner.code,
          status: partner.status,
          commissionModel: partner.commissionModel,
          commissionRate: partner.commissionRate,
          fixedCommissionCentavos: partner.fixedCommissionCentavos ?? 0,
          holdingPeriodDays: partner.holdingPeriodDays ?? 7,
          defaultCampaignSource: null,
          alreadyCommissioned: false,
        };
      }
    }

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
      alreadyCommissioned: false,
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
      fixedAmountCentavos: c.fixedAmountCentavos ?? 0,
      calculationBasis: c.calculationBasis === "GROSS_SALE" ? "GROSS_SALE" : "CUSTOMER_PAYMENT",
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
    const validatedPlan = validatePlanType(input.planType);

    // Validate external input timestamps before hashing material is assembled
    validateIsoUtcTimestamp(input.providerPaidAt, "providerPaidAt", true);

    const customerPaymentCentavos = validateSafeCentavos(
      input.purchaseAmountCentavos,
      "purchaseAmountCentavos",
      false
    );

    const paymentLedgerEffect = this.planPaymentLedgerEffect(input);
    const providerFeeLedgerEffect = this.planProviderFeeLedgerEffect(input);
    const referralRewardEffect = await this.planReferralRewardEffect(input, reader);
    const partnerEffects = await this.planPartnerCommissionEffects(input, reader);
    const taxEffects = await this.planTaxProvisionEffects(input, reader);
    const reconciliationEffect = this.planReconciliationEffect(input);

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

    const feeAmountCentavos =
      input.feeKnowledge === "KNOWN"
        ? validateSafeCentavos(input.feeAmountCentavos ?? 0, "feeAmountCentavos", true)
        : null;

    const manifestSummary = {
      manifestVersion: MANIFEST_VERSION,
      manifestRevision: 1,
      transactionId: validatedTxId,
      checkoutSessionId: input.checkoutSessionId.trim(),
      userId: input.userId.trim(),
      planType: validatedPlan,
      purchaseAmountCentavos: customerPaymentCentavos,
      feeKnowledge: input.feeKnowledge,
      feeAmountCentavos,
      source: input.source,
      origin: input.origin ?? "NEW_PAYMENT",
      currency: input.currency ?? "PHP",
      effects: allEffects.map((e) => ({
        effectType: e.effectType,
        effectKey: e.effectKey,
        operationKey: e.operationKey,
        status: e.status,
        intentHash: e.intentHash,
      })),
    };

    const manifestHash = computeSha256Hash(canonicalizeJson(manifestSummary));

    return {
      manifestVersion: MANIFEST_VERSION,
      manifestRevision: 1,
      transactionId: validatedTxId,
      checkoutSessionId: input.checkoutSessionId.trim(),
      userId: input.userId.trim(),
      planType: validatedPlan,
      purchaseAmountCentavos: customerPaymentCentavos,
      feeKnowledge: input.feeKnowledge,
      feeAmountCentavos,
      source: input.source,
      origin: input.origin ?? "NEW_PAYMENT",
      currency: input.currency ?? "PHP",
      manifestHash,
      effects: allEffects,
    };
  }

  /**
   * Plans the primary double-entry payment ledger entry (Debit CASH_PAYMONGO, Credit SUBSCRIPTION_REVENUE).
   * Operation Key: pfin:<transactionId>:payment
   */
  static planPaymentLedgerEffect(input: FinalizationPlanningInput): PlannedEffect {
    const validatedTxId = validateTransactionId(input.transactionId);
    const validatedPlan = validatePlanType(input.planType);
    const amountCentavos = validateSafeCentavos(
      input.purchaseAmountCentavos,
      "purchaseAmountCentavos",
      false
    );

    const effectKey = "payment";
    const operationKey = buildPaymentFinalizationOperationKey(validatedTxId, { kind: "PAYMENT" });

    const intent: PaymentLedgerIntent = {
      effectType: "PAYMENT_LEDGER",
      intentVersion: INTENT_VERSION,
      status: "PENDING",
      amountCentavos,
      userId: input.userId.trim(),
      planType: validatedPlan,
      debitCategory: "CASH_PAYMONGO",
      creditCategory: "SUBSCRIPTION_REVENUE",
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
   * Plans provider gateway fee entry (Debit EXPENSE_PAYMENT_GATEWAY, Credit CASH_PAYMONGO).
   * Operation Key: pfin:<transactionId>:fee
   */
  static planProviderFeeLedgerEffect(input: FinalizationPlanningInput): PlannedEffect {
    const validatedTxId = validateTransactionId(input.transactionId);
    const effectKey = "fee";
    const operationKey = buildPaymentFinalizationOperationKey(validatedTxId, { kind: "FEE" });

    if (input.feeKnowledge === "UNKNOWN") {
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

    const feeCentavos = validateSafeCentavos(
      input.feeAmountCentavos ?? 0,
      "feeAmountCentavos",
      true
    );

    if (feeCentavos === 0) {
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
      feeAmountCentavos: feeCentavos,
      status: "PENDING",
      debitCategory: "EXPENSE_PAYMENT_GATEWAY",
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
   * Preserves exact millisecond-based holding calculation semantics.
   */
  static async planReferralRewardEffect(
    input: FinalizationPlanningInput,
    reader: IFinalizationDataReader
  ): Promise<PlannedEffect> {
    const validatedTxId = validateTransactionId(input.transactionId);
    const effectKey = "referral";
    const operationKey = buildPaymentFinalizationOperationKey(validatedTxId, { kind: "REFERRAL" });
    const customerPaymentCentavos = validateSafeCentavos(
      input.purchaseAmountCentavos,
      "purchaseAmountCentavos",
      false
    );

    const attribution = await reader.findReferralAttribution(input.userId);

    if (!attribution) {
      const intent: ReferralRewardIntent = {
        effectType: "REFERRAL_REWARD",
        intentVersion: INTENT_VERSION,
        status: "NOT_APPLICABLE",
        notApplicableReason: "NO_REFERRAL_ATTRIBUTION",
        referralId: null,
        inviterId: null,
        referredUserId: input.userId.trim(),
        purchaseAmountCentavos: customerPaymentCentavos,
        rewardType: null,
        rewardRateBasisPoints: null,
        rewardAmountCentavos: 0,
        currency: input.currency ?? "PHP",
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

    if (!attribution.programEnabled) {
      const intent: ReferralRewardIntent = {
        effectType: "REFERRAL_REWARD",
        intentVersion: INTENT_VERSION,
        status: "NOT_APPLICABLE",
        notApplicableReason: "PROGRAM_DISABLED",
        referralId: attribution.referralId,
        inviterId: attribution.inviterId,
        referredUserId: input.userId.trim(),
        purchaseAmountCentavos: customerPaymentCentavos,
        rewardType: attribution.rewardType,
        rewardRateBasisPoints: rateToBasisPoints(attribution.rewardPercentage),
        rewardAmountCentavos: 0,
        currency: input.currency ?? "PHP",
        holdingPeriodDays: attribution.holdingPeriodDays,
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
    let rewardRateBasisPoints: number | null = null;

    if (attribution.rewardType === "FIXED") {
      calculatedRewardCentavos = validateSafeCentavos(
        attribution.fixedRewardAmountCentavos,
        "fixedRewardAmountCentavos",
        true
      );
      rewardRateBasisPoints = 0;
    } else {
      const safeRate = validateSafeRate(attribution.rewardPercentage, "rewardPercentage");
      rewardRateBasisPoints = rateToBasisPoints(safeRate);
      calculatedRewardCentavos = Math.round((customerPaymentCentavos * safeRate) / 100);
    }

    if (calculatedRewardCentavos <= 0) {
      const intent: ReferralRewardIntent = {
        effectType: "REFERRAL_REWARD",
        intentVersion: INTENT_VERSION,
        status: "NOT_APPLICABLE",
        notApplicableReason: "ZERO_REWARD_CALCULATED",
        referralId: attribution.referralId,
        inviterId: attribution.inviterId,
        referredUserId: input.userId.trim(),
        purchaseAmountCentavos: customerPaymentCentavos,
        rewardType: attribution.rewardType,
        rewardRateBasisPoints,
        rewardAmountCentavos: 0,
        currency: input.currency ?? "PHP",
        holdingPeriodDays: attribution.holdingPeriodDays,
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

    // Preserve exact millisecond-based holding calculation semantics from ReferralService
    const validatedRefIso =
      typeof input.referenceDate === "string"
        ? validateIsoUtcTimestamp(input.referenceDate, "referenceDate", false)!
        : input.referenceDate instanceof Date
        ? input.referenceDate.toISOString()
        : new Date().toISOString();

    const refDate = new Date(validatedRefIso);

    const holdingUntilDate = new Date(
      refDate.getTime() + attribution.holdingPeriodDays * 24 * 60 * 60 * 1000
    );

    const intent: ReferralRewardIntent = {
      effectType: "REFERRAL_REWARD",
      intentVersion: INTENT_VERSION,
      status: "PENDING",
      referralId: attribution.referralId,
      inviterId: attribution.inviterId,
      referredUserId: input.userId.trim(),
      purchaseAmountCentavos: customerPaymentCentavos,
      rewardType: attribution.rewardType,
      rewardRateBasisPoints,
      rewardAmountCentavos: calculatedRewardCentavos,
      currency: input.currency ?? "PHP",
      holdingPeriodDays: attribution.holdingPeriodDays,
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
    input: FinalizationPlanningInput,
    reader: IFinalizationDataReader
  ): Promise<PlannedEffect[]> {
    const validatedTxId = validateTransactionId(input.transactionId);
    const commissionEffectKey = "partner-commission";
    const liabilityEffectKey = "partner-liability";
    const commissionOpKey = buildPaymentFinalizationOperationKey(validatedTxId, {
      kind: "PARTNER_COMMISSION",
    });
    const liabilityOpKey = buildPaymentFinalizationOperationKey(validatedTxId, {
      kind: "PARTNER_LIABILITY",
    });

    const customerPaymentCentavos = validateSafeCentavos(
      input.purchaseAmountCentavos,
      "purchaseAmountCentavos",
      false
    );

    const attribution = await reader.findPartnerAttribution(input.userId, input.partnerCode);

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
        commissionRateBasisPoints: attribution ? rateToBasisPoints(attribution.commissionRate) : null,
        calculationBasis: null,
        baseAmountCentavos: null,
        commissionAmountCentavos: 0,
        currency: input.currency ?? "PHP",
        campaignSource: input.campaignSource ?? attribution?.defaultCampaignSource ?? null,
        holdingPeriodDays: attribution?.holdingPeriodDays ?? null,
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

    let calculationBasis: "CUSTOMER_PAYMENT" | "GROSS_PRICE" | "FIXED_AMOUNT" = "CUSTOMER_PAYMENT";
    let baseAmountCentavos: number | null = customerPaymentCentavos;
    let commissionAmountCentavos = 0;
    const safeRate = validateSafeRate(attribution.commissionRate, "commissionRate");
    const rateBps = rateToBasisPoints(safeRate);

    if (attribution.commissionModel === "PERCENTAGE_OF_GROSS") {
      if (
        input.authoritativeGrossAmountCentavos === undefined ||
        input.authoritativeGrossAmountCentavos === null
      ) {
        throw new MissingAuthoritativeGrossError(
          "authoritativeGrossAmountCentavos is required for PERCENTAGE_OF_GROSS partner commission model."
        );
      }
      const grossCentavos = validateSafeCentavos(
        input.authoritativeGrossAmountCentavos,
        "authoritativeGrossAmountCentavos",
        false
      );
      calculationBasis = "GROSS_PRICE";
      baseAmountCentavos = grossCentavos;
      commissionAmountCentavos = Math.round((grossCentavos * safeRate) / 100);
    } else if (
      attribution.commissionModel === "FIXED_PER_PURCHASE" ||
      attribution.commissionModel === "FIXED_PER_REFERRAL"
    ) {
      calculationBasis = "FIXED_AMOUNT";
      baseAmountCentavos = null;
      commissionAmountCentavos = validateSafeCentavos(
        attribution.fixedCommissionCentavos,
        "fixedCommissionCentavos",
        true
      );
    } else {
      // Default / PERCENTAGE_OF_CUSTOMER_PAYMENT / PERCENTAGE_OF_NET_AFTER_CONFIGURED_DEDUCTIONS
      calculationBasis = "CUSTOMER_PAYMENT";
      baseAmountCentavos = customerPaymentCentavos;
      commissionAmountCentavos = Math.round((customerPaymentCentavos * safeRate) / 100);
    }

    const effectiveCampaignSource =
      input.campaignSource ?? attribution.defaultCampaignSource ?? "direct";

    if (commissionAmountCentavos <= 0) {
      const commIntent: PartnerCommissionIntent = {
        effectType: "PARTNER_COMMISSION",
        intentVersion: INTENT_VERSION,
        status: "NOT_APPLICABLE",
        notApplicableReason: "ZERO_COMMISSION_CALCULATED",
        partnerId: attribution.partnerId,
        partnerCode: attribution.partnerCode,
        commissionModel: attribution.commissionModel,
        commissionRateBasisPoints: rateBps,
        calculationBasis,
        baseAmountCentavos,
        commissionAmountCentavos: 0,
        currency: input.currency ?? "PHP",
        campaignSource: effectiveCampaignSource,
        holdingPeriodDays: attribution.holdingPeriodDays,
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

    // Preserve exact calendar-day holding date semantics from PartnerService
    const validatedRefIso =
      typeof input.referenceDate === "string"
        ? validateIsoUtcTimestamp(input.referenceDate, "referenceDate", false)!
        : input.referenceDate instanceof Date
        ? input.referenceDate.toISOString()
        : new Date().toISOString();

    const refDate = new Date(validatedRefIso);
    const partnerHoldingDate = new Date(refDate);
    partnerHoldingDate.setDate(partnerHoldingDate.getDate() + (attribution.holdingPeriodDays || 7));

    const commIntent: PartnerCommissionIntent = {
      effectType: "PARTNER_COMMISSION",
      intentVersion: INTENT_VERSION,
      status: "PENDING",
      partnerId: attribution.partnerId,
      partnerCode: attribution.partnerCode,
      commissionModel: attribution.commissionModel,
      commissionRateBasisPoints: rateBps,
      calculationBasis,
      baseAmountCentavos,
      commissionAmountCentavos,
      currency: input.currency ?? "PHP",
      campaignSource: effectiveCampaignSource,
      holdingPeriodDays: attribution.holdingPeriodDays,
      holdingUntil: partnerHoldingDate.toISOString(),
    };

    const liabIntent: PartnerLiabilityLedgerIntent = {
      effectType: "PARTNER_LIABILITY_LEDGER",
      intentVersion: INTENT_VERSION,
      status: "PENDING",
      partnerId: attribution.partnerId,
      amountCentavos: commissionAmountCentavos,
      debitCategory: "EXPENSE_PARTNER_COMMISSION",
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
    input: FinalizationPlanningInput,
    reader: IFinalizationDataReader
  ): Promise<PlannedEffect[]> {
    const validatedTxId = validateTransactionId(input.transactionId);
    const customerPaymentCentavos = validateSafeCentavos(
      input.purchaseAmountCentavos,
      "purchaseAmountCentavos",
      false
    );

    const validatedRefIso =
      typeof input.referenceDate === "string"
        ? validateIsoUtcTimestamp(input.referenceDate, "referenceDate", false)!
        : input.referenceDate instanceof Date
        ? input.referenceDate.toISOString()
        : new Date().toISOString();

    const refDate = new Date(validatedRefIso);
    const activeTaxes = await reader.findActiveTaxConfigs(refDate);

    if (!activeTaxes.length) {
      const effectKey = "tax:none";
      const operationKey = buildPaymentFinalizationOperationKey(validatedTxId, {
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
      const effectKey = `tax:${tax.id}`;
      const operationKey = buildPaymentFinalizationOperationKey(validatedTxId, {
        kind: "TAX",
        taxConfigId: tax.id,
      });

      let taxableAmountCentavos = customerPaymentCentavos;
      let calculationBasis: "CUSTOMER_PAYMENT" | "GROSS_SALE" = "CUSTOMER_PAYMENT";

      if (tax.calculationBasis === "GROSS_SALE") {
        calculationBasis = "GROSS_SALE";
        if (
          input.authoritativeGrossAmountCentavos === undefined ||
          input.authoritativeGrossAmountCentavos === null
        ) {
          throw new MissingAuthoritativeGrossError(
            `authoritativeGrossAmountCentavos is required for GROSS_SALE tax policy "${tax.name}".`
          );
        }
        taxableAmountCentavos = validateSafeCentavos(
          input.authoritativeGrossAmountCentavos,
          "authoritativeGrossAmountCentavos",
          false
        );
      }

      let taxAmountCentavos = 0;
      let taxRateBasisPoints: number | null = null;

      if (tax.rate > 0) {
        const safeRate = validateSafeRate(tax.rate, "tax.rate");
        taxRateBasisPoints = rateToBasisPoints(safeRate);
        taxAmountCentavos = Math.round((taxableAmountCentavos * safeRate) / 100);
      } else if (tax.fixedAmountCentavos > 0) {
        taxAmountCentavos = validateSafeCentavos(
          tax.fixedAmountCentavos,
          "tax.fixedAmountCentavos",
          true
        );
      }

      if (taxAmountCentavos <= 0) {
        const intent: TaxProvisionIntent = {
          effectType: "TAX_PROVISION",
          intentVersion: INTENT_VERSION,
          status: "NOT_APPLICABLE",
          notApplicableReason: "ZERO_TAX_CALCULATED",
          taxConfigId: tax.id,
          taxName: tax.name,
          taxType: tax.taxType,
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
          taxConfigId: tax.id,
        });
      } else {
        const intent: TaxProvisionIntent = {
          effectType: "TAX_PROVISION",
          intentVersion: INTENT_VERSION,
          status: "PENDING",
          taxConfigId: tax.id,
          taxName: tax.name,
          taxType: tax.taxType,
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
          taxConfigId: tax.id,
        });
      }
    }

    return effects;
  }

  /**
   * Plans the internal transaction reconciliation effect.
   * Operation Key: pfin:<transactionId>:reconciliation
   */
  static planReconciliationEffect(input: FinalizationPlanningInput): PlannedEffect {
    const validatedTxId = validateTransactionId(input.transactionId);
    const effectKey = "reconciliation";
    const operationKey = buildPaymentFinalizationOperationKey(validatedTxId, {
      kind: "RECONCILIATION",
    });
    const expectedPaymentCentavos = validateSafeCentavos(
      input.purchaseAmountCentavos,
      "purchaseAmountCentavos",
      false
    );

    const expectedFeeCentavos =
      input.feeKnowledge === "KNOWN"
        ? validateSafeCentavos(input.feeAmountCentavos ?? 0, "feeAmountCentavos", true)
        : null;

    const intent: ReconciliationIntent = {
      effectType: "RECONCILIATION",
      intentVersion: INTENT_VERSION,
      status: "PENDING",
      expectedPaymentCentavos,
      expectedFeeCentavos,
      feeKnowledge: input.feeKnowledge,
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
