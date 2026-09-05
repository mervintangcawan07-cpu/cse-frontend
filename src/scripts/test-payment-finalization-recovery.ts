// Relative Path: src/scripts/test-payment-finalization-recovery.ts
/**
 * Synthetic Test Suite: GovStudyX Durable Payment Finalization Recovery Engine (Phase 1 / Slice 2.2)
 *
 * STRICTLY STATIC / IN-MEMORY SYNTHETIC TESTS — ZERO LIVE DATABASE MUTATIONS OR PROVIDER CALLS.
 */

import fs from "fs";
import path from "path";
import { REFERRAL_SETTING_KEYS } from "../lib/referral/config";
import {
  MANIFEST_VERSION,
  INTENT_VERSION,
  SUPPORTED_CURRENCY,
  SUPPORTED_PLAN_TYPES,
  FinalizationPlanningInput,
  PlannedManifest,
  PaymentLedgerIntent,
  ProviderFeeLedgerIntent,
  ReferralRewardIntent,
  PartnerCommissionIntent,
  PartnerLiabilityLedgerIntent,
  TaxProvisionIntent,
  ReconciliationIntent,
  IFinalizationDataReader,
  TransactionIdentityForPlanning,
  UserRecordForPlanning,
  ReferralAttributionForPlanning,
  PartnerAttributionForPlanning,
  PartnerCommissionRecordForPlanning,
  TaxConfigForPlanning,
  PaymentFinalizationPlanningError,
  UnsupportedPlanTypeError,
  InvalidMonetaryAmountError,
  MissingAuthoritativeGrossError,
  InvalidOperationKeyError,
  DuplicateEffectKeyError,
  InvalidTimestampError,
  InvalidCurrencyError,
  InvalidFeeStateError,
  UserNotFoundError,
  TransactionNotFoundError,
  TransactionIdentityMismatchError,
  ExistingReferralRewardConflictError,
  ExistingPartnerCommissionConflictError,
  buildPaymentFinalizationOperationKey,
  validatePlanType,
  validateCurrency,
  validateTransactionId,
  validateContextIdentifier,
  validateIsoUtcTimestamp,
  canonicalizeJson,
  computeSha256Hash,
  validateSafeCentavos,
  validateSafeRate,
  rateToBasisPoints,
} from "../lib/payment/paymentFinalizationContracts";
import {
  PaymentFinalizationManifestService,
  parseReferralPlanningConfig,
} from "../lib/payment/paymentFinalizationManifestService";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
  }
}

// In-Memory Simulated Reader for Pure Synthetic Testing
class MockFinalizationDataReader implements IFinalizationDataReader {
  public transactions: Map<string, TransactionIdentityForPlanning> = new Map();
  public users: Map<string, UserRecordForPlanning> = new Map();
  public referrals: Map<string, ReferralAttributionForPlanning> = new Map();
  public partnerCommissions: Map<string, PartnerCommissionRecordForPlanning> = new Map();
  public partners: Map<string, PartnerAttributionForPlanning> = new Map();
  public taxConfigs: TaxConfigForPlanning[] = [];

  public reset(): void {
    this.transactions.clear();
    this.users.clear();
    this.referrals.clear();
    this.partnerCommissions.clear();
    this.partners.clear();
    this.taxConfigs = [];
  }

  public setupStandardContext(
    txId: string = "txn_test_789",
    userId: string = "user_1",
    checkoutSessionId: string = "cs_test_123"
  ): void {
    this.transactions.set(txId, { id: txId, userId, checkoutSessionId });
    this.users.set(userId, { id: userId, isPaid: false, paidUntil: null });
  }

  async findTransactionIdentity(transactionId: string): Promise<TransactionIdentityForPlanning | null> {
    return this.transactions.get(transactionId) ?? null;
  }

  async findUser(userId: string): Promise<UserRecordForPlanning | null> {
    return this.users.get(userId) ?? null;
  }

  async findReferralAttribution(userId: string): Promise<ReferralAttributionForPlanning | null> {
    return this.referrals.get(userId) ?? null;
  }

  async findExistingPartnerCommission(transactionId: string): Promise<PartnerCommissionRecordForPlanning | null> {
    return this.partnerCommissions.get(transactionId) ?? null;
  }

  async findPartnerAttribution(userId: string): Promise<PartnerAttributionForPlanning | null> {
    return this.partners.get(userId) ?? null;
  }

  async findActiveTaxConfigs(_referenceDate: Date): Promise<TaxConfigForPlanning[]> {
    return [...this.taxConfigs];
  }
}

function makeTaxConfig(
  overrides: Partial<TaxConfigForPlanning> = {}
): TaxConfigForPlanning {
  return {
    id: "tax_v1",
    name: "Payment Finalization Tax",
    taxType: "VAT",
    rate: 12,
    fixedAmountCentavos: 0,
    calculationBasis: "CUSTOMER_PAYMENT",
    applicableTransactionType: "ALL",
    ...overrides,
  };
}

function makeRuntimeTaxConfig(
  overrides: Readonly<Record<string, unknown>>
): TaxConfigForPlanning {
  return {
    ...makeTaxConfig(),
    ...overrides,
  } as unknown as TaxConfigForPlanning;
}

async function taxPlanningFailsClosed(
  reader: MockFinalizationDataReader,
  config: TaxConfigForPlanning,
  expectedCode?: "PLANNING_ERROR" | "INVALID_RATE" | "INVALID_MONETARY_AMOUNT"
): Promise<boolean> {
  reader.taxConfigs = [config];
  try {
    await PaymentFinalizationManifestService.planTaxProvisionEffects(
      "txn_tax_validation",
      210,
      300,
      new Date("2026-08-31T10:00:00.000Z"),
      reader
    );
    return false;
  } catch (error) {
    return (
      error instanceof PaymentFinalizationPlanningError &&
      (expectedCode === undefined || error.code === expectedCode)
    );
  }
}

