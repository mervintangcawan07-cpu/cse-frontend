// Relative Path: src/scripts/test-payment-finalization-recovery.ts
/**
 * Synthetic Test Suite: GovStudyX Durable Payment Finalization Recovery Engine (Phase 1 / Slice 2)
 *
 * STRICTLY STATIC / IN-MEMORY SYNTHETIC TESTS — ZERO LIVE DATABASE MUTATIONS OR PROVIDER CALLS.
 */

import fs from "fs";
import path from "path";
import {
  MANIFEST_VERSION,
  INTENT_VERSION,
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
  UserRecordForPlanning,
  ReferralAttributionForPlanning,
  PartnerAttributionForPlanning,
  TaxConfigForPlanning,
  PaymentFinalizationPlanningError,
  UnsupportedPlanTypeError,
  InvalidMonetaryAmountError,
  MissingAuthoritativeGrossError,
  InvalidOperationKeyError,
  DuplicateEffectKeyError,
  InvalidTimestampError,
  buildPaymentFinalizationOperationKey,
  validatePlanType,
  validateTransactionId,
  validateIsoUtcTimestamp,
  canonicalizeJson,
  computeSha256Hash,
  validateSafeCentavos,
  validateSafeRate,
  rateToBasisPoints,
} from "../lib/payment/paymentFinalizationContracts";
import {
  PaymentFinalizationManifestService,
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
  public users: Map<string, UserRecordForPlanning> = new Map();
  public referrals: Map<string, ReferralAttributionForPlanning> = new Map();
  public partners: Map<string, PartnerAttributionForPlanning> = new Map();
  public taxConfigs: TaxConfigForPlanning[] = [];

  public reset(): void {
    this.users.clear();
    this.referrals.clear();
    this.partners.clear();
    this.taxConfigs = [];
  }

  async findUser(userId: string): Promise<UserRecordForPlanning | null> {
    return this.users.get(userId) ?? null;
  }

  async findReferralAttribution(userId: string): Promise<ReferralAttributionForPlanning | null> {
    return this.referrals.get(userId) ?? null;
  }

  async findPartnerAttribution(
    userId: string,
    _partnerCode?: string | null
  ): Promise<PartnerAttributionForPlanning | null> {
    return this.partners.get(userId) ?? null;
  }

  async findActiveTaxConfigs(_referenceDate: Date): Promise<TaxConfigForPlanning[]> {
    return [...this.taxConfigs];
  }
}