async function runPaymentFinalizationRecoveryTests(): Promise<void> {
  console.log("================================================================================");
  console.log("🧪 RUNNING SYNTHETIC SUITE: PAYMENT FINALIZATION RECOVERY (SLICE 2.2)");
  console.log("================================================================================\n");

  const mockReader = new MockFinalizationDataReader();
  const testVerifiedAtStr = "2026-08-31T10:00:00.000Z";
  const sampleTxId = "txn_test_789";

  // Test 1: Exact 8 Closed Operation Key Forms (Character-for-character verification)
  {
    const keyPayment = buildPaymentFinalizationOperationKey(sampleTxId, { kind: "PAYMENT" });
    const keyFee = buildPaymentFinalizationOperationKey(sampleTxId, { kind: "FEE" });
    const keyReferral = buildPaymentFinalizationOperationKey(sampleTxId, { kind: "REFERRAL" });
    const keyPartnerComm = buildPaymentFinalizationOperationKey(sampleTxId, { kind: "PARTNER_COMMISSION" });
    const keyPartnerLiab = buildPaymentFinalizationOperationKey(sampleTxId, { kind: "PARTNER_LIABILITY" });
    const keyTaxConfig = buildPaymentFinalizationOperationKey(sampleTxId, { kind: "TAX", taxConfigId: "vat_12" });
    const keyTaxNone = buildPaymentFinalizationOperationKey(sampleTxId, { kind: "TAX_NONE" });
    const keyReconciliation = buildPaymentFinalizationOperationKey(sampleTxId, { kind: "RECONCILIATION" });

    assert(
      keyPayment === "pfin:txn_test_789:payment" &&
        keyFee === "pfin:txn_test_789:fee" &&
        keyReferral === "pfin:txn_test_789:referral" &&
        keyPartnerComm === "pfin:txn_test_789:partner-commission" &&
        keyPartnerLiab === "pfin:txn_test_789:partner-liability" &&
        keyTaxConfig === "pfin:txn_test_789:tax:vat_12" &&
        keyTaxNone === "pfin:txn_test_789:tax:none" &&
        keyReconciliation === "pfin:txn_test_789:reconciliation",
      "Test 1: All eight exact pfin operation key forms match character-for-character from closed builder"
    );
  }

  // Test 2: Colon Prohibition & Collision Prevention Test
  {
    let colonTxCaught = false;
    try {
      buildPaymentFinalizationOperationKey("acct:tax", { kind: "TAX", taxConfigId: "vat" });
    } catch (err) {
      if (err instanceof InvalidOperationKeyError && err.message.includes("colon delimiter forbidden")) {
        colonTxCaught = true;
      }
    }

    let colonTaxIdCaught = false;
    try {
      buildPaymentFinalizationOperationKey("acct", { kind: "TAX", taxConfigId: "tax:vat" });
    } catch (err) {
      if (err instanceof InvalidOperationKeyError && err.message.includes("colon delimiter forbidden")) {
        colonTaxIdCaught = true;
      }
    }

    const validKeyA = buildPaymentFinalizationOperationKey("acct_tax", { kind: "TAX", taxConfigId: "vat" });
    const validKeyB = buildPaymentFinalizationOperationKey("acct", { kind: "TAX", taxConfigId: "tax_vat" });

    assert(
      colonTxCaught && colonTaxIdCaught && validKeyA !== validKeyB,
      "Test 2: Colons inside transactionId and taxConfigId are strictly rejected, preventing segment boundary collisions"
    );
  }

  // Test 3: Plan type validation
  {
    for (const plan of SUPPORTED_PLAN_TYPES) {
      const validated = validatePlanType(plan);
      assert(validated === plan, `Test 3A: Supported plan "${plan}" passes validation`);
    }

    let unsupportedPlanCaught = false;
    try {
      mockReader.reset();
      mockReader.setupStandardContext("txn_unsupported", "user_1", "cs_unsupported");
      const inputUnsupported: FinalizationPlanningInput = {
        transactionId: "txn_unsupported",
        checkoutSessionId: "cs_unsupported",
        userId: "user_1",
        planType: "LIFETIME_ACCESS", // Unsupported
        purchaseAmountCentavos: 29900,
        feeKnowledge: "UNKNOWN",
        source: "WEBHOOK",
        verifiedAtIso: testVerifiedAtStr,
      };
      await PaymentFinalizationManifestService.planFinalization(inputUnsupported, mockReader);
    } catch (err) {
      if (
        err instanceof UnsupportedPlanTypeError &&
        err.code === "UNSUPPORTED_PLAN_TYPE"
      ) {
        unsupportedPlanCaught = true;
      }
    }

    assert(
      unsupportedPlanCaught,
      "Test 3B: Unsupported planType fails closed with UnsupportedPlanTypeError and code UNSUPPORTED_PLAN_TYPE"
    );
  }

  // Test 4: Reconciled Account Categories Compile & Runtime Verification
  {
    mockReader.reset();
    mockReader.setupStandardContext("txn_cat_test", "user_1", "cs_cat_test");
    mockReader.partners.set("user_1", {
      partnerId: "part_cat",
      partnerCode: "PARTCAT",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRate: 10.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
    });

    const inputCat: FinalizationPlanningInput = {
      transactionId: "txn_cat_test",
      checkoutSessionId: "cs_cat_test",
      userId: "user_1",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900,
      feeKnowledge: "KNOWN",
      feeAmountCentavos: 1500,
      source: "WEBHOOK",
      verifiedAtIso: testVerifiedAtStr,
    };

    const manifestCat = await PaymentFinalizationManifestService.planFinalization(inputCat, mockReader);
    const pmtEffect = manifestCat.effects.find((e) => e.effectType === "PAYMENT_LEDGER")!;
    const feeEffect = manifestCat.effects.find((e) => e.effectType === "PROVIDER_FEE_LEDGER")!;
    const ptrLiabEffect = manifestCat.effects.find((e) => e.effectType === "PARTNER_LIABILITY_LEDGER")!;

    const pmtIntent = pmtEffect.intent as PaymentLedgerIntent;
    const feeIntent = feeEffect.intent as ProviderFeeLedgerIntent;
    const ptrLiabIntent = ptrLiabEffect.intent as PartnerLiabilityLedgerIntent;

    assert(
      pmtIntent.debitCategory === "CASH_PAYMONGO" &&
        pmtIntent.creditCategory === "REVENUE_PREMIUM" &&
        feeIntent.debitCategory === "EXPENSE_PAYMENT_FEE" &&
        feeIntent.creditCategory === "CASH_PAYMONGO" &&
        ptrLiabIntent.debitCategory === "EXPENSE_PARTNER" &&
        ptrLiabIntent.creditCategory === "LIABILITY_PARTNER_PAYABLE",
      "Test 4: Canonical AccountCategory values (REVENUE_PREMIUM, EXPENSE_PAYMENT_FEE, EXPENSE_PARTNER) strictly verified"
    );
  }

  // Test 5: Authoritative Timestamp Invariance Across Wall-Clock Execution Time
  {
    mockReader.reset();
    mockReader.setupStandardContext("txn_time_test", "user_1", "cs_time_test");

    const inputA: FinalizationPlanningInput = {
      transactionId: "txn_time_test",
      checkoutSessionId: "cs_time_test",
      userId: "user_1",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900,
      feeKnowledge: "UNKNOWN",
      source: "WEBHOOK",
      verifiedAtIso: "2026-08-31T10:00:00.000Z", // Explicit timestamp
    };

    const manifestA1 = await PaymentFinalizationManifestService.planFinalization(inputA, mockReader);
    // Simulate re-planning later in wall-clock time with identical verifiedAtIso
    const manifestA2 = await PaymentFinalizationManifestService.planFinalization(inputA, mockReader);

    assert(
      manifestA1.manifestHash === manifestA2.manifestHash &&
        manifestA1.verifiedAt === "2026-08-31T10:00:00.000Z" &&
        manifestA1.entitlementAfter === manifestA2.entitlementAfter,
      "Test 5: Explicit verifiedAtIso produces 100% deterministic manifestHash invariant across execution time"
    );
  }

  // Test 6: Strict ISO-8601 UTC timestamp validation & rollover protection
  {
    const validIso1 = validateIsoUtcTimestamp("2026-08-31T10:00:00.000Z", "testDate");
    const validIso2 = validateIsoUtcTimestamp("2026-08-31T10:00:00Z", "testDate");

    let malformedCaught = false;
    try {
      validateIsoUtcTimestamp("2026-08-31 10:00:00", "testDate");
    } catch (err) {
      if (err instanceof InvalidTimestampError) malformedCaught = true;
    }

    let rolloverCaught = false;
    try {
      validateIsoUtcTimestamp("2026-02-30T10:00:00.000Z", "testDate");
    } catch (err) {
      if (err instanceof InvalidTimestampError) rolloverCaught = true;
    }

    assert(
      validIso1 === "2026-08-31T10:00:00.000Z" &&
        validIso2 === "2026-08-31T10:00:00.000Z" &&
        malformedCaught &&
        rolloverCaught,
      "Test 6: Strict ISO-8601 UTC timestamp validation accepts valid UTC strings and rejects malformed/rolled dates"
    );
  }

  // Test 7: Strict Fee Knowledge Contract (UNKNOWN & KNOWN states)
  {
    mockReader.reset();
    mockReader.setupStandardContext("txn_fee_test", "user_1", "cs_fee_test");

    // A. UNKNOWN + null state => Valid AWAITING_DATA
    const inputUnknownValid: FinalizationPlanningInput = {
      transactionId: "txn_fee_test",
      checkoutSessionId: "cs_fee_test",
      userId: "user_1",
      planType: "1_MONTH",
      purchaseAmountCentavos: 9900,
      feeKnowledge: "UNKNOWN",
      source: "WEBHOOK",
      verifiedAtIso: testVerifiedAtStr,
    };
    const manifestUnknown = await PaymentFinalizationManifestService.planFinalization(inputUnknownValid, mockReader);
    const feeEffectUnknown = manifestUnknown.effects.find((e) => e.effectType === "PROVIDER_FEE_LEDGER")!;

    // B. UNKNOWN + supplied feeAmountCentavos => Error
    let unknownAmountError = false;
    try {
      await PaymentFinalizationManifestService.planFinalization(
        { ...inputUnknownValid, feeAmountCentavos: 500 },
        mockReader
      );
    } catch (err) {
      if (err instanceof InvalidFeeStateError && err.code === "INVALID_FEE_STATE") unknownAmountError = true;
    }

    // C. UNKNOWN + supplied feeObservedAtIso => Error
    let unknownObservedError = false;
    try {
      await PaymentFinalizationManifestService.planFinalization(
        { ...inputUnknownValid, feeObservedAtIso: "2026-08-31T10:05:00.000Z" },
        mockReader
      );
    } catch (err) {
      if (err instanceof InvalidFeeStateError && err.code === "INVALID_FEE_STATE") unknownObservedError = true;
    }

    // D. KNOWN + omitted feeAmountCentavos => Error
    let knownOmittedError = false;
    try {
      await PaymentFinalizationManifestService.planFinalization(
        { ...inputUnknownValid, feeKnowledge: "KNOWN", feeAmountCentavos: undefined },
        mockReader
      );
    } catch (err) {
      if (err instanceof InvalidFeeStateError && err.code === "INVALID_FEE_STATE") knownOmittedError = true;
    }

    // E. KNOWN + zero fee => NOT_APPLICABLE (ZERO_PROVIDER_FEE)
    const manifestKnownZero = await PaymentFinalizationManifestService.planFinalization(
      { ...inputUnknownValid, feeKnowledge: "KNOWN", feeAmountCentavos: 0 },
      mockReader
    );
    const feeEffectKnownZero = manifestKnownZero.effects.find((e) => e.effectType === "PROVIDER_FEE_LEDGER")!;

    // F. KNOWN + positive fee => PENDING
    const manifestKnownPos = await PaymentFinalizationManifestService.planFinalization(
      {
        ...inputUnknownValid,
        feeKnowledge: "KNOWN",
        feeAmountCentavos: 500,
        feeObservedAtIso: "2026-08-31T10:05:00.000Z",
      },
      mockReader
    );
    const feeEffectKnownPos = manifestKnownPos.effects.find((e) => e.effectType === "PROVIDER_FEE_LEDGER")!;

    assert(
      feeEffectUnknown.status === "AWAITING_DATA" &&
        unknownAmountError &&
        unknownObservedError &&
        knownOmittedError &&
        feeEffectKnownZero.status === "NOT_APPLICABLE" &&
        feeEffectKnownPos.status === "PENDING" &&
        manifestKnownPos.feeObservedAt === "2026-08-31T10:05:00.000Z",
      "Test 7: Strict Fee Knowledge Contract verified across all UNKNOWN and KNOWN valid/invalid permutations"
    );
  }

  // Test 8: Transaction Identity Binding to Database Source of Truth
  {
    mockReader.reset();
    mockReader.transactions.set("txn_auth_1", {
      id: "txn_auth_1",
      userId: "user_owner",
      checkoutSessionId: "cs_auth_1",
    });
    mockReader.users.set("user_owner", { id: "user_owner", isPaid: false, paidUntil: null });

    const baseInput: FinalizationPlanningInput = {
      transactionId: "txn_auth_1",
      checkoutSessionId: "cs_auth_1",
      userId: "user_owner",
      planType: "1_MONTH",
      purchaseAmountCentavos: 9900,
      feeKnowledge: "UNKNOWN",
      source: "WEBHOOK",
      verifiedAtIso: testVerifiedAtStr,
    };

    // A. Matching identity succeeds
    const manifestTx = await PaymentFinalizationManifestService.planFinalization(baseInput, mockReader);

    // B. Transaction not found in DB fails closed
    let txNotFoundCaught = false;
    try {
      await PaymentFinalizationManifestService.planFinalization(
        { ...baseInput, transactionId: "txn_nonexistent" },
        mockReader
      );
    } catch (err) {
      if (err instanceof TransactionNotFoundError && err.code === "TRANSACTION_NOT_FOUND") {
        txNotFoundCaught = true;
      }
    }

    // C. User mismatch against Transaction.userId fails closed
    let userMismatchCaught = false;
    try {
      mockReader.users.set("user_impostor", { id: "user_impostor", isPaid: false, paidUntil: null });
      await PaymentFinalizationManifestService.planFinalization(
        { ...baseInput, userId: "user_impostor" },
        mockReader
      );
    } catch (err) {
      if (err instanceof TransactionIdentityMismatchError && err.code === "TRANSACTION_IDENTITY_MISMATCH") {
        userMismatchCaught = true;
      }
    }

    // D. CheckoutSessionId mismatch fails closed
    let csMismatchCaught = false;
    try {
      await PaymentFinalizationManifestService.planFinalization(
        { ...baseInput, checkoutSessionId: "cs_wrong_session" },
        mockReader
      );
    } catch (err) {
      if (err instanceof TransactionIdentityMismatchError && err.code === "TRANSACTION_IDENTITY_MISMATCH") {
        csMismatchCaught = true;
      }
    }

    assert(
      manifestTx.transactionId === "txn_auth_1" &&
        txNotFoundCaught &&
        userMismatchCaught &&
        csMismatchCaught,
      "Test 8: Transaction identity strictly bound to database source of truth (fails closed on mismatch or missing)"
    );
  }

  // Test 9: Referral Existing-Output State Machine (Cases A, B, and C)
  {
    mockReader.reset();
    mockReader.setupStandardContext("txn_ref_current", "user_ref_test", "cs_ref_test");

    // Case A: No existing reward => Normal PENDING referral planning
    mockReader.referrals.set("user_ref_test", {
      referralId: "ref_row_1",
      inviterId: "inviter_1",
      programEnabled: true,
      rewardType: "PERCENTAGE",
      rewardPercentage: 20.0,
      fixedRewardAmountCentavos: 0,
      holdingPeriodDays: 7,
      existingReward: null, // No existing reward
    });

    const inputRef: FinalizationPlanningInput = {
      transactionId: "txn_ref_current",
      checkoutSessionId: "cs_ref_test",
      userId: "user_ref_test",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900,
      feeKnowledge: "UNKNOWN",
      source: "WEBHOOK",
      verifiedAtIso: testVerifiedAtStr,
    };

    const manifestCaseA = await PaymentFinalizationManifestService.planReferralRewardEffect(
      inputRef.transactionId,
      inputRef.userId,
      inputRef.purchaseAmountCentavos,
      testVerifiedAtStr,
      mockReader
    );

    // Case B: Existing reward belongs to an EARLIER transaction => NOT_APPLICABLE (REFERRAL_ALREADY_REWARDED)
    mockReader.referrals.set("user_ref_test", {
      referralId: "ref_row_1",
      inviterId: "inviter_1",
      programEnabled: true,
      rewardType: "PERCENTAGE",
      rewardPercentage: 20.0,
      fixedRewardAmountCentavos: 0,
      holdingPeriodDays: 7,
      existingReward: { id: "reward_old", transactionId: "txn_earlier_123" }, // Different transaction
    });

    const manifestCaseB = await PaymentFinalizationManifestService.planReferralRewardEffect(
      inputRef.transactionId,
      inputRef.userId,
      inputRef.purchaseAmountCentavos,
      testVerifiedAtStr,
      mockReader
    );
    const intentCaseB = manifestCaseB.intent as ReferralRewardIntent;

    // Case C: Existing reward belongs to the SAME transaction => Conflict error
    mockReader.referrals.set("user_ref_test", {
      referralId: "ref_row_1",
      inviterId: "inviter_1",
      programEnabled: true,
      rewardType: "PERCENTAGE",
      rewardPercentage: 20.0,
      fixedRewardAmountCentavos: 0,
      holdingPeriodDays: 7,
      existingReward: { id: "reward_dup", transactionId: "txn_ref_current" }, // SAME transaction
    });

    let refConflictCaught = false;
    try {
      await PaymentFinalizationManifestService.planReferralRewardEffect(
        inputRef.transactionId,
        inputRef.userId,
        inputRef.purchaseAmountCentavos,
        testVerifiedAtStr,
        mockReader
      );
    } catch (err) {
      if (err instanceof ExistingReferralRewardConflictError && err.code === "EXISTING_REFERRAL_REWARD_CONFLICT") {
        refConflictCaught = true;
      }
    }

    assert(
      manifestCaseA.status === "PENDING" &&
        manifestCaseB.status === "NOT_APPLICABLE" &&
        intentCaseB.notApplicableReason === "REFERRAL_ALREADY_REWARDED" &&
        refConflictCaught,
      "Test 9: Referral existing-output state machine accurately distinguishes new, earlier-rewarded, and same-transaction conflicts"
    );
  }

  // Test 9.1: Referral configuration parity — canonical keys, defaults, and strict parsing
  {
    const defaults = parseReferralPlanningConfig([]);
    const legacyOnly = parseReferralPlanningConfig([
      { key: "PROGRAM_ENABLED", value: "true" },
      { key: "REWARD_TYPE", value: "FIXED" },
      { key: "REWARD_PERCENTAGE", value: "99" },
      { key: "FIXED_REWARD_AMOUNT_CENTAVOS", value: "1" },
      { key: "HOLDING_PERIOD_DAYS", value: "1" },
    ]);
    const canonical = parseReferralPlanningConfig([
      { key: REFERRAL_SETTING_KEYS.PROGRAM_ENABLED, value: "true" },
      { key: REFERRAL_SETTING_KEYS.REWARD_TYPE, value: "FIXED_AMOUNT" },
      { key: REFERRAL_SETTING_KEYS.REWARD_PERCENTAGE, value: "20.005" },
      { key: REFERRAL_SETTING_KEYS.FIXED_REWARD_AMOUNT_CENTAVOS, value: "0" },
      { key: REFERRAL_SETTING_KEYS.HOLDING_PERIOD_DAYS, value: "0" },
    ]);
    const canonicalFalse = parseReferralPlanningConfig([
      { key: REFERRAL_SETTING_KEYS.PROGRAM_ENABLED, value: "false" },
    ]);

    assert(
      defaults.programEnabled === false &&
        defaults.rewardType === "PERCENTAGE" &&
        defaults.rewardPercentage === 20 &&
        defaults.fixedRewardAmountCentavos === 5000 &&
        defaults.holdingPeriodDays === 7,
      "Test 9.1A: Missing referral settings use the canonical production defaults, including disabled-by-default"
    );
    assert(
      legacyOnly.programEnabled === defaults.programEnabled &&
        legacyOnly.rewardType === defaults.rewardType &&
        legacyOnly.rewardPercentage === defaults.rewardPercentage &&
        legacyOnly.fixedRewardAmountCentavos === defaults.fixedRewardAmountCentavos &&
        legacyOnly.holdingPeriodDays === defaults.holdingPeriodDays,
      "Test 9.1B: Legacy unprefixed referral setting keys are ignored"
    );
    assert(
      canonical.programEnabled &&
        canonicalFalse.programEnabled === false &&
        canonical.rewardType === "FIXED" &&
        canonical.rewardPercentage === 20.01 &&
        canonical.fixedRewardAmountCentavos === 0 &&
        canonical.holdingPeriodDays === 0,
      "Test 9.1C: Canonical prefixed keys map FIXED_AMOUNT to FIXED and preserve explicit numeric zeroes"
    );

    const invalidBooleanValues = ["", " ", "TRUE", "1", "0", "yes", "on"];
    const invalidBooleansFailClosed = invalidBooleanValues.every((value) => {
      try {
        parseReferralPlanningConfig([
          { key: REFERRAL_SETTING_KEYS.PROGRAM_ENABLED, value },
        ]);
        return false;
      } catch (error) {
        return error instanceof PaymentFinalizationPlanningError && error.code === "PLANNING_ERROR";
      }
    });
    assert(
      invalidBooleansFailClosed,
      "Test 9.1D: Present program-enabled values accept only exact true or false strings"
    );

    const invalidRewardTypeFailsClosed = ["FIXED", "UNKNOWN"].every((value) => {
      try {
        parseReferralPlanningConfig([
          { key: REFERRAL_SETTING_KEYS.REWARD_TYPE, value },
        ]);
        return false;
      } catch (error) {
        return error instanceof PaymentFinalizationPlanningError && error.code === "PLANNING_ERROR";
      }
    });
    assert(
      invalidRewardTypeFailsClosed,
      "Test 9.1E: Planner token FIXED and unknown values are not accepted as persisted production reward types"
    );
  }

  // Test 9.2: Referral numeric settings — clamp policy, bounds, and fail-closed errors
  {
    const percentageCases = [
      { value: "-1", expected: 0 },
      { value: "0", expected: 0 },
      { value: "20.005", expected: 20.01 },
      { value: "100", expected: 100 },
      { value: "101", expected: 100 },
    ];
    const percentagesNormalize = percentageCases.every(({ value, expected }) =>
      parseReferralPlanningConfig([
        { key: REFERRAL_SETTING_KEYS.REWARD_PERCENTAGE, value },
      ]).rewardPercentage === expected
    );
    assert(
      percentagesNormalize,
      "Test 9.2A: Finite referral percentages reuse production clamp and two-decimal rounding policy"
    );

    const invalidPercentageValues = ["", " ", "NaN", "Infinity", "-Infinity", "invalid"];
    const invalidPercentagesFailClosed = invalidPercentageValues.every((value) => {
      try {
        parseReferralPlanningConfig([
          { key: REFERRAL_SETTING_KEYS.REWARD_PERCENTAGE, value },
        ]);
        return false;
      } catch (error) {
        return error instanceof PaymentFinalizationPlanningError && error.code === "INVALID_RATE";
      }
    });
    assert(
      invalidPercentagesFailClosed,
      "Test 9.2B: Empty, malformed, and non-finite present percentages fail with INVALID_RATE"
    );

    const validFixedZero = parseReferralPlanningConfig([
      { key: REFERRAL_SETTING_KEYS.FIXED_REWARD_AMOUNT_CENTAVOS, value: "0" },
    ]).fixedRewardAmountCentavos;
    const validFixedMaximum = parseReferralPlanningConfig([
      {
        key: REFERRAL_SETTING_KEYS.FIXED_REWARD_AMOUNT_CENTAVOS,
        value: "2147483647",
      },
    ]).fixedRewardAmountCentavos;
    const invalidFixedValues = [
      "",
      " ",
      "-1",
      "1.5",
      "NaN",
      "Infinity",
      "2147483648",
      "9007199254740992",
    ];
    const invalidFixedAmountsFailClosed = invalidFixedValues.every((value) => {
      try {
        parseReferralPlanningConfig([
          { key: REFERRAL_SETTING_KEYS.FIXED_REWARD_AMOUNT_CENTAVOS, value },
        ]);
        return false;
      } catch (error) {
        return error instanceof InvalidMonetaryAmountError && error.code === "INVALID_MONETARY_AMOUNT";
      }
    });
    assert(
      validFixedZero === 0 &&
        validFixedMaximum === 2_147_483_647 &&
        invalidFixedAmountsFailClosed,
      "Test 9.2C: Fixed rewards preserve zero and reject invalid or PostgreSQL-incompatible integer values"
    );

    const validHoldingZero = parseReferralPlanningConfig([
      { key: REFERRAL_SETTING_KEYS.HOLDING_PERIOD_DAYS, value: "0" },
    ]).holdingPeriodDays;
    const validLargeHoldingPeriod = parseReferralPlanningConfig([
      {
        key: REFERRAL_SETTING_KEYS.HOLDING_PERIOD_DAYS,
        value: String(Number.MAX_SAFE_INTEGER),
      },
    ]).holdingPeriodDays;
    const invalidHoldingValues = ["", " ", "-1", "1.5", "NaN", "Infinity", "9007199254740992"];
    const invalidHoldingPeriodsFailClosed = invalidHoldingValues.every((value) => {
      try {
        parseReferralPlanningConfig([
          { key: REFERRAL_SETTING_KEYS.HOLDING_PERIOD_DAYS, value },
        ]);
        return false;
      } catch (error) {
        return error instanceof PaymentFinalizationPlanningError && error.code === "PLANNING_ERROR";
      }
    });
    assert(
      validHoldingZero === 0 &&
        validLargeHoldingPeriod === Number.MAX_SAFE_INTEGER &&
        invalidHoldingPeriodsFailClosed,
      "Test 9.2D: Holding periods preserve zero, impose no arbitrary cap, and reject invalid integers"
    );
  }

  // Test 9.3: Referral intent metadata and production-equivalent percentage arithmetic
  {
    mockReader.reset();

    const disabledConfig = parseReferralPlanningConfig([]);
    mockReader.referrals.set("user_ref_disabled", {
      referralId: "ref_disabled",
      inviterId: "inviter_disabled",
      ...disabledConfig,
      existingReward: null,
    });
    const disabledEffect = await PaymentFinalizationManifestService.planReferralRewardEffect(
      "txn_ref_disabled",
      "user_ref_disabled",
      29900,
      testVerifiedAtStr,
      mockReader
    );
    const disabledIntent = disabledEffect.intent as ReferralRewardIntent;

    const fixedConfig = parseReferralPlanningConfig([
      { key: REFERRAL_SETTING_KEYS.PROGRAM_ENABLED, value: "true" },
      { key: REFERRAL_SETTING_KEYS.REWARD_TYPE, value: "FIXED_AMOUNT" },
      { key: REFERRAL_SETTING_KEYS.FIXED_REWARD_AMOUNT_CENTAVOS, value: "1234" },
      { key: REFERRAL_SETTING_KEYS.HOLDING_PERIOD_DAYS, value: "0" },
    ]);
    mockReader.referrals.set("user_ref_fixed", {
      referralId: "ref_fixed",
      inviterId: "inviter_fixed",
      ...fixedConfig,
      existingReward: null,
    });
    const fixedEffect = await PaymentFinalizationManifestService.planReferralRewardEffect(
      "txn_ref_fixed",
      "user_ref_fixed",
      29900,
      testVerifiedAtStr,
      mockReader
    );
    const fixedIntent = fixedEffect.intent as ReferralRewardIntent;

    mockReader.referrals.set("user_ref_fixed_disabled", {
      referralId: "ref_fixed_disabled",
      inviterId: "inviter_fixed_disabled",
      ...fixedConfig,
      programEnabled: false,
      existingReward: null,
    });
    const fixedDisabledEffect = await PaymentFinalizationManifestService.planReferralRewardEffect(
      "txn_ref_fixed_disabled",
      "user_ref_fixed_disabled",
      29900,
      testVerifiedAtStr,
      mockReader
    );
    const fixedDisabledIntent = fixedDisabledEffect.intent as ReferralRewardIntent;

    mockReader.referrals.set("user_ref_fixed_zero", {
      referralId: "ref_fixed_zero",
      inviterId: "inviter_fixed_zero",
      ...fixedConfig,
      fixedRewardAmountCentavos: 0,
      existingReward: null,
    });
    const fixedZeroEffect = await PaymentFinalizationManifestService.planReferralRewardEffect(
      "txn_ref_fixed_zero",
      "user_ref_fixed_zero",
      29900,
      testVerifiedAtStr,
      mockReader
    );
    const fixedZeroIntent = fixedZeroEffect.intent as ReferralRewardIntent;

    mockReader.referrals.set("user_ref_fixed_prior", {
      referralId: "ref_fixed_prior",
      inviterId: "inviter_fixed_prior",
      ...fixedConfig,
      existingReward: { id: "reward_fixed_prior", transactionId: "txn_ref_prior" },
    });
    const fixedPriorEffect = await PaymentFinalizationManifestService.planReferralRewardEffect(
      "txn_ref_fixed_current",
      "user_ref_fixed_prior",
      29900,
      testVerifiedAtStr,
      mockReader
    );
    const fixedPriorIntent = fixedPriorEffect.intent as ReferralRewardIntent;

    assert(
      disabledEffect.status === "NOT_APPLICABLE" &&
        disabledIntent.notApplicableReason === "PROGRAM_DISABLED" &&
        disabledIntent.rewardRateBasisPoints === 2000,
      "Test 9.3A: Missing settings generate a disabled percentage intent with canonical metadata"
    );
    assert(
      fixedEffect.status === "PENDING" &&
        fixedIntent.rewardAmountCentavos === 1234 &&
        fixedIntent.rewardRateBasisPoints === 0 &&
        fixedIntent.holdingUntil === testVerifiedAtStr &&
        fixedDisabledIntent.notApplicableReason === "PROGRAM_DISABLED" &&
        fixedDisabledIntent.rewardRateBasisPoints === 0 &&
        fixedZeroIntent.notApplicableReason === "ZERO_REWARD_CALCULATED" &&
        fixedZeroIntent.rewardRateBasisPoints === 0 &&
        fixedPriorIntent.notApplicableReason === "REFERRAL_ALREADY_REWARDED" &&
        fixedPriorIntent.rewardRateBasisPoints === 0,
      "Test 9.3B: FIXED intents use zero basis points across pending, disabled, zero, and earlier-reward branches"
    );

    const percentageConfig = parseReferralPlanningConfig([
      { key: REFERRAL_SETTING_KEYS.PROGRAM_ENABLED, value: "true" },
      { key: REFERRAL_SETTING_KEYS.REWARD_TYPE, value: "PERCENTAGE" },
      { key: REFERRAL_SETTING_KEYS.REWARD_PERCENTAGE, value: "38.80" },
      { key: REFERRAL_SETTING_KEYS.HOLDING_PERIOD_DAYS, value: "0" },
    ]);
    mockReader.referrals.set("user_ref_percentage", {
      referralId: "ref_percentage",
      inviterId: "inviter_percentage",
      ...percentageConfig,
      existingReward: null,
    });
    const percentageEffectA = await PaymentFinalizationManifestService.planReferralRewardEffect(
      "txn_ref_percentage",
      "user_ref_percentage",
      13_423_625,
      testVerifiedAtStr,
      mockReader
    );
    const percentageEffectB = await PaymentFinalizationManifestService.planReferralRewardEffect(
      "txn_ref_percentage",
      "user_ref_percentage",
      13_423_625,
      testVerifiedAtStr,
      mockReader
    );
    const percentageIntent = percentageEffectA.intent as ReferralRewardIntent;
    assert(
      percentageIntent.rewardRateBasisPoints === 3880 &&
        percentageIntent.rewardAmountCentavos === 5_208_366 &&
        percentageEffectA.intentHash === percentageEffectB.intentHash,
      "Test 9.3C: Percentage planning uses canonical basis points, production formula ordering, and deterministic hashes"
    );

    const roundedConfig = parseReferralPlanningConfig([
      { key: REFERRAL_SETTING_KEYS.PROGRAM_ENABLED, value: "true" },
      { key: REFERRAL_SETTING_KEYS.REWARD_PERCENTAGE, value: "20.005" },
      { key: REFERRAL_SETTING_KEYS.HOLDING_PERIOD_DAYS, value: "0" },
    ]);
    mockReader.referrals.set("user_ref_rounded", {
      referralId: "ref_rounded",
      inviterId: "inviter_rounded",
      ...roundedConfig,
      existingReward: null,
    });
    const roundedEffect = await PaymentFinalizationManifestService.planReferralRewardEffect(
      "txn_ref_rounded",
      "user_ref_rounded",
      29900,
      testVerifiedAtStr,
      mockReader
    );
    const roundedIntent = roundedEffect.intent as ReferralRewardIntent;
    assert(
      roundedIntent.rewardRateBasisPoints === 2001 &&
        roundedIntent.rewardAmountCentavos === 5983,
      "Test 9.3D: Sanitized percentage metadata and reward calculation share one canonical rate"
    );
  }

  // Test 9.4: Referral conflict precedence and holding timestamp overflow protection
  {
    mockReader.reset();
    mockReader.referrals.set("user_ref_precedence", {
      referralId: "ref_precedence",
      inviterId: "inviter_precedence",
      programEnabled: true,
      rewardType: "PERCENTAGE",
      rewardPercentage: 101,
      fixedRewardAmountCentavos: 0,
      holdingPeriodDays: -1,
      existingReward: { id: "reward_same", transactionId: "txn_ref_precedence" },
    });
    let sameTransactionConflictPrecedesConfigValidation = false;
    try {
      await PaymentFinalizationManifestService.planReferralRewardEffect(
        "txn_ref_precedence",
        "user_ref_precedence",
        29900,
        testVerifiedAtStr,
        mockReader
      );
    } catch (error) {
      sameTransactionConflictPrecedesConfigValidation =
        error instanceof ExistingReferralRewardConflictError &&
        error.code === "EXISTING_REFERRAL_REWARD_CONFLICT";
    }

    const overflowConfig = parseReferralPlanningConfig([
      { key: REFERRAL_SETTING_KEYS.PROGRAM_ENABLED, value: "true" },
      {
        key: REFERRAL_SETTING_KEYS.HOLDING_PERIOD_DAYS,
        value: String(Number.MAX_SAFE_INTEGER),
      },
    ]);
    mockReader.referrals.set("user_ref_overflow", {
      referralId: "ref_overflow",
      inviterId: "inviter_overflow",
      ...overflowConfig,
      existingReward: null,
    });
    let holdingOverflowFailsClosed = false;
    try {
      await PaymentFinalizationManifestService.planReferralRewardEffect(
        "txn_ref_overflow",
        "user_ref_overflow",
        29900,
        testVerifiedAtStr,
        mockReader
      );
    } catch (error) {
      holdingOverflowFailsClosed =
        error instanceof InvalidTimestampError && error.code === "INVALID_TIMESTAMP";
    }

    assert(
      sameTransactionConflictPrecedesConfigValidation,
      "Test 9.4A: Same-transaction existing reward conflict retains precedence"
    );
    assert(
      holdingOverflowFailsClosed,
      "Test 9.4B: Holding date arithmetic overflow fails closed before ISO serialization"
    );
  }

  // Test 10: Partner Existing-Output State Machine & partnerCode Non-Authority
  {
    mockReader.reset();
    mockReader.setupStandardContext("txn_ptr_current", "user_ptr_test", "cs_ptr_test");

    // A. Same-transaction existing commission => Conflict error
    mockReader.partnerCommissions.set("txn_ptr_current", {
      id: "comm_existing_1",
      partnerId: "part_1",
      transactionId: "txn_ptr_current",
    });

    let partnerConflictCaught = false;
    try {
      await PaymentFinalizationManifestService.planPartnerCommissionEffects(
        "txn_ptr_current",
        "user_ptr_test",
        29900,
        undefined,
        undefined,
        testVerifiedAtStr,
        mockReader
      );
    } catch (err) {
      if (err instanceof ExistingPartnerCommissionConflictError && err.code === "EXISTING_PARTNER_COMMISSION_CONFLICT") {
        partnerConflictCaught = true;
      }
    }

    // B. Earlier transaction commission does NOT block current transaction
    mockReader.partnerCommissions.clear();
    mockReader.partnerCommissions.set("txn_ptr_earlier", {
      id: "comm_earlier_1",
      partnerId: "part_1",
      transactionId: "txn_ptr_earlier",
    });
    mockReader.partners.set("user_ptr_test", {
      partnerId: "part_1",
      partnerCode: "PARTNER_ACTIVE",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRate: 15.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
    });

    const effectsPartner = await PaymentFinalizationManifestService.planPartnerCommissionEffects(
      "txn_ptr_current",
      "user_ptr_test",
      29900,
      undefined,
      undefined,
      testVerifiedAtStr,
      mockReader
    );

    // C. No persisted attribution + raw partnerCode in input does NOT establish eligibility
    mockReader.partners.clear();
    const effectsNoAttr = await PaymentFinalizationManifestService.planPartnerCommissionEffects(
      "txn_ptr_current",
      "user_ptr_test",
      29900,
      undefined,
      undefined,
      testVerifiedAtStr,
      mockReader
    );
    const intentNoAttr = effectsNoAttr[0].intent as PartnerCommissionIntent;

    assert(
      partnerConflictCaught &&
        effectsPartner[0].status === "PENDING" &&
        effectsNoAttr[0].status === "NOT_APPLICABLE" &&
        intentNoAttr.notApplicableReason === "NO_PARTNER_ATTRIBUTION",
      "Test 10: Partner existing commission conflict and non-authoritative raw partnerCode verified"
    );
  }

  // Test 10.1: Partner Holding Period Determinism & Parity (Zero-day, integer arithmetic, fail-closed)
  {
    mockReader.reset();
    mockReader.setupStandardContext("txn_ptr_hold", "user_ptr_hold", "cs_ptr_hold");

    // 10.1A: holdingPeriodDays = 0 preserved in intent and produces holdingUntil === verifiedAtIso
    mockReader.partners.set("user_ptr_hold", {
      partnerId: "part_hold_0",
      partnerCode: "PART_ZERO_HOLD",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRate: 10.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 0,
      defaultCampaignSource: null,
    });

    const effectsZeroHold = await PaymentFinalizationManifestService.planPartnerCommissionEffects(
      "txn_ptr_hold",
      "user_ptr_hold",
      10000,
      undefined,
      undefined,
      testVerifiedAtStr,
      mockReader
    );
    const intentZeroHold = effectsZeroHold[0].intent as PartnerCommissionIntent;

    // 10.1B: Positive holdingPeriodDays (14 days) exact ms arithmetic
    mockReader.partners.set("user_ptr_hold", {
      partnerId: "part_hold_14",
      partnerCode: "PART_14_HOLD",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRate: 10.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 14,
      defaultCampaignSource: null,
    });

    const effects14Hold = await PaymentFinalizationManifestService.planPartnerCommissionEffects(
      "txn_ptr_hold",
      "user_ptr_hold",
      10000,
      undefined,
      undefined,
      testVerifiedAtStr,
      mockReader
    );
    const intent14Hold = effects14Hold[0].intent as PartnerCommissionIntent;
    const expected14Iso = new Date(new Date(testVerifiedAtStr).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // 10.1C: Negative holdingPeriodDays rejected
    mockReader.partners.set("user_ptr_hold", {
      partnerId: "part_hold_neg",
      partnerCode: "PART_NEG_HOLD",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRate: 10.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: -1,
      defaultCampaignSource: null,
    });

    let negHoldCaught = false;
    try {
      await PaymentFinalizationManifestService.planPartnerCommissionEffects(
        "txn_ptr_hold",
        "user_ptr_hold",
        10000,
        undefined,
        undefined,
        testVerifiedAtStr,
        mockReader
      );
    } catch (err) {
      if (err instanceof PaymentFinalizationPlanningError && err.code === "PLANNING_ERROR") {
        negHoldCaught = true;
      }
    }

    // 10.1D: Fractional holdingPeriodDays rejected
    mockReader.partners.set("user_ptr_hold", {
      partnerId: "part_hold_frac",
      partnerCode: "PART_FRAC_HOLD",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRate: 10.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 3.5,
      defaultCampaignSource: null,
    });

    let fracHoldCaught = false;
    try {
      await PaymentFinalizationManifestService.planPartnerCommissionEffects(
        "txn_ptr_hold",
        "user_ptr_hold",
        10000,
        undefined,
        undefined,
        testVerifiedAtStr,
        mockReader
      );
    } catch (err) {
      if (err instanceof PaymentFinalizationPlanningError && err.code === "PLANNING_ERROR") {
        fracHoldCaught = true;
      }
    }

    // 10.1E: Partner holding duration overflow (Number.MAX_SAFE_INTEGER) rejected with INVALID_TIMESTAMP
    mockReader.partners.set("user_ptr_hold", {
      partnerId: "part_hold_overflow",
      partnerCode: "PART_OVERFLOW_HOLD",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRate: 10.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: Number.MAX_SAFE_INTEGER,
      defaultCampaignSource: null,
    });

    let overflowHoldCaught = false;
    try {
      await PaymentFinalizationManifestService.planPartnerCommissionEffects(
        "txn_ptr_hold",
        "user_ptr_hold",
        10000,
        undefined,
        undefined,
        testVerifiedAtStr,
        mockReader
      );
    } catch (err) {
      if (err instanceof InvalidTimestampError && err.code === "INVALID_TIMESTAMP") {
        overflowHoldCaught = true;
      }
    }

    assert(
      intentZeroHold.holdingPeriodDays === 0 &&
        intentZeroHold.holdingUntil === testVerifiedAtStr &&
        intent14Hold.holdingPeriodDays === 14 &&
        intent14Hold.holdingUntil === expected14Iso &&
        negHoldCaught &&
        fracHoldCaught &&
        overflowHoldCaught,
      "Test 10.1: Partner holding period determinism (0-day preserved, 14-day exact ms arithmetic, negative/fractional/overflow rejected)"
    );
  }

  // Test 10.2: Active Partner Model Classification Precedence & Unsupported Model Guard
  {
    mockReader.reset();
    mockReader.setupStandardContext("txn_ptr_model", "user_ptr_model", "cs_ptr_model");

    // 10.2A: ACTIVE CUSTOM_RULE with malformed holdingPeriodDays fails as unsupported model (proves holding validation is NOT reached)
    mockReader.partners.set("user_ptr_model", {
      partnerId: "part_custom",
      partnerCode: "PART_CUSTOM",
      status: "ACTIVE",
      commissionModel: "CUSTOM_RULE",
      commissionRate: 10.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: -999,
      defaultCampaignSource: null,
    });

    let customRuleCaught = false;
    let customRuleMsg = "";
    try {
      await PaymentFinalizationManifestService.planPartnerCommissionEffects(
        "txn_ptr_model",
        "user_ptr_model",
        10000,
        undefined,
        undefined,
        testVerifiedAtStr,
        mockReader
      );
    } catch (err) {
      if (err instanceof PaymentFinalizationPlanningError && err.code === "PLANNING_ERROR") {
        customRuleCaught = true;
        customRuleMsg = err.message;
      }
    }

    // 10.2B: ACTIVE FIXED_PER_REFERRAL with malformed rate/fixed/holding fails as unsupported model immediately
    mockReader.partners.set("user_ptr_model", {
      partnerId: "part_fpr",
      partnerCode: "PART_FPR",
      status: "ACTIVE",
      commissionModel: "FIXED_PER_REFERRAL",
      commissionRate: Number.NaN,
      fixedCommissionCentavos: -500,
      holdingPeriodDays: -10,
      defaultCampaignSource: null,
    });

    let fprCaught = false;
    let fprMsg = "";
    try {
      await PaymentFinalizationManifestService.planPartnerCommissionEffects(
        "txn_ptr_model",
        "user_ptr_model",
        10000,
        undefined,
        undefined,
        testVerifiedAtStr,
        mockReader
      );
    } catch (err) {
      if (err instanceof PaymentFinalizationPlanningError && err.code === "PLANNING_ERROR") {
        fprCaught = true;
        fprMsg = err.message;
      }
    }

    // 10.2C: ACTIVE PERCENTAGE_OF_NET_AFTER_CONFIGURED_DEDUCTIONS fails as unsupported model
    mockReader.partners.set("user_ptr_model", {
      partnerId: "part_net_ded",
      partnerCode: "PART_NET_DED",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_NET_AFTER_CONFIGURED_DEDUCTIONS",
      commissionRate: 10.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
    });

    let netDedCaught = false;
    try {
      await PaymentFinalizationManifestService.planPartnerCommissionEffects(
        "txn_ptr_model",
        "user_ptr_model",
        10000,
        undefined,
        undefined,
        testVerifiedAtStr,
        mockReader
      );
    } catch (err) {
      if (err instanceof PaymentFinalizationPlanningError && err.code === "PLANNING_ERROR") {
        netDedCaught = true;
      }
    }

    assert(
      customRuleCaught &&
        customRuleMsg.includes('Unsupported partner commission model: "CUSTOM_RULE"') &&
        fprCaught &&
        fprMsg.includes('Unsupported partner commission model: "FIXED_PER_REFERRAL"') &&
        netDedCaught,
      "Test 10.2: Active partner model classification precedence (unsupported models fail closed immediately before holding/rate validation)"
    );
  }

  // Test 10.3: Model-Specific Financial Input Isolation
  {
    mockReader.reset();
    mockReader.setupStandardContext("txn_ptr_iso", "user_ptr_iso", "cs_ptr_iso");

    // 10.3A: FIXED_PER_PURCHASE with unused commissionRate (NaN, Infinity, -999) succeeds with rateBps = 0
    for (const unusedRate of [Number.NaN, Number.POSITIVE_INFINITY, -999]) {
      mockReader.partners.set("user_ptr_iso", {
        partnerId: "part_fpp",
        partnerCode: "PART_FPP",
        status: "ACTIVE",
        commissionModel: "FIXED_PER_PURCHASE",
        commissionRate: unusedRate,
        fixedCommissionCentavos: 5000,
        holdingPeriodDays: 7,
        defaultCampaignSource: null,
      });

      const effectsFpp = await PaymentFinalizationManifestService.planPartnerCommissionEffects(
        "txn_ptr_iso",
        "user_ptr_iso",
        29900,
        undefined,
        undefined,
        testVerifiedAtStr,
        mockReader
      );
      const intentFpp = effectsFpp[0].intent as PartnerCommissionIntent;

      assert(
        intentFpp.commissionModel === "FIXED_PER_PURCHASE" &&
          intentFpp.commissionRateBasisPoints === 0 &&
          intentFpp.calculationBasis === "FIXED_AMOUNT" &&
          intentFpp.baseAmountCentavos === null &&
          intentFpp.commissionAmountCentavos === 5000,
        `Test 10.3A: FIXED_PER_PURCHASE with unused rate ${unusedRate} succeeds with rateBps=0`
      );
    }

    // 10.3B: PERCENTAGE_OF_CUSTOMER_PAYMENT with unused fixedCommissionCentavos (-500, NaN) succeeds without validating fixed amount
    for (const unusedFixed of [-500, Number.NaN]) {
      mockReader.partners.set("user_ptr_iso", {
        partnerId: "part_pcp",
        partnerCode: "PART_PCP",
        status: "ACTIVE",
        commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
        commissionRate: 15.0,
        fixedCommissionCentavos: unusedFixed,
        holdingPeriodDays: 7,
        defaultCampaignSource: null,
      });

      const effectsPcp = await PaymentFinalizationManifestService.planPartnerCommissionEffects(
        "txn_ptr_iso",
        "user_ptr_iso",
        20000,
        undefined,
        undefined,
        testVerifiedAtStr,
        mockReader
      );
      const intentPcp = effectsPcp[0].intent as PartnerCommissionIntent;

      assert(
        intentPcp.commissionModel === "PERCENTAGE_OF_CUSTOMER_PAYMENT" &&
          intentPcp.commissionRateBasisPoints === 1500 &&
          intentPcp.calculationBasis === "CUSTOMER_PAYMENT" &&
          intentPcp.baseAmountCentavos === 20000 &&
          intentPcp.commissionAmountCentavos === 3000,
        `Test 10.3B: PERCENTAGE_OF_CUSTOMER_PAYMENT with unused fixed ${unusedFixed} succeeds without validating fixed amount`
      );
    }
  }

  // Test 10.4: Canonical Rate Parity & Evaluated Percentage Arithmetic
  {
    mockReader.reset();
    mockReader.setupStandardContext("txn_ptr_rate", "user_ptr_rate", "cs_ptr_rate");

    // 10.4A: 3-decimal rate 12.345% normalizes to 1235 bps (12.35%), calculates 123,500 centavos on 1,000,000 centavos
    mockReader.partners.set("user_ptr_rate", {
      partnerId: "part_rate_bps",
      partnerCode: "PART_RATE_BPS",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRate: 12.345,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
    });

    const effectsBps = await PaymentFinalizationManifestService.planPartnerCommissionEffects(
      "txn_ptr_rate",
      "user_ptr_rate",
      1000000,
      undefined,
      undefined,
      testVerifiedAtStr,
      mockReader
    );
    const intentBps = effectsBps[0].intent as PartnerCommissionIntent;
    const oldRawCalc = Math.round((1000000 * 12.345) / 100); // 123450

    // 10.4B: Real JavaScript floating-point operation-order counterexample
    // Demonstrates that Math.round((base * (rateBps / 100)) / 100) !== Math.round(base * rateBps / 10000)
    const operationOrderBase = 13_423_625;
    const operationOrderRateBps = 3_880; // 38.80%
    const operationOrderCanonicalPercentage = operationOrderRateBps / 100;
    const canonicalOperationOrderAmount = Math.round(
      (operationOrderBase * operationOrderCanonicalPercentage) / 100
    );
    const directBasisPointAmount = Math.round(
      (operationOrderBase * operationOrderRateBps) / 10_000
    );
    const counterexampleDiverges = (canonicalOperationOrderAmount as number) !== (directBasisPointAmount as number);

    // Verify mathematical preconditions of the counterexample
    assert(
      canonicalOperationOrderAmount === 5_208_366 &&
        directBasisPointAmount === 5_208_367 &&
        counterexampleDiverges,
      "Counterexample mathematical preconditions verified (5208366 vs 5208367)"
    );

    // Exercise the actual partner planner
    mockReader.partners.set("user_ptr_rate", {
      partnerId: "part_op_order",
      partnerCode: "PART_OP_ORDER",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRate: 38.8,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
    });

    const effectsOpOrder = await PaymentFinalizationManifestService.planPartnerCommissionEffects(
      "txn_ptr_rate",
      "user_ptr_rate",
      operationOrderBase,
      undefined,
      undefined,
      testVerifiedAtStr,
      mockReader
    );
    const intentOpOrder = effectsOpOrder[0].intent as PartnerCommissionIntent;

    // 10.4C: PERCENTAGE_OF_GROSS with valid gross amount vs missing gross amount
    mockReader.partners.set("user_ptr_rate", {
      partnerId: "part_gross",
      partnerCode: "PART_GROSS",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_GROSS",
      commissionRate: 20.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
    });

    const effectsGross = await PaymentFinalizationManifestService.planPartnerCommissionEffects(
      "txn_ptr_rate",
      "user_ptr_rate",
      15000,
      30000, // authoritative gross
      undefined,
      testVerifiedAtStr,
      mockReader
    );
    const intentGross = effectsGross[0].intent as PartnerCommissionIntent;

    let missingGrossCaught = false;
    try {
      await PaymentFinalizationManifestService.planPartnerCommissionEffects(
        "txn_ptr_rate",
        "user_ptr_rate",
        15000,
        undefined, // missing gross
        undefined,
        testVerifiedAtStr,
        mockReader
      );
    } catch (err) {
      if (err instanceof MissingAuthoritativeGrossError && err.code === "MISSING_AUTHORITATIVE_GROSS") {
        missingGrossCaught = true;
      }
    }

    // 10.4D: Invalid rate (<0 or >100 or NaN) throws INVALID_RATE
    mockReader.partners.set("user_ptr_rate", {
      partnerId: "part_inval_rate",
      partnerCode: "PART_INVAL_RATE",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRate: -5.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
    });

    let invalidRateCaught = false;
    try {
      await PaymentFinalizationManifestService.planPartnerCommissionEffects(
        "txn_ptr_rate",
        "user_ptr_rate",
        10000,
        undefined,
        undefined,
        testVerifiedAtStr,
        mockReader
      );
    } catch (err) {
      if (err instanceof PaymentFinalizationPlanningError && err.code === "INVALID_RATE") {
        invalidRateCaught = true;
      }
    }

    const plannerMatchesCanonical =
      intentOpOrder.commissionAmountCentavos === canonicalOperationOrderAmount &&
      (intentOpOrder.commissionAmountCentavos as number) !== (directBasisPointAmount as number);

    assert(
      intentBps.commissionRateBasisPoints === 1235 &&
        intentBps.commissionAmountCentavos === 123500 &&
        intentBps.commissionAmountCentavos !== oldRawCalc &&
        intentOpOrder.commissionRateBasisPoints === 3880 &&
        intentOpOrder.commissionAmountCentavos === 5208366 &&
        plannerMatchesCanonical &&
        intentGross.commissionModel === "PERCENTAGE_OF_GROSS" &&
        intentGross.calculationBasis === "GROSS_PRICE" &&
        intentGross.baseAmountCentavos === 30000 &&
        intentGross.commissionAmountCentavos === 6000 &&
        missingGrossCaught &&
        invalidRateCaught,
      "Test 10.4: Canonical rate parity, authoritative percentage evaluation order with counterexample, gross base validation, and INVALID_RATE handling"
    );
  }

  // Test 10.5: Fixed Amount Validation & Zero Commission
  {
    mockReader.reset();
    mockReader.setupStandardContext("txn_ptr_fixed", "user_ptr_fixed", "cs_ptr_fixed");

    // 10.5A: FIXED_PER_PURCHASE zero fixed amount -> ZERO_COMMISSION_CALCULATED paired NOT_APPLICABLE
    mockReader.partners.set("user_ptr_fixed", {
      partnerId: "part_fpp_0",
      partnerCode: "PART_FPP_0",
      status: "ACTIVE",
      commissionModel: "FIXED_PER_PURCHASE",
      commissionRate: 0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
    });

    const effectsZeroFixed = await PaymentFinalizationManifestService.planPartnerCommissionEffects(
      "txn_ptr_fixed",
      "user_ptr_fixed",
      10000,
      undefined,
      undefined,
      testVerifiedAtStr,
      mockReader
    );
    const intentZeroFixedComm = effectsZeroFixed[0].intent as PartnerCommissionIntent;
    const intentZeroFixedLiab = effectsZeroFixed[1].intent as PartnerLiabilityLedgerIntent;

    // 10.5B: Negative fixed amount rejected
    mockReader.partners.set("user_ptr_fixed", {
      partnerId: "part_fpp_neg",
      partnerCode: "PART_FPP_NEG",
      status: "ACTIVE",
      commissionModel: "FIXED_PER_PURCHASE",
      commissionRate: 0,
      fixedCommissionCentavos: -100,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
    });

    let negFixedCaught = false;
    try {
      await PaymentFinalizationManifestService.planPartnerCommissionEffects(
        "txn_ptr_fixed",
        "user_ptr_fixed",
        10000,
        undefined,
        undefined,
        testVerifiedAtStr,
        mockReader
      );
    } catch (err) {
      if (err instanceof InvalidMonetaryAmountError && err.code === "INVALID_MONETARY_AMOUNT") {
        negFixedCaught = true;
      }
    }

    // 10.5C: Fractional fixed amount rejected
    mockReader.partners.set("user_ptr_fixed", {
      partnerId: "part_fpp_frac",
      partnerCode: "PART_FPP_FRAC",
      status: "ACTIVE",
      commissionModel: "FIXED_PER_PURCHASE",
      commissionRate: 0,
      fixedCommissionCentavos: 100.5,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
    });

    let fracFixedCaught = false;
    try {
      await PaymentFinalizationManifestService.planPartnerCommissionEffects(
        "txn_ptr_fixed",
        "user_ptr_fixed",
        10000,
        undefined,
        undefined,
        testVerifiedAtStr,
        mockReader
      );
    } catch (err) {
      if (err instanceof InvalidMonetaryAmountError && err.code === "INVALID_MONETARY_AMOUNT") {
        fracFixedCaught = true;
      }
    }

    // 10.5D: Fixed amount exceeding PostgreSQL integer maximum rejected
    mockReader.partners.set("user_ptr_fixed", {
      partnerId: "part_fpp_max",
      partnerCode: "PART_FPP_MAX",
      status: "ACTIVE",
      commissionModel: "FIXED_PER_PURCHASE",
      commissionRate: 0,
      fixedCommissionCentavos: 2_147_483_648,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
    });

    let maxFixedCaught = false;
    try {
      await PaymentFinalizationManifestService.planPartnerCommissionEffects(
        "txn_ptr_fixed",
        "user_ptr_fixed",
        10000,
        undefined,
        undefined,
        testVerifiedAtStr,
        mockReader
      );
    } catch (err) {
      if (err instanceof InvalidMonetaryAmountError && err.code === "INVALID_MONETARY_AMOUNT") {
        maxFixedCaught = true;
      }
    }

    assert(
      intentZeroFixedComm.status === "NOT_APPLICABLE" &&
        intentZeroFixedComm.notApplicableReason === "ZERO_COMMISSION_CALCULATED" &&
        intentZeroFixedComm.commissionRateBasisPoints === 0 &&
        intentZeroFixedComm.commissionAmountCentavos === 0 &&
        intentZeroFixedComm.holdingUntil === null &&
        intentZeroFixedLiab.status === "NOT_APPLICABLE" &&
        intentZeroFixedLiab.notApplicableReason === "NO_PARTNER_COMMISSION" &&
        intentZeroFixedLiab.amountCentavos === 0 &&
        intentZeroFixedLiab.debitCategory === null &&
        intentZeroFixedLiab.creditCategory === null &&
        negFixedCaught &&
        fracFixedCaught &&
        maxFixedCaught,
      "Test 10.5: Fixed commission amount validation (zero->ZERO_COMMISSION_CALCULATED, negative/fractional/overflow rejected)"
    );
  }

  // Test 10.6: Inactive Partner Graceful NOT_APPLICABLE & Non-Interference
  {
    mockReader.reset();
    mockReader.setupStandardContext("txn_ptr_inact", "user_ptr_inact", "cs_ptr_inact");

    // 10.6A: INACTIVE partner with malformed/unsupported fields (CUSTOM_RULE, rate=NaN, fixed=-500, holding=-10) succeeds as NOT_APPLICABLE
    mockReader.partners.set("user_ptr_inact", {
      partnerId: "part_inact_dormant",
      partnerCode: "PART_INACT_DORMANT",
      status: "SUSPENDED",
      commissionModel: "CUSTOM_RULE",
      commissionRate: Number.NaN,
      fixedCommissionCentavos: -500,
      holdingPeriodDays: -10,
      defaultCampaignSource: "sub_channel_a",
    });

    const effectsInact = await PaymentFinalizationManifestService.planPartnerCommissionEffects(
      "txn_ptr_inact",
      "user_ptr_inact",
      10000,
      undefined,
      "campaign_override",
      testVerifiedAtStr,
      mockReader
    );
    const intentInactComm = effectsInact[0].intent as PartnerCommissionIntent;
    const intentInactLiab = effectsInact[1].intent as PartnerLiabilityLedgerIntent;

    assert(
      effectsInact[0].status === "NOT_APPLICABLE" &&
        intentInactComm.notApplicableReason === "INACTIVE_PARTNER" &&
        intentInactComm.partnerId === "part_inact_dormant" &&
        intentInactComm.partnerCode === "PART_INACT_DORMANT" &&
        intentInactComm.commissionModel === "CUSTOM_RULE" &&
        intentInactComm.commissionRateBasisPoints === null &&
        intentInactComm.calculationBasis === null &&
        intentInactComm.baseAmountCentavos === null &&
        intentInactComm.commissionAmountCentavos === 0 &&
        intentInactComm.campaignSource === "campaign_override" &&
        intentInactComm.holdingPeriodDays === null &&
        intentInactComm.holdingUntil === null &&
        effectsInact[1].status === "NOT_APPLICABLE" &&
        intentInactLiab.notApplicableReason === "NO_PARTNER_COMMISSION" &&
        intentInactLiab.partnerId === "part_inact_dormant" &&
        intentInactLiab.amountCentavos === 0 &&
        intentInactLiab.debitCategory === null &&
        intentInactLiab.creditCategory === null,
      "Test 10.6: Inactive partner graceful NOT_APPLICABLE without active financial validation interference"
    );
  }

  // Test 11: Entitlement Snapshot (expired/null vs active subscription extensions)
  {
    mockReader.reset();

    // A. Null/expired entitlement => base date is verifiedAt
    mockReader.setupStandardContext("txn_ent_1", "user_ent_1", "cs_ent_1");
    mockReader.users.set("user_ent_1", { id: "user_ent_1", isPaid: false, paidUntil: null });

    const manifestEntNull = await PaymentFinalizationManifestService.planFinalization(
      {
        transactionId: "txn_ent_1",
        checkoutSessionId: "cs_ent_1",
        userId: "user_ent_1",
        planType: "1_MONTH", // 30 days
        purchaseAmountCentavos: 9900,
        feeKnowledge: "UNKNOWN",
        source: "WEBHOOK",
        verifiedAtIso: "2026-08-31T10:00:00.000Z",
      },
      mockReader
    );

    // Expected after: 2026-08-31 + 30 days = 2026-09-30T10:00:00.000Z
    const expectedAfterNull = new Date("2026-08-31T10:00:00.000Z");
    expectedAfterNull.setDate(expectedAfterNull.getDate() + 30);

    // B. Future active entitlement => base date is entitlementBefore
    mockReader.setupStandardContext("txn_ent_2", "user_ent_2", "cs_ent_2");
    mockReader.users.set("user_ent_2", {
      id: "user_ent_2",
      isPaid: true,
      paidUntil: "2026-10-15T10:00:00.000Z",
    });

    const manifestEntFuture = await PaymentFinalizationManifestService.planFinalization(
      {
        transactionId: "txn_ent_2",
        checkoutSessionId: "cs_ent_2",
        userId: "user_ent_2",
        planType: "1_YEAR", // 365 days
        purchaseAmountCentavos: 29900,
        feeKnowledge: "UNKNOWN",
        source: "WEBHOOK",
        verifiedAtIso: "2026-08-31T10:00:00.000Z",
      },
      mockReader
    );

    // Expected after: 2026-10-15 + 365 days = 2027-10-15T10:00:00.000Z
    const expectedAfterFuture = new Date("2026-10-15T10:00:00.000Z");
    expectedAfterFuture.setDate(expectedAfterFuture.getDate() + 365);

    assert(
      manifestEntNull.entitlementBefore === null &&
        manifestEntNull.entitlementAfter === expectedAfterNull.toISOString() &&
        manifestEntFuture.entitlementBefore === "2026-10-15T10:00:00.000Z" &&
        manifestEntFuture.entitlementAfter === expectedAfterFuture.toISOString(),
      "Test 11: Entitlement snapshot accurately computes 30/180/365 day extensions from verifiedAt or future paidUntil"
    );
  }

  // Test 12: Currency Authority (Strictly PHP-only)
  {
    const validCurrency = validateCurrency("PHP");
    const defaultCurrency = validateCurrency(undefined);

    let invalidCurrencyCaught = false;
    try {
      validateCurrency("USD");
    } catch (err) {
      if (err instanceof InvalidCurrencyError && err.code === "INVALID_CURRENCY") {
        invalidCurrencyCaught = true;
      }
    }

    assert(
      validCurrency === "PHP" && defaultCurrency === "PHP" && invalidCurrencyCaught,
      "Test 12: Currency authority strictly enforces PHP and rejects non-PHP currencies"
    );
  }

  // Test 13: Manifest Hash Sensitivity to All Root Snapshot Fields
  {
    mockReader.reset();
    mockReader.setupStandardContext("txn_hash_base", "user_hash_1", "cs_hash_base");

    const baseInput: FinalizationPlanningInput = {
      transactionId: "txn_hash_base",
      checkoutSessionId: "cs_hash_base",
      userId: "user_hash_1",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900,
      feeKnowledge: "KNOWN",
      feeAmountCentavos: 1500,
      feeObservedAtIso: "2026-08-31T10:05:00.000Z",
      providerPaymentId: "pay_123",
      providerPaidAtIso: "2026-08-31T09:59:00.000Z",
      source: "WEBHOOK",
      verifiedAtIso: testVerifiedAtStr,
    };

    const manifestBase = await PaymentFinalizationManifestService.planFinalization(baseInput, mockReader);

    // Modify feeObservedAt
    const manifestDiffFeeTime = await PaymentFinalizationManifestService.planFinalization(
      { ...baseInput, feeObservedAtIso: "2026-08-31T10:06:00.000Z" },
      mockReader
    );

    // Modify providerPaymentId
    const manifestDiffProviderId = await PaymentFinalizationManifestService.planFinalization(
      { ...baseInput, providerPaymentId: "pay_999" },
      mockReader
    );

    assert(
      manifestBase.manifestHash.length === 64 &&
        manifestBase.manifestHash !== manifestDiffFeeTime.manifestHash &&
        manifestBase.manifestHash !== manifestDiffProviderId.manifestHash,
      "Test 13: Manifest hash covers all complete root snapshot fields and is sensitive to changes"
    );
  }

  // Test 14: Canonical JSON Serializer Invariants (Rejection of Date, floats, non-plain objects)
  {
    let dateCaught = false;
    try {
      canonicalizeJson({ amountCentavos: 29900, timestamp: new Date() });
    } catch (err) {
      if (
        err instanceof PaymentFinalizationPlanningError &&
        err.message.includes("Date objects are not allowed in canonical serialization")
      ) {
        dateCaught = true;
      }
    }

    let floatCaught = false;
    try {
      canonicalizeJson({ rate: 12.5 });
    } catch (err) {
      if (err instanceof PaymentFinalizationPlanningError) floatCaught = true;
    }

    const objA = { z: 1, a: "hello", m: [3, 2, 1], b: { y: true, x: false } };
    const objB = { a: "hello", b: { x: false, y: true }, m: [3, 2, 1], z: 1 };
    const canonA = canonicalizeJson(objA);
    const canonB = canonicalizeJson(objB);

    assert(
      dateCaught && floatCaught && canonA === canonB,
      "Test 14: Canonical JSON serialization rejects Date/floats and guarantees recursive key sorting determinism"
    );
  }

  // Test 15: Tax Provision Planning with Active Tax Configurations
  {
    mockReader.reset();
    mockReader.setupStandardContext("txn_tax_test", "user_tax_1", "cs_tax_test");
    mockReader.taxConfigs = [
      {
        id: "vat_12",
        name: "VAT 12%",
        taxType: "VAT",
        rate: 12.0,
        fixedAmountCentavos: 0,
        calculationBasis: "CUSTOMER_PAYMENT",
        applicableTransactionType: "ALL",
      },
    ];

    const manifestTax = await PaymentFinalizationManifestService.planFinalization(
      {
        transactionId: "txn_tax_test",
        checkoutSessionId: "cs_tax_test",
        userId: "user_tax_1",
        planType: "1_YEAR",
        purchaseAmountCentavos: 29900,
        feeKnowledge: "UNKNOWN",
        source: "WEBHOOK",
        verifiedAtIso: testVerifiedAtStr,
      },
      mockReader
    );

    const taxEffect = manifestTax.effects.find((e) => e.effectType === "TAX_PROVISION")!;
    const taxIntent = taxEffect.intent as TaxProvisionIntent;

    assert(
      taxEffect.status === "PENDING" &&
        taxEffect.operationKey === "pfin:txn_tax_test:tax:vat_12" &&
        taxIntent.taxAmountCentavos === 3588 && // 29900 * 12% = 3588 centavos
        taxIntent.debitCategory === "EXPENSE_TAX" &&
        taxIntent.creditCategory === "LIABILITY_TAX_PAYABLE",
      "Test 15: Tax provision properly planned with canonical categories EXPENSE_TAX and LIABILITY_TAX_PAYABLE"
    );
  }

  // Test 16: Zero Active Taxes Results in Single NOT_APPLICABLE (NO_ACTIVE_TAX_RULES)
  {
    mockReader.reset();
    mockReader.setupStandardContext("txn_no_tax_test", "user_no_tax_1", "cs_no_tax_test");
    mockReader.taxConfigs = [];

    const manifestNoTax = await PaymentFinalizationManifestService.planFinalization(
      {
        transactionId: "txn_no_tax_test",
        checkoutSessionId: "cs_no_tax_test",
        userId: "user_no_tax_1",
        planType: "1_YEAR",
        purchaseAmountCentavos: 29900,
        feeKnowledge: "UNKNOWN",
        source: "WEBHOOK",
        verifiedAtIso: testVerifiedAtStr,
      },
      mockReader
    );

    const taxNoneEffect = manifestNoTax.effects.find((e) => e.effectType === "TAX_PROVISION")!;
    const taxNoneIntent = taxNoneEffect.intent as TaxProvisionIntent;

    assert(
      taxNoneEffect.status === "NOT_APPLICABLE" &&
        taxNoneEffect.effectKey === "tax:none" &&
        taxNoneEffect.operationKey === "pfin:txn_no_tax_test:tax:none" &&
        taxNoneIntent.notApplicableReason === "NO_ACTIVE_TAX_RULES" &&
        taxNoneIntent.taxConfigId === null &&
        taxNoneIntent.taxType === null &&
        taxNoneIntent.calculationBasis === null &&
        taxNoneIntent.taxAmountCentavos === 0,
      "Test 16: Zero active tax configs produces single NOT_APPLICABLE tax effect with closed reason NO_ACTIVE_TAX_RULES"
    );
  }

  // Slice 6A tax manifest contract-hardening regression groups A-O.
  {
    // A. Closed tax-type allowlist.
    mockReader.reset();
    mockReader.taxConfigs = [
      makeTaxConfig({ id: "tax_vat", taxType: "VAT" }),
      makeTaxConfig({ id: "tax_percentage", taxType: "PERCENTAGE_TAX" }),
      makeTaxConfig({ id: "tax_withholding", taxType: "WITHHOLDING_TAX" }),
      makeTaxConfig({ id: "tax_other", taxType: "OTHER_TAX" }),
    ];
    const approvedTypeEffects =
      await PaymentFinalizationManifestService.planTaxProvisionEffects(
        "txn_tax_types",
        10_000,
        undefined,
        new Date(testVerifiedAtStr),
        mockReader
      );
    assert(
      approvedTypeEffects.map((effect) => (effect.intent as TaxProvisionIntent).taxType).join(",") ===
        "VAT,PERCENTAGE_TAX,WITHHOLDING_TAX,OTHER_TAX",
      "Test 16A: All four closed payment-finalization v1 tax types are accepted"
    );

    mockReader.reset();
    assert(
      await taxPlanningFailsClosed(
        mockReader,
        makeRuntimeTaxConfig({ taxType: "CUSTOM_TAX" }),
        "PLANNING_ERROR"
      ),
      "Test 16B: Invalid runtime taxType fails closed"
    );

    // C. CUSTOMER_PAYMENT authority.
    mockReader.reset();
    mockReader.taxConfigs = [makeTaxConfig({ id: "tax_customer", rate: 10 })];
    const customerEffects =
      await PaymentFinalizationManifestService.planTaxProvisionEffects(
        "txn_tax_customer",
        210,
        999,
        new Date(testVerifiedAtStr),
        mockReader
      );
    const customerIntent = customerEffects[0].intent as TaxProvisionIntent;
    assert(
      customerIntent.calculationBasis === "CUSTOMER_PAYMENT" &&
        customerIntent.taxableAmountCentavos === 210 &&
        customerIntent.taxAmountCentavos === 21,
      "Test 16C: CUSTOMER_PAYMENT uses the immutable customer-payment amount"
    );

    // D. GROSS_SALE requires and uses authoritative gross.
    mockReader.reset();
    const grossConfig = makeTaxConfig({
      id: "tax_gross",
      calculationBasis: "GROSS_SALE",
      rate: 10,
    });
    mockReader.taxConfigs = [grossConfig];
    const grossEffects =
      await PaymentFinalizationManifestService.planTaxProvisionEffects(
        "txn_tax_gross",
        210,
        500,
        new Date(testVerifiedAtStr),
        mockReader
      );
    let missingGrossCaught = false;
    try {
      await PaymentFinalizationManifestService.planTaxProvisionEffects(
        "txn_tax_gross_missing",
        210,
        undefined,
        new Date(testVerifiedAtStr),
        mockReader
      );
    } catch (error) {
      missingGrossCaught = error instanceof MissingAuthoritativeGrossError;
    }
    const grossIntent = grossEffects[0].intent as TaxProvisionIntent;
    assert(
      grossIntent.calculationBasis === "GROSS_SALE" &&
        grossIntent.taxableAmountCentavos === 500 &&
        grossIntent.taxAmountCentavos === 50 &&
        missingGrossCaught,
      "Test 16D: GROSS_SALE uses authoritative gross and fails when gross is missing"
    );

    // E. Every currently unsupported Prisma tax basis fails independently.
    for (const unsupportedBasis of [
      "NET_REVENUE",
      "COMMISSION",
      "PAYOUT",
      "OTHER",
    ] as const) {
      mockReader.reset();
      assert(
        await taxPlanningFailsClosed(
          mockReader,
          makeTaxConfig({ calculationBasis: unsupportedBasis }),
          "PLANNING_ERROR"
        ),
        `Test 16E: ${unsupportedBasis} tax basis fails closed in manifest v1`
      );
    }

    // F-G. applicableTransactionType is exact and is never normalized.
    mockReader.reset();
    mockReader.taxConfigs = [
      makeTaxConfig({ id: "tax_all", applicableTransactionType: "ALL" }),
    ];
    const allEffects =
      await PaymentFinalizationManifestService.planTaxProvisionEffects(
        "txn_tax_all",
        210,
        undefined,
        new Date(testVerifiedAtStr),
        mockReader
      );
    assert(
      allEffects.length === 1 && allEffects[0].status === "PENDING",
      'Test 16F: applicableTransactionType exact "ALL" is accepted'
    );

    for (const invalidApplicableTransactionType of [
      null,
      "",
      " ALL ",
      "PAYMENT_RECEIVED",
      "TAX_PROVISION",
      "CUSTOM_EVENT",
    ] as const) {
      mockReader.reset();
      assert(
        await taxPlanningFailsClosed(
          mockReader,
          makeRuntimeTaxConfig({
            applicableTransactionType: invalidApplicableTransactionType,
          }),
          "PLANNING_ERROR"
        ),
        `Test 16G: applicableTransactionType ${JSON.stringify(invalidApplicableTransactionType)} fails closed`
      );
    }

    // H. Tax amount is calculated from canonical basis points, not the raw float.
    mockReader.reset();
    mockReader.taxConfigs = [
      makeTaxConfig({ id: "tax_canonical_rate", rate: 38.805 }),
    ];
    const canonicalRateEffects =
      await PaymentFinalizationManifestService.planTaxProvisionEffects(
        "txn_tax_canonical_rate",
        210,
        undefined,
        new Date(testVerifiedAtStr),
        mockReader
      );
    const canonicalRateIntent = canonicalRateEffects[0]
      .intent as TaxProvisionIntent;
    assert(
      canonicalRateIntent.taxRateBasisPoints === 3881 &&
        canonicalRateIntent.taxAmountCentavos === 82,
      "Test 16H: 38.805% canonicalizes to 3881 bps and 82 centavos on a 210-centavo base"
    );

    // I. Inclusive percentage-rate boundaries.
    for (const boundaryCase of [
      { rate: 0, expectedAmount: 0, expectedStatus: "NOT_APPLICABLE" },
      { rate: 100, expectedAmount: 210, expectedStatus: "PENDING" },
    ] as const) {
      mockReader.reset();
      mockReader.taxConfigs = [
        makeTaxConfig({ id: `tax_rate_${boundaryCase.rate}`, rate: boundaryCase.rate }),
      ];
      const boundaryEffects =
        await PaymentFinalizationManifestService.planTaxProvisionEffects(
          `txn_tax_rate_${boundaryCase.rate}`,
          210,
          undefined,
          new Date(testVerifiedAtStr),
          mockReader
        );
      const boundaryIntent = boundaryEffects[0].intent as TaxProvisionIntent;
      assert(
        boundaryIntent.taxAmountCentavos === boundaryCase.expectedAmount &&
          boundaryIntent.status === boundaryCase.expectedStatus,
        `Test 16I: Tax rate boundary ${boundaryCase.rate}% is accepted exactly`
      );
    }

    // J. Malformed percentage rates never fall back to fixed tax.
    for (const invalidRate of [-0.01, 100.01, Number.NaN, Infinity, -Infinity]) {
      mockReader.reset();
      assert(
        await taxPlanningFailsClosed(
          mockReader,
          makeTaxConfig({ rate: invalidRate, fixedAmountCentavos: 100 }),
          "INVALID_RATE"
        ),
        `Test 16J: Invalid tax rate ${String(invalidRate)} fails closed before fixed-tax fallback`
      );
    }

    // K. Fixed amounts are exact PostgreSQL INTEGER centavo values.
    mockReader.reset();
    mockReader.taxConfigs = [
      makeTaxConfig({ id: "tax_fixed_positive", rate: 0, fixedAmountCentavos: 123 }),
    ];
    const fixedPositiveEffects =
      await PaymentFinalizationManifestService.planTaxProvisionEffects(
        "txn_tax_fixed_positive",
        210,
        undefined,
        new Date(testVerifiedAtStr),
        mockReader
      );
    const fixedPositiveIntent = fixedPositiveEffects[0]
      .intent as TaxProvisionIntent;
    assert(
      fixedPositiveIntent.taxRateBasisPoints === null &&
        fixedPositiveIntent.taxAmountCentavos === 123 &&
        fixedPositiveIntent.status === "PENDING",
      "Test 16K: Positive fixed tax remains an exact centavo amount with null basis-point rate"
    );

    mockReader.reset();
    mockReader.taxConfigs = [
      makeTaxConfig({ id: "tax_fixed_zero", rate: 0, fixedAmountCentavos: 0 }),
    ];
    const fixedZeroEffects =
      await PaymentFinalizationManifestService.planTaxProvisionEffects(
        "txn_tax_fixed_zero",
        210,
        undefined,
        new Date(testVerifiedAtStr),
        mockReader
      );
    const fixedZeroIntent = fixedZeroEffects[0].intent as TaxProvisionIntent;
    assert(
      fixedZeroIntent.status === "NOT_APPLICABLE" &&
        fixedZeroIntent.notApplicableReason === "ZERO_TAX_CALCULATED" &&
        fixedZeroIntent.taxRateBasisPoints === null &&
        fixedZeroIntent.taxAmountCentavos === 0,
      "Test 16K: Zero fixed tax remains NOT_APPLICABLE"
    );

    for (const invalidFixedAmount of [
      null,
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      2_147_483_648,
    ]) {
      mockReader.reset();
      assert(
        await taxPlanningFailsClosed(
          mockReader,
          makeTaxConfig({ rate: 0, fixedAmountCentavos: invalidFixedAmount }),
          "INVALID_MONETARY_AMOUNT"
        ),
        `Test 16K: Invalid fixed tax ${String(invalidFixedAmount)} fails closed`
      );
    }

    // L. A positive canonical percentage remains authoritative over valid fixed tax.
    mockReader.reset();
    mockReader.taxConfigs = [
      makeTaxConfig({ id: "tax_percentage_first", rate: 10, fixedAmountCentavos: 999 }),
    ];
    const percentageFirstEffects =
      await PaymentFinalizationManifestService.planTaxProvisionEffects(
        "txn_tax_percentage_first",
        250,
        undefined,
        new Date(testVerifiedAtStr),
        mockReader
      );
    const percentageFirstIntent = percentageFirstEffects[0]
      .intent as TaxProvisionIntent;
    assert(
      percentageFirstIntent.taxRateBasisPoints === 1000 &&
        percentageFirstIntent.taxAmountCentavos === 25,
      "Test 16L: Positive canonical percentage takes precedence over valid fixed tax"
    );

    // M. A positive canonical rate may still round to a zero, not-applicable tax.
    mockReader.reset();
    mockReader.taxConfigs = [
      makeTaxConfig({ id: "tax_rounds_zero", rate: 0.01 }),
    ];
    const roundedZeroEffects =
      await PaymentFinalizationManifestService.planTaxProvisionEffects(
        "txn_tax_rounds_zero",
        1,
        undefined,
        new Date(testVerifiedAtStr),
        mockReader
      );
    const roundedZeroIntent = roundedZeroEffects[0].intent as TaxProvisionIntent;
    assert(
      roundedZeroIntent.taxRateBasisPoints === 1 &&
        roundedZeroIntent.taxAmountCentavos === 0 &&
        roundedZeroIntent.status === "NOT_APPLICABLE" &&
        roundedZeroIntent.notApplicableReason === "ZERO_TAX_CALCULATED",
      "Test 16M: Zero calculated tax remains NOT_APPLICABLE after canonical-rate rounding"
    );

    // N is covered by the strengthened canonical tax:none Test 16 above.

    // O. Repeated complete planning preserves intent and manifest hashes.
    mockReader.reset();
    mockReader.setupStandardContext(
      "txn_tax_repeat",
      "user_tax_repeat",
      "cs_tax_repeat"
    );
    mockReader.taxConfigs = [
      makeTaxConfig({ id: "tax_repeat", taxType: "WITHHOLDING_TAX", rate: 7.125 }),
    ];
    const repeatInput: FinalizationPlanningInput = {
      transactionId: "txn_tax_repeat",
      checkoutSessionId: "cs_tax_repeat",
      userId: "user_tax_repeat",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29_900,
      feeKnowledge: "UNKNOWN",
      source: "WEBHOOK",
      verifiedAtIso: testVerifiedAtStr,
    };
    const repeatedManifestA =
      await PaymentFinalizationManifestService.planFinalization(
        repeatInput,
        mockReader
      );
    const repeatedManifestB =
      await PaymentFinalizationManifestService.planFinalization(
        repeatInput,
        mockReader
      );
    const repeatedTaxA = repeatedManifestA.effects.find(
      (effect) => effect.effectType === "TAX_PROVISION"
    );
    const repeatedTaxB = repeatedManifestB.effects.find(
      (effect) => effect.effectType === "TAX_PROVISION"
    );
    assert(
      repeatedTaxA?.intentHash === repeatedTaxB?.intentHash &&
        repeatedManifestA.manifestHash === repeatedManifestB.manifestHash,
      "Test 16O: Repeated planning preserves tax intent hash and complete manifest hash"
    );

    // Strict tax config identifiers must already be canonical operation-key segments.
    const invalidTaxConfigIds = [
      "",
      "   ",
      " tax_id ",
      "tax:id",
      "tax/id",
      "x".repeat(129),
    ];
    let everyInvalidTaxConfigIdFailed = true;
    for (const invalidTaxConfigId of invalidTaxConfigIds) {
      mockReader.reset();
      everyInvalidTaxConfigIdFailed =
        everyInvalidTaxConfigIdFailed &&
        (await taxPlanningFailsClosed(
          mockReader,
          makeRuntimeTaxConfig({ id: invalidTaxConfigId })
        ));
    }
    assert(
      everyInvalidTaxConfigIdFailed,
      "Test 16P: Malformed or non-canonical tax configuration IDs fail closed"
    );
  }

  // Test 17: Architectural Invariants — Zero Prisma write methods in planner
  {
    const plannerFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/payment/paymentFinalizationManifestService.ts"),
      "utf-8"
    );

    const mutatingCalls = [
      ".create(",
      ".createMany(",
      ".update(",
      ".updateMany(",
      ".upsert(",
      ".delete(",
      ".deleteMany(",
      ".$executeRaw",
      ".$executeRawUnsafe",
    ];

    let mutatingCount = 0;
    for (const call of mutatingCalls) {
      if (plannerFile.includes(call)) {
        mutatingCount++;
      }
    }

    assert(
      mutatingCount === 0,
      "Test 17: PaymentFinalizationManifestService contains zero Prisma write methods (pure read-only)"
    );
  }

  // Test 18: Architectural Invariants — Zero `any` in Slice 2.1 contracts & service
  {
    const contractsFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/payment/paymentFinalizationContracts.ts"),
      "utf-8"
    );
    const plannerFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/payment/paymentFinalizationManifestService.ts"),
      "utf-8"
    );

    const cleanContracts = contractsFile
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
      .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""');
    const cleanPlanner = plannerFile
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
      .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""');

    const hasAnyInContracts = /:\s*any\b|<any>|\bas\s+any\b/.test(cleanContracts);
    const hasAnyInPlanner = /:\s*any\b|<any>|\bas\s+any\b/.test(cleanPlanner);

    assert(
      !hasAnyInContracts && !hasAnyInPlanner,
      "Test 18: Zero `any` types in paymentFinalizationContracts.ts and paymentFinalizationManifestService.ts"
    );
  }

  // Test 19: Architectural Invariants — Dormant engine topology
  {
    const appDir = path.join(process.cwd(), "src/app");
    const libDir = path.join(process.cwd(), "src/lib");
    const targetName = "PaymentFinalizationManifestService";
    const selfFiles = new Set([
      "paymentFinalizationContracts.ts",
      "paymentFinalizationManifestService.ts",
    ]);

    function findConsumers(dir: string): string[] {
      const results: string[] = [];
      if (!fs.existsSync(dir)) return results;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...findConsumers(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
          if (selfFiles.has(entry.name)) {
            continue;
          }
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes(targetName)) {
            const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, "/");
            results.push(relPath);
          }
        }
      }
      return results;
    }

    const appConsumers = findConsumers(appDir);
    const libConsumers = findConsumers(libDir);

    const approvedLibConsumers = [
      "src/lib/payment/paymentFinalizationIngestionService.ts",
    ];

    const sortedLib = [...libConsumers].sort((a, b) => a.localeCompare(b));
    const sortedApproved = [...approvedLibConsumers].sort((a, b) => a.localeCompare(b));

    const zeroAppCallers = appConsumers.length === 0;
    const exactLibTopology = JSON.stringify(sortedLib) === JSON.stringify(sortedApproved);

    let failureDetail: string | undefined;
    if (!zeroAppCallers) {
      failureDetail = `Unexpected src/app consumers: ${appConsumers.join(", ")}`;
    } else if (!exactLibTopology) {
      failureDetail = `Expected exact src/lib consumers [${sortedApproved.join(", ")}], found [${sortedLib.join(", ")}]`;
    }

    assert(
      zeroAppCallers && exactLibTopology,
      "Test 19: Planner remains production-route dormant with exactly one approved dormant library consumer",
      failureDetail
    );
  }

  console.log("\n================================================================================");
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log("================================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPaymentFinalizationRecoveryTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