async function runPaymentFinalizationRecoveryTests(): Promise<void> {
  console.log("================================================================================");
  console.log("🧪 RUNNING SYNTHETIC SUITE: PAYMENT FINALIZATION RECOVERY (SLICE 2)");
  console.log("================================================================================\n");

  const mockReader = new MockFinalizationDataReader();
  const testRefDateStr = "2026-08-31T10:00:00.000Z";
  const testRefDate = new Date(testRefDateStr);
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
    // A. transactionId containing ":" is rejected
    let colonTxCaught = false;
    try {
      buildPaymentFinalizationOperationKey("acct:tax", { kind: "TAX", taxConfigId: "vat" });
    } catch (err) {
      if (err instanceof InvalidOperationKeyError && err.message.includes("colon delimiter forbidden")) {
        colonTxCaught = true;
      }
    }

    // B. taxConfigId containing ":" is rejected
    let colonTaxIdCaught = false;
    try {
      buildPaymentFinalizationOperationKey("acct", { kind: "TAX", taxConfigId: "tax:vat" });
    } catch (err) {
      if (err instanceof InvalidOperationKeyError && err.message.includes("colon delimiter forbidden")) {
        colonTaxIdCaught = true;
      }
    }

    // C. Valid clean inputs succeed without ambiguity
    const validKeyA = buildPaymentFinalizationOperationKey("acct_tax", { kind: "TAX", taxConfigId: "vat" });
    const validKeyB = buildPaymentFinalizationOperationKey("acct", { kind: "TAX", taxConfigId: "tax_vat" });

    assert(
      colonTxCaught && colonTaxIdCaught && validKeyA !== validKeyB,
      "Test 2: Colons inside transactionId and taxConfigId are strictly rejected, preventing segment boundary collisions"
    );
  }

  // Test 3: Plan type validation — all supported plans succeed; unsupported plans fail closed
  {
    mockReader.reset();
    for (const plan of SUPPORTED_PLAN_TYPES) {
      const validated = validatePlanType(plan);
      assert(validated === plan, `Test 3A: Supported plan "${plan}" passes validation`);
    }

    let unsupportedPlanCaught = false;
    try {
      const inputUnsupported: FinalizationPlanningInput = {
        transactionId: "txn_unsupported",
        checkoutSessionId: "cs_unsupported",
        userId: "user_1",
        planType: "LIFETIME_ACCESS", // Unsupported
        purchaseAmountCentavos: 29900,
        feeKnowledge: "KNOWN",
        source: "WEBHOOK",
        referenceDate: testRefDateStr,
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

  // Test 4: Operation key independence from checkoutSessionId & dependence on transactionId
  {
    mockReader.reset();
    mockReader.taxConfigs = [
      {
        id: "vat_12",
        name: "VAT 12%",
        taxType: "VAT",
        rate: 12.0,
        fixedAmountCentavos: 0,
        calculationBasis: "CUSTOMER_PAYMENT",
      },
    ];

    const inputSessionA: FinalizationPlanningInput = {
      transactionId: "txn_same_id",
      checkoutSessionId: "cs_alpha_111",
      userId: "user_1",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900,
      feeKnowledge: "KNOWN",
      feeAmountCentavos: 1500,
      source: "WEBHOOK",
      referenceDate: testRefDateStr,
    };

    const inputSessionB: FinalizationPlanningInput = {
      ...inputSessionA,
      checkoutSessionId: "cs_beta_999", // Different checkout session
    };

    const inputDifferentTx: FinalizationPlanningInput = {
      ...inputSessionA,
      transactionId: "txn_different_id", // Different transaction
    };

    const manifestA = await PaymentFinalizationManifestService.planFinalization(inputSessionA, mockReader);
    const manifestB = await PaymentFinalizationManifestService.planFinalization(inputSessionB, mockReader);
    const manifestDiffTx = await PaymentFinalizationManifestService.planFinalization(inputDifferentTx, mockReader);

    const opKeysA = manifestA.effects.map((e) => e.operationKey);
    const opKeysB = manifestB.effects.map((e) => e.operationKey);
    const opKeysDiff = manifestDiffTx.effects.map((e) => e.operationKey);

    const sameKeysAcrossDifferentSessions = opKeysA.every((key, idx) => key === opKeysB[idx]);
    const differentKeysForDifferentTx = opKeysA.every((key, idx) => key !== opKeysDiff[idx]);

    assert(
      sameKeysAcrossDifferentSessions && differentKeysForDifferentTx,
      "Test 4: Changing checkoutSessionId preserves operation keys; changing transactionId changes operation keys"
    );
  }

  // Test 5: Strict ISO-8601 UTC timestamp validation & rollover protection
  {
    // A. Valid UTC ISO timestamp accepted
    const validIso1 = validateIsoUtcTimestamp("2026-08-31T10:00:00.000Z", "testDate");
    const validIso2 = validateIsoUtcTimestamp("2026-08-31T10:00:00Z", "testDate");

    // B. Malformed timestamp string rejected
    let malformedCaught = false;
    try {
      validateIsoUtcTimestamp("2026-08-31 10:00:00", "testDate");
    } catch (err) {
      if (err instanceof InvalidTimestampError) malformedCaught = true;
    }

    // C. Non-UTC / offset timestamp rejected
    let offsetCaught = false;
    try {
      validateIsoUtcTimestamp("2026-08-31T10:00:00+08:00", "testDate");
    } catch (err) {
      if (err instanceof InvalidTimestampError) offsetCaught = true;
    }

    // D. Impossible date / JavaScript date rollover rejected (e.g. Feb 30)
    let rolloverCaught = false;
    try {
      validateIsoUtcTimestamp("2026-02-30T10:00:00.000Z", "testDate");
    } catch (err) {
      if (err instanceof InvalidTimestampError) rolloverCaught = true;
    }

    // E. Impossible date (April 31) rejected
    let aprilRolloverCaught = false;
    try {
      validateIsoUtcTimestamp("2026-04-31T10:00:00.000Z", "testDate");
    } catch (err) {
      if (err instanceof InvalidTimestampError) aprilRolloverCaught = true;
    }

    assert(
      validIso1 === "2026-08-31T10:00:00.000Z" &&
        validIso2 === "2026-08-31T10:00:00.000Z" &&
        malformedCaught &&
        offsetCaught &&
        rolloverCaught &&
        aprilRolloverCaught,
      "Test 5: Strict ISO-8601 UTC timestamp validation accepts valid UTC strings and fails closed on malformed and rolled dates"
    );
  }

  // Test 6: Canonical JSON serialization explicitly REJECTS Date objects
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

    const validIsoString = "2026-08-31T10:00:00.000Z";
    const canonIso = canonicalizeJson({ amountCentavos: 29900, timestamp: validIsoString });

    assert(
      dateCaught && canonIso === '{"amountCentavos":29900,"timestamp":"2026-08-31T10:00:00.000Z"}',
      "Test 6: Canonical serializer explicitly rejects Date objects and accepts validated UTC ISO strings"
    );
  }

  // Test 7: Canonical serializer rejects floats, non-plain objects, and invalid types
  {
    let floatCaught = false;
    try {
      canonicalizeJson({ rate: 12.5 });
    } catch (err) {
      if (err instanceof PaymentFinalizationPlanningError) floatCaught = true;
    }

    let mapCaught = false;
    try {
      canonicalizeJson({ mapping: new Map() });
    } catch (err) {
      if (err instanceof PaymentFinalizationPlanningError) mapCaught = true;
    }

    let nanCaught = false;
    try {
      canonicalizeJson({ bad: NaN });
    } catch (err) {
      if (err instanceof PaymentFinalizationPlanningError) nanCaught = true;
    }

    let infinityCaught = false;
    try {
      canonicalizeJson({ bad: Infinity });
    } catch (err) {
      if (err instanceof PaymentFinalizationPlanningError) infinityCaught = true;
    }

    let funcCaught = false;
    try {
      canonicalizeJson({ bad: () => 1 });
    } catch (err) {
      if (err instanceof PaymentFinalizationPlanningError) funcCaught = true;
    }

    assert(
      floatCaught && mapCaught && nanCaught && infinityCaught && funcCaught,
      "Test 7: Canonical serializer rejects floats/fractions, non-plain objects, NaN, Infinity, and functions"
    );
  }

  // Test 8: Canonical JSON serialization determinism and key sorting
  {
    const objA = { z: 1, a: "hello", m: [3, 2, 1], b: { y: true, x: false } };
    const objB = { a: "hello", b: { x: false, y: true }, m: [3, 2, 1], z: 1 };

    const canonA = canonicalizeJson(objA);
    const canonB = canonicalizeJson(objB);

    assert(
      canonA === canonB && canonA === '{"a":"hello","b":{"x":false,"y":true},"m":[3,2,1],"z":1}',
      "Test 8: Canonical serialization is recursively sorted and deterministic regardless of key insertion order"
    );
  }

  // Test 9: Cryptographic SHA-256 intent hash determinism & sensitivity
  {
    const canon = canonicalizeJson({ amountCentavos: 29900, planType: "1_YEAR" });
    const hash1 = computeSha256Hash(canon);
    const hash2 = computeSha256Hash(canon);

    const canonModified = canonicalizeJson({ amountCentavos: 29901, planType: "1_YEAR" });
    const hashModified = computeSha256Hash(canonModified);

    assert(
      hash1.length === 64 && hash1 === hash2 && hash1 !== hashModified,
      "Test 9: SHA-256 hash is deterministic and sensitive to 1-centavo financial intent changes"
    );
  }

  // Test 10: Safe integer centavos and rate validation
  {
    const validCentavos = validateSafeCentavos(29900, "testAmount", false);
    const validZero = validateSafeCentavos(0, "testZero", true);

    let fractionalCaught = false;
    try {
      validateSafeCentavos(299.5, "testFractional", false);
    } catch (err) {
      if (err instanceof InvalidMonetaryAmountError) fractionalCaught = true;
    }

    let negativeCaught = false;
    try {
      validateSafeCentavos(-100, "testNegative", false);
    } catch (err) {
      if (err instanceof InvalidMonetaryAmountError) negativeCaught = true;
    }

    const validBps = rateToBasisPoints(20.5);
    const validRate = validateSafeRate(20.5, "testRate");

    assert(
      validCentavos === 29900 &&
        validZero === 0 &&
        fractionalCaught &&
        negativeCaught &&
        validBps === 2050 &&
        validRate === 20.5,
      "Test 10: Integer centavos strictly enforced (rejects fractional, negative, non-safe integers)"
    );
  }

  // Test 11: Provider fee planning — UNKNOWN fee produces AWAITING_DATA
  {
    const input: FinalizationPlanningInput = {
      transactionId: "txn_fee_unknown",
      checkoutSessionId: "cs_fee_unknown",
      userId: "user_1",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900,
      feeKnowledge: "UNKNOWN",
      source: "WEBHOOK",
      referenceDate: testRefDateStr,
    };

    const effect = PaymentFinalizationManifestService.planProviderFeeLedgerEffect(input);
    const intent = effect.intent as ProviderFeeLedgerIntent;

    assert(
      effect.status === "AWAITING_DATA" &&
        effect.operationKey === "pfin:txn_fee_unknown:fee" &&
        intent.effectType === "PROVIDER_FEE_LEDGER" &&
        intent.feeKnowledge === "UNKNOWN" &&
        intent.feeAmountCentavos === null &&
        intent.debitCategory === null,
      "Test 11: UNKNOWN provider fee creates AWAITING_DATA effect with operation key pfin:<txId>:fee"
    );
  }

  // Test 12: Provider fee planning — KNOWN zero fee produces NOT_APPLICABLE (ZERO_PROVIDER_FEE)
  {
    const input: FinalizationPlanningInput = {
      transactionId: "txn_fee_zero",
      checkoutSessionId: "cs_fee_zero",
      userId: "user_1",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900,
      feeKnowledge: "KNOWN",
      feeAmountCentavos: 0,
      source: "VERIFY_POLL",
      referenceDate: testRefDateStr,
    };

    const effect = PaymentFinalizationManifestService.planProviderFeeLedgerEffect(input);
    const intent = effect.intent as ProviderFeeLedgerIntent;

    assert(
      effect.status === "NOT_APPLICABLE" &&
        effect.operationKey === "pfin:txn_fee_zero:fee" &&
        intent.effectType === "PROVIDER_FEE_LEDGER" &&
        intent.feeKnowledge === "KNOWN" &&
        intent.feeAmountCentavos === 0 &&
        intent.notApplicableReason === "ZERO_PROVIDER_FEE",
      "Test 12: KNOWN zero provider fee creates NOT_APPLICABLE effect with ZERO_PROVIDER_FEE reason"
    );
  }

  // Test 13: Provider fee planning — KNOWN positive fee produces PENDING with double-entry categories
  {
    const input: FinalizationPlanningInput = {
      transactionId: "txn_fee_positive",
      checkoutSessionId: "cs_fee_positive",
      userId: "user_1",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900,
      feeKnowledge: "KNOWN",
      feeAmountCentavos: 1500,
      source: "WEBHOOK",
      referenceDate: testRefDateStr,
    };

    const effect = PaymentFinalizationManifestService.planProviderFeeLedgerEffect(input);
    const intent = effect.intent as ProviderFeeLedgerIntent;

    assert(
      effect.status === "PENDING" &&
        effect.operationKey === "pfin:txn_fee_positive:fee" &&
        intent.effectType === "PROVIDER_FEE_LEDGER" &&
        intent.feeAmountCentavos === 1500 &&
        intent.debitCategory === "EXPENSE_PAYMENT_GATEWAY" &&
        intent.creditCategory === "CASH_PAYMONGO",
      "Test 13: KNOWN positive provider fee creates PENDING effect with EXPENSE_PAYMENT_GATEWAY debit"
    );
  }

  // Test 14: Referral reward planning — Percentage reward with exact millisecond holding semantics
  {
    mockReader.reset();
    mockReader.referrals.set("user_ref_pct", {
      referralId: "ref_100",
      inviterId: "inviter_100",
      alreadyRewarded: false,
      programEnabled: true,
      rewardType: "PERCENTAGE",
      rewardPercentage: 20.0,
      fixedRewardAmountCentavos: 0,
      holdingPeriodDays: 7,
    });

    const input: FinalizationPlanningInput = {
      transactionId: "txn_ref_pct",
      checkoutSessionId: "cs_ref_pct",
      userId: "user_ref_pct",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900, // ₱299
      feeKnowledge: "KNOWN",
      feeAmountCentavos: 0,
      source: "WEBHOOK",
      referenceDate: testRefDateStr,
    };

    const effect = await PaymentFinalizationManifestService.planReferralRewardEffect(input, mockReader);
    const intent = effect.intent as ReferralRewardIntent;

    // Expected: 29900 * 20% = 5980 centavos (₱59.80)
    // Expected holding: testRefDate + 7 * 86400000 ms
    const expectedHolding = new Date(testRefDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    assert(
      effect.status === "PENDING" &&
        effect.operationKey === "pfin:txn_ref_pct:referral" &&
        intent.effectType === "REFERRAL_REWARD" &&
        intent.rewardAmountCentavos === 5980 &&
        intent.rewardRateBasisPoints === 2000 &&
        intent.holdingUntil === expectedHolding &&
        intent.inviterId === "inviter_100",
      "Test 14: Percentage referral calculates 20% reward (5,980 centavos) with operation key pfin:<txId>:referral"
    );
  }

  // Test 15: Referral reward planning — Fixed reward
  {
    mockReader.reset();
    mockReader.referrals.set("user_ref_fix", {
      referralId: "ref_101",
      inviterId: "inviter_101",
      alreadyRewarded: false,
      programEnabled: true,
      rewardType: "FIXED",
      rewardPercentage: 0,
      fixedRewardAmountCentavos: 5000, // ₱50
      holdingPeriodDays: 7,
    });

    const input: FinalizationPlanningInput = {
      transactionId: "txn_ref_fix",
      checkoutSessionId: "cs_ref_fix",
      userId: "user_ref_fix",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900,
      feeKnowledge: "KNOWN",
      source: "WEBHOOK",
      referenceDate: testRefDateStr,
    };

    const effect = await PaymentFinalizationManifestService.planReferralRewardEffect(input, mockReader);
    const intent = effect.intent as ReferralRewardIntent;

    assert(
      effect.status === "PENDING" &&
        effect.operationKey === "pfin:txn_ref_fix:referral" &&
        intent.effectType === "REFERRAL_REWARD" &&
        intent.rewardAmountCentavos === 5000 &&
        intent.rewardType === "FIXED",
      "Test 15: Fixed referral reward plans exact fixed amount (5,000 centavos)"
    );
  }

  // Test 16: Referral reward NOT_APPLICABLE cases (Exact closed reasons: no attribution, disabled)
  {
    mockReader.reset();

    // A. No attribution
    const inputNoAttr: FinalizationPlanningInput = {
      transactionId: "txn_ref_none",
      checkoutSessionId: "cs_ref_none",
      userId: "user_no_ref",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900,
      feeKnowledge: "KNOWN",
      source: "WEBHOOK",
      referenceDate: testRefDateStr,
    };
    const effectNoAttr = await PaymentFinalizationManifestService.planReferralRewardEffect(inputNoAttr, mockReader);

    // B. Disabled program
    mockReader.referrals.set("user_ref_disabled", {
      referralId: "ref_102",
      inviterId: "inviter_102",
      alreadyRewarded: false,
      programEnabled: false,
      rewardType: "PERCENTAGE",
      rewardPercentage: 20.0,
      fixedRewardAmountCentavos: 0,
      holdingPeriodDays: 7,
    });
    const effectDisabled = await PaymentFinalizationManifestService.planReferralRewardEffect(
      { ...inputNoAttr, transactionId: "txn_ref_disabled", userId: "user_ref_disabled" },
      mockReader
    );

    const intentNoAttr = effectNoAttr.intent as ReferralRewardIntent;
    const intentDisabled = effectDisabled.intent as ReferralRewardIntent;

    assert(
      effectNoAttr.status === "NOT_APPLICABLE" &&
        intentNoAttr.notApplicableReason === "NO_REFERRAL_ATTRIBUTION" &&
        effectDisabled.status === "NOT_APPLICABLE" &&
        intentDisabled.notApplicableReason === "PROGRAM_DISABLED",
      "Test 16: Referral NOT_APPLICABLE preserves exact closed reasons (NO_REFERRAL_ATTRIBUTION, PROGRAM_DISABLED)"
    );
  }

  // Test 17: Partner commission planning — Customer payment basis with calendar-day holding
  {
    mockReader.reset();
    mockReader.partners.set("user_part_pct", {
      partnerId: "part_001",
      partnerCode: "PARTNER10",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRate: 15.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 7,
      defaultCampaignSource: "youtube",
      alreadyCommissioned: false,
    });

    const input: FinalizationPlanningInput = {
      transactionId: "txn_part_pct",
      checkoutSessionId: "cs_part_pct",
      userId: "user_part_pct",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900,
      feeKnowledge: "KNOWN",
      campaignSource: "facebook",
      source: "WEBHOOK",
      referenceDate: testRefDateStr,
    };

    const effects = await PaymentFinalizationManifestService.planPartnerCommissionEffects(input, mockReader);
    const commIntent = effects[0].intent as PartnerCommissionIntent;
    const liabIntent = effects[1].intent as PartnerLiabilityLedgerIntent;

    // Expected commission: 29900 * 15% = 4485 centavos
    // Expected partner holding: testRefDate + 7 calendar days
    const expectedPartnerHolding = new Date(testRefDate);
    expectedPartnerHolding.setDate(expectedPartnerHolding.getDate() + 7);

    assert(
      effects.length === 2 &&
        effects[0].status === "PENDING" &&
        effects[0].operationKey === "pfin:txn_part_pct:partner-commission" &&
        commIntent.effectType === "PARTNER_COMMISSION" &&
        commIntent.commissionAmountCentavos === 4485 &&
        commIntent.calculationBasis === "CUSTOMER_PAYMENT" &&
        commIntent.campaignSource === "facebook" &&
        commIntent.holdingUntil === expectedPartnerHolding.toISOString() &&
        effects[1].status === "PENDING" &&
        effects[1].operationKey === "pfin:txn_part_pct:partner-liability" &&
        liabIntent.effectType === "PARTNER_LIABILITY_LEDGER" &&
        liabIntent.amountCentavos === 4485 &&
        liabIntent.notApplicableReason === undefined &&
        liabIntent.debitCategory === "EXPENSE_PARTNER_COMMISSION" &&
        liabIntent.creditCategory === "LIABILITY_PARTNER_PAYABLE",
      "Test 17: Partner commission (15% = 4,485 centavos) and liability ledger paired with exact operation keys"
    );
  }

  // Test 18: Partner commission planning — Authoritative gross basis calculation
  {
    mockReader.reset();
    mockReader.partners.set("user_part_gross", {
      partnerId: "part_002",
      partnerCode: "PARTNER_GROSS",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_GROSS",
      commissionRate: 10.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
      alreadyCommissioned: false,
    });

    const inputWithGross: FinalizationPlanningInput = {
      transactionId: "txn_part_gross",
      checkoutSessionId: "cs_part_gross",
      userId: "user_part_gross",
      planType: "1_YEAR",
      purchaseAmountCentavos: 24900, // discounted customer payment (₱249)
      authoritativeGrossAmountCentavos: 29900, // authoritative pre-discount list price (₱299)
      feeKnowledge: "KNOWN",
      source: "WEBHOOK",
      referenceDate: testRefDateStr,
    };

    const effects = await PaymentFinalizationManifestService.planPartnerCommissionEffects(inputWithGross, mockReader);
    const commIntent = effects[0].intent as PartnerCommissionIntent;

    // Expected: 10% of gross 29900 = 2990 centavos
    assert(
      commIntent.effectType === "PARTNER_COMMISSION" &&
        commIntent.commissionAmountCentavos === 2990 &&
        commIntent.calculationBasis === "GROSS_PRICE" &&
        commIntent.baseAmountCentavos === 29900,
      "Test 18: PERCENTAGE_OF_GROSS computes commission from explicit authoritativeGrossAmountCentavos"
    );
  }

  // Test 19: Gross basis fail-closed when authoritative gross is missing
  {
    mockReader.reset();
    mockReader.partners.set("user_part_gross_missing", {
      partnerId: "part_003",
      partnerCode: "PARTNER_FAIL",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_GROSS",
      commissionRate: 10.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
      alreadyCommissioned: false,
    });

    const inputWithoutGross: FinalizationPlanningInput = {
      transactionId: "txn_part_no_gross",
      checkoutSessionId: "cs_part_no_gross",
      userId: "user_part_gross_missing",
      planType: "1_YEAR",
      purchaseAmountCentavos: 24900,
      feeKnowledge: "KNOWN",
      source: "WEBHOOK",
      referenceDate: testRefDateStr,
    };

    let grossErrorCaught = false;
    try {
      await PaymentFinalizationManifestService.planPartnerCommissionEffects(inputWithoutGross, mockReader);
    } catch (err) {
      if (err instanceof MissingAuthoritativeGrossError) grossErrorCaught = true;
    }

    assert(
      grossErrorCaught,
      "Test 19: PERCENTAGE_OF_GROSS fails closed with MissingAuthoritativeGrossError when gross authority is absent"
    );
  }

  // Test 20: Partner NOT_APPLICABLE cases (Exact closed reasons: NO_PARTNER_ATTRIBUTION, INACTIVE_PARTNER)
  {
    mockReader.reset();

    // A. No partner attribution
    const inputNoPartner: FinalizationPlanningInput = {
      transactionId: "txn_part_none",
      checkoutSessionId: "cs_part_none",
      userId: "user_no_partner",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900,
      feeKnowledge: "KNOWN",
      source: "WEBHOOK",
      referenceDate: testRefDateStr,
    };
    const effectsNoPartner = await PaymentFinalizationManifestService.planPartnerCommissionEffects(
      inputNoPartner,
      mockReader
    );

    // B. Inactive partner
    mockReader.partners.set("user_part_inactive", {
      partnerId: "part_inactive",
      partnerCode: "INACTIVE",
      status: "INACTIVE",
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRate: 10.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
      alreadyCommissioned: false,
    });
    const effectsInactive = await PaymentFinalizationManifestService.planPartnerCommissionEffects(
      { ...inputNoPartner, transactionId: "txn_part_inactive", userId: "user_part_inactive" },
      mockReader
    );

    const intentNoPartner = effectsNoPartner[0].intent as PartnerCommissionIntent;
    const intentInactive = effectsInactive[0].intent as PartnerCommissionIntent;

    assert(
      effectsNoPartner[0].status === "NOT_APPLICABLE" &&
        intentNoPartner.notApplicableReason === "NO_PARTNER_ATTRIBUTION" &&
        effectsNoPartner[1].status === "NOT_APPLICABLE" &&
        effectsInactive[0].status === "NOT_APPLICABLE" &&
        intentInactive.notApplicableReason === "INACTIVE_PARTNER" &&
        effectsInactive[1].status === "NOT_APPLICABLE",
      "Test 20: Inactive or missing partner attribution sets closed NOT_APPLICABLE reasons"
    );
  }

  // Test 21: Tax provision planning — multiple active tax configs and GROSS_SALE authority
  {
    mockReader.reset();
    mockReader.taxConfigs = [
      {
        id: "vat_12",
        name: "VAT 12%",
        taxType: "VAT",
        rate: 12.0,
        fixedAmountCentavos: 0,
        calculationBasis: "CUSTOMER_PAYMENT",
      },
      {
        id: "gross_1",
        name: "Gross Receipt Tax 1%",
        taxType: "WITHHOLDING",
        rate: 1.0,
        fixedAmountCentavos: 0,
        calculationBasis: "GROSS_SALE",
      },
    ];

    const inputTax: FinalizationPlanningInput = {
      transactionId: "txn_tax_multi",
      checkoutSessionId: "cs_tax_multi",
      userId: "user_tax",
      planType: "1_YEAR",
      purchaseAmountCentavos: 25000, // ₱250
      authoritativeGrossAmountCentavos: 30000, // ₱300
      feeKnowledge: "KNOWN",
      source: "WEBHOOK",
      referenceDate: testRefDateStr,
    };

    const effects = await PaymentFinalizationManifestService.planTaxProvisionEffects(inputTax, mockReader);
    const taxIntent0 = effects[0].intent as TaxProvisionIntent;
    const taxIntent1 = effects[1].intent as TaxProvisionIntent;

    // VAT 12% on 25000 = 3000 centavos
    // Gross Tax 1% on 30000 = 300 centavos
    assert(
      effects.length === 2 &&
        effects[0].status === "PENDING" &&
        effects[0].operationKey === "pfin:txn_tax_multi:tax:vat_12" &&
        taxIntent0.effectType === "TAX_PROVISION" &&
        taxIntent0.taxAmountCentavos === 3000 &&
        taxIntent0.taxRateBasisPoints === 1200 &&
        taxIntent0.debitCategory === "EXPENSE_TAX" &&
        effects[1].status === "PENDING" &&
        effects[1].operationKey === "pfin:txn_tax_multi:tax:gross_1" &&
        taxIntent1.taxAmountCentavos === 300 &&
        taxIntent1.calculationBasis === "GROSS_SALE",
      "Test 21: Multiple tax provisions planned with exact operation keys pfin:<txId>:tax:<taxConfigId>"
    );
  }

  // Test 22: Zero active taxes result in single NOT_APPLICABLE tax effect with closed reason NO_ACTIVE_TAX_RULES
  {
    mockReader.reset();
    mockReader.taxConfigs = [];

    const inputNoTax: FinalizationPlanningInput = {
      transactionId: "txn_no_tax",
      checkoutSessionId: "cs_no_tax",
      userId: "user_1",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900,
      feeKnowledge: "KNOWN",
      source: "WEBHOOK",
      referenceDate: testRefDateStr,
    };

    const effects = await PaymentFinalizationManifestService.planTaxProvisionEffects(inputNoTax, mockReader);
    const taxNoneIntent = effects[0].intent as TaxProvisionIntent;

    assert(
      effects.length === 1 &&
        effects[0].effectKey === "tax:none" &&
        effects[0].operationKey === "pfin:txn_no_tax:tax:none" &&
        effects[0].status === "NOT_APPLICABLE" &&
        taxNoneIntent.notApplicableReason === "NO_ACTIVE_TAX_RULES" &&
        taxNoneIntent.taxAmountCentavos === 0,
      "Test 22: Absence of active tax configs produces single NOT_APPLICABLE tax effect with closed reason NO_ACTIVE_TAX_RULES"
    );
  }

  // Test 23: Full Manifest Planning, Hash Determinism & Key Uniqueness
  {
    mockReader.reset();
    mockReader.referrals.set("user_full", {
      referralId: "ref_full_1",
      inviterId: "inviter_full_1",
      alreadyRewarded: false,
      programEnabled: true,
      rewardType: "PERCENTAGE",
      rewardPercentage: 20.0,
      fixedRewardAmountCentavos: 0,
      holdingPeriodDays: 7,
    });
    mockReader.partners.set("user_full", {
      partnerId: "part_full_1",
      partnerCode: "PARTNER_FULL",
      status: "ACTIVE",
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRate: 10.0,
      fixedCommissionCentavos: 0,
      holdingPeriodDays: 7,
      defaultCampaignSource: null,
      alreadyCommissioned: false,
    });

    const fullInput: FinalizationPlanningInput = {
      transactionId: "txn_full_001",
      checkoutSessionId: "cs_full_test_001",
      userId: "user_full",
      planType: "1_YEAR",
      purchaseAmountCentavos: 29900,
      feeKnowledge: "KNOWN",
      feeAmountCentavos: 1500,
      source: "WEBHOOK",
      referenceDate: testRefDateStr,
    };

    const manifest1 = await PaymentFinalizationManifestService.planFinalization(fullInput, mockReader);
    const manifest2 = await PaymentFinalizationManifestService.planFinalization(fullInput, mockReader);

    // Verify all effect types present
    const effectTypes = manifest1.effects.map((e) => e.effectType);
    const hasPaymentLedger = effectTypes.includes("PAYMENT_LEDGER");
    const hasProviderFee = effectTypes.includes("PROVIDER_FEE_LEDGER");
    const hasReferral = effectTypes.includes("REFERRAL_REWARD");
    const hasPartner = effectTypes.includes("PARTNER_COMMISSION");
    const hasPartnerLiab = effectTypes.includes("PARTNER_LIABILITY_LEDGER");
    const hasTax = effectTypes.includes("TAX_PROVISION");
    const hasReconciliation = effectTypes.includes("RECONCILIATION");

    // Verify operation keys uniqueness
    const opKeys = manifest1.effects.map((e) => e.operationKey);
    const isOpKeysUnique = new Set(opKeys).size === opKeys.length;

    assert(
      manifest1.manifestVersion === MANIFEST_VERSION &&
        manifest1.transactionId === "txn_full_001" &&
        manifest1.planType === "1_YEAR" &&
        manifest1.manifestHash.length === 64 &&
        manifest1.manifestHash === manifest2.manifestHash &&
        hasPaymentLedger &&
        hasProviderFee &&
        hasReferral &&
        hasPartner &&
        hasPartnerLiab &&
        hasTax &&
        hasReconciliation &&
        isOpKeysUnique,
      "Test 23: Full Manifest plans all 7 financial effect types deterministically with unique pfin operation keys"
    );
  }

  // Test 24: Architectural Invariants — Zero Prisma writes in planner
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
      "Test 24: PaymentFinalizationManifestService contains zero Prisma write methods (pure read-only)"
    );
  }

  // Test 25: Architectural Invariants — Zero `any` in new production files
  {
    const contractsFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/payment/paymentFinalizationContracts.ts"),
      "utf-8"
    );
    const plannerFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/payment/paymentFinalizationManifestService.ts"),
      "utf-8"
    );

    // Strip comments and strings before checking for type any
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
      "Test 25: Zero `any` types in paymentFinalizationContracts.ts and paymentFinalizationManifestService.ts"
    );
  }

  // Test 26: Architectural Invariants — Dormant engine (zero production callers import planner)
  {
    const appDir = path.join(process.cwd(), "src/app");
    const libDir = path.join(process.cwd(), "src/lib");

    function searchForImport(dir: string, targetName: string): boolean {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (searchForImport(fullPath, targetName)) return true;
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
          if (
            entry.name === "paymentFinalizationContracts.ts" ||
            entry.name === "paymentFinalizationManifestService.ts"
          ) {
            continue;
          }
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes(targetName)) {
            return true;
          }
        }
      }
      return false;
    }

    const hasAppImport = searchForImport(appDir, "PaymentFinalizationManifestService");
    const hasLibImport = searchForImport(libDir, "PaymentFinalizationManifestService");

    assert(
      !hasAppImport && !hasLibImport,
      "Test 26: Planner is strictly dormant (zero production caller imports outside tests)"
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
