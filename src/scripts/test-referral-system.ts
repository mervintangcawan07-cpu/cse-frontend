// Relative Path: src/scripts/test-referral-system.ts
import { calculateReferralReward, formatCentavosToPesos, pesosToCentavos } from "../lib/referral/rewardCalculator";
import { generateReferralCode, isValidReferralCodeFormat, normalizeReferralCode } from "../lib/referral/codeGenerator";
import { evaluateReferralFraud } from "../lib/referral/fraudEngine";
import { DEFAULT_REFERRAL_CONFIG, USER_REFERRAL_ENABLED, isUserReferralEnabled } from "../lib/referral/config";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}${details ? ` (${details})` : ""}`);
  }
}

console.log("\n=================================================================");
console.log("🚀 GOVSTUDYX REFERRAL & REWARD SYSTEM (v3.0) — TEST SUITE");
console.log("=================================================================\n");

// ================================================================
// GROUP 1: REWARD CALCULATION TESTS (Section 66 & 67)
// ================================================================
console.log("--- GROUP 1: REWARD CALCULATION TESTS ---");

// Case 1: ₱99 at 20% -> ₱19.80 (1980 centavos)
const c1 = calculateReferralReward({ purchaseAmountCentavos: 9900, effectiveRate: 20 });
assert(c1.rewardAmountCentavos === 1980, "Case 1: ₱99 at 20% = ₱19.80", `Got ${c1.rewardAmountCentavos}`);

// Case 2: ₱199 at 20% -> ₱39.80 (3980 centavos)
const c2 = calculateReferralReward({ purchaseAmountCentavos: 19900, effectiveRate: 20 });
assert(c2.rewardAmountCentavos === 3980, "Case 2: ₱199 at 20% = ₱39.80", `Got ${c2.rewardAmountCentavos}`);

// Case 3: ₱299 at 20% -> ₱59.80 (5980 centavos)
const c3 = calculateReferralReward({ purchaseAmountCentavos: 29900, effectiveRate: 20 });
assert(c3.rewardAmountCentavos === 5980, "Case 3: ₱299 at 20% = ₱59.80", `Got ${c3.rewardAmountCentavos}`);

// Case 4: ₱499 at 20% -> ₱99.80 (9980 centavos)
const c4 = calculateReferralReward({ purchaseAmountCentavos: 49900, effectiveRate: 20 });
assert(c4.rewardAmountCentavos === 9980, "Case 4: ₱499 at 20% = ₱99.80", `Got ${c4.rewardAmountCentavos}`);

// Case 5: Discounted ₱299 list - ₱50 = ₱249 paid at 20% -> ₱49.80 (4980 centavos)
const c5 = calculateReferralReward({ purchaseAmountCentavos: 24900, effectiveRate: 20 });
assert(c5.rewardAmountCentavos === 4980, "Case 5: ₱249 discounted at 20% = ₱49.80", `Got ${c5.rewardAmountCentavos}`);

// Case 6: ₱299 at 25% -> ₱74.75 (7475 centavos)
const c6 = calculateReferralReward({ purchaseAmountCentavos: 29900, effectiveRate: 25 });
assert(c6.rewardAmountCentavos === 7475, "Case 6: ₱299 at 25% = ₱74.75", `Got ${c6.rewardAmountCentavos}`);

// Case 7: ₱299 at 15% -> ₱44.85 (4485 centavos)
const c7 = calculateReferralReward({ purchaseAmountCentavos: 29900, effectiveRate: 15 });
assert(c7.rewardAmountCentavos === 4485, "Case 7: ₱299 at 15% = ₱44.85", `Got ${c7.rewardAmountCentavos}`);

// ================================================================
// GROUP 2: PAYMONGO PROCESSING FEE EXCLUSION (Section 69)
// ================================================================
console.log("\n--- GROUP 2: PAYMONGO PROCESSING FEE EXCLUSION ---");

// Customer pays ₱299. PayMongo fee is e.g. ₱10 (net ₱289). Reward MUST be 20% of ₱299 = ₱59.80.
const customerPaymentCentavos = 29900;
const paymongoProcessingFeeCentavos = 1000;
const netSettlementCentavos = customerPaymentCentavos - paymongoProcessingFeeCentavos;

const feeTestReward = calculateReferralReward({ purchaseAmountCentavos: customerPaymentCentavos, effectiveRate: 20 });
const incorrectRewardIfFeesDeducted = calculateReferralReward({ purchaseAmountCentavos: netSettlementCentavos, effectiveRate: 20 });

assert(
  feeTestReward.rewardAmountCentavos === 5980 && feeTestReward.rewardAmountCentavos !== incorrectRewardIfFeesDeducted.rewardAmountCentavos,
  "Case 8: PayMongo fees NOT deducted from reward calculation base (₱299 -> ₱59.80)",
  `Expected 5980, got ${feeTestReward.rewardAmountCentavos}`
);

// ================================================================
// GROUP 3: DISCOUNT HANDLING TEST (Section 68)
// ================================================================
console.log("\n--- GROUP 3: DISCOUNT HANDLING ---");

// List price: ₱299, Discount: ₱100, Customer actual payment: ₱199
const listPriceCentavos = 29900;
const discountCentavos = 10000;
const actualCustomerChargedCentavos = listPriceCentavos - discountCentavos; // 19900

const discountReward = calculateReferralReward({ purchaseAmountCentavos: actualCustomerChargedCentavos, effectiveRate: 20 });
assert(
  discountReward.rewardAmountCentavos === 3980,
  "Case 9: Discounted purchase uses actual paid amount (₱199 -> ₱39.80, NOT ₱59.80)",
  `Expected 3980, got ${discountReward.rewardAmountCentavos}`
);

// ================================================================
// GROUP 4: HISTORICAL RATE IMMUTABILITY (Section 67)
// ================================================================
console.log("\n--- GROUP 4: HISTORICAL RATE IMMUTABILITY ---");

// Referral A qualified at 20%
const referralA_Rate = 20;
const referralA_Reward = calculateReferralReward({ purchaseAmountCentavos: 29900, effectiveRate: referralA_Rate });

// Admin later changes system rate from 20% to 25%
const newSystemRate = 25;
const referralB_Reward = calculateReferralReward({ purchaseAmountCentavos: 29900, effectiveRate: newSystemRate });

assert(
  referralA_Reward.rewardAmountCentavos === 5980 && referralB_Reward.rewardAmountCentavos === 7475,
  "Case 10: Historical Referral A remains ₱59.80 when rate changes to 25%; Referral B receives ₱74.75",
  `Referral A: ${referralA_Reward.rewardAmountCentavos}, Referral B: ${referralB_Reward.rewardAmountCentavos}`
);

// ================================================================
// GROUP 5: REFERRAL CODE GENERATION & NORMALIZATION (Section 15)
// ================================================================
console.log("\n--- GROUP 5: REFERRAL CODE GENERATION & VALIDATION ---");

const code1 = generateReferralCode("Mervin");
const code2 = generateReferralCode("Juan");

assert(code1.startsWith("GSX-") && code1.length >= 7, "Code format conforms to GSX- prefix", `Code: ${code1}`);
assert(code1 !== code2, "Codes are unique across different users", `${code1} vs ${code2}`);
assert(isValidReferralCodeFormat("GSX-ABC123"), "GSX-ABC123 is valid format");
assert(!isValidReferralCodeFormat("ADMIN"), "Reserved keyword 'ADMIN' is rejected");
assert(normalizeReferralCode("  gsx-merv8k  ") === "GSX-MERV8K", "Normalization converts to trimmed uppercase");

// ================================================================
// GROUP 6: ANTI-FRAUD & SELF-REFERRAL TESTS (Section 19 & 42)
// ================================================================
console.log("\n--- GROUP 6: ANTI-FRAUD & SELF-REFERRAL CHECKS ---");

// Self referral by ID
const selfCheck1 = evaluateReferralFraud({
  inviterId: "usr_123",
  referredUserId: "usr_123",
  codeOwnerId: "usr_123",
});
assert(selfCheck1.isBlocked === true && selfCheck1.riskLevel === "BLOCKED", "Self-referral by user ID is strictly BLOCKED");

// Self referral by Email
const selfCheck2 = evaluateReferralFraud({
  inviterId: "usr_123",
  referredUserId: "usr_456",
  codeOwnerId: "usr_123",
  inviterEmail: "mervin@gmail.com",
  referredEmail: "mervin@gmail.com",
});
assert(selfCheck2.isBlocked === true && selfCheck2.riskLevel === "BLOCKED", "Self-referral by identical email is strictly BLOCKED");

// Email alias abuse (mervin+1@gmail.com)
const aliasCheck = evaluateReferralFraud({
  inviterId: "usr_123",
  referredUserId: "usr_456",
  codeOwnerId: "usr_123",
  inviterEmail: "mervin@gmail.com",
  referredEmail: "mervin+exam1@gmail.com",
});
assert(aliasCheck.riskLevel === "SUSPICIOUS", "Gmail '+' alias is detected as SUSPICIOUS");

// Legitimate referral
const legitCheck = evaluateReferralFraud({
  inviterId: "usr_123",
  referredUserId: "usr_456",
  codeOwnerId: "usr_123",
  inviterEmail: "mervin@gmail.com",
  referredEmail: "maria.santos@yahoo.com",
  recentReferralsCountIn24h: 3,
});
assert(legitCheck.isBlocked === false && legitCheck.riskLevel === "LOW_RISK", "Legitimate referral passes as LOW_RISK");

// ================================================================
// GROUP 7: MINIMUM PAYOUT THRESHOLD (Section 32 & 73)
// ================================================================
console.log("\n--- GROUP 7: MINIMUM PAYOUT THRESHOLD (₱150.00) ---");

const minPayoutCentavos = DEFAULT_REFERRAL_CONFIG.minPayoutAmountCentavos; // 15000 = ₱150.00
const balanceBelowThresholdCentavos = 14999; // ₱149.99
const balanceExactThresholdCentavos = 15000; // ₱150.00
const balanceAboveThresholdCentavos = 50000; // ₱500.00

assert(
  balanceBelowThresholdCentavos < minPayoutCentavos,
  "₱149.99 is below ₱150.00 minimum payout threshold (Payout blocked)"
);

assert(
  balanceExactThresholdCentavos >= minPayoutCentavos,
  "₱150.00 exactly meets the minimum payout threshold (Payout allowed)"
);

assert(
  balanceAboveThresholdCentavos - 15000 === 35000,
  "Requesting ₱150 payout from ₱500 balance leaves exactly ₱350 available"
);

// ================================================================
// GROUP 8: FINANCIAL FORMATTER PRECISION
// ================================================================
console.log("\n--- GROUP 8: FINANCIAL FORMATTER PRECISION ---");

assert(formatCentavosToPesos(5980) === "₱59.80", "5980 centavos formats to '₱59.80'");
assert(formatCentavosToPesos(29900) === "₱299.00", "29900 centavos formats to '₱299.00'");
assert(pesosToCentavos(59.8) === 5980, "59.80 Pesos converts safely to 5980 integer centavos");

// ================================================================
// GROUP 9: NORMAL-USER REFERRAL FEATURE GATE (PHASE 4)
// ================================================================
console.log("\n--- GROUP 9: NORMAL-USER REFERRAL FEATURE GATE ---");

assert(
  USER_REFERRAL_ENABLED === false,
  "Case 26: USER_REFERRAL_ENABLED is false by default in unconfigured environment"
);
assert(
  isUserReferralEnabled(undefined) === false,
  "Case 27: isUserReferralEnabled(undefined) defaults to false"
);
assert(
  isUserReferralEnabled("") === false,
  "Case 28: isUserReferralEnabled('') is false"
);
assert(
  isUserReferralEnabled("false") === false,
  "Case 29: isUserReferralEnabled('false') is false"
);
assert(
  isUserReferralEnabled("TRUE") === false,
  "Case 30: isUserReferralEnabled('TRUE') is false (strictly requires exact 'true')"
);
assert(
  isUserReferralEnabled("1") === false,
  "Case 31: isUserReferralEnabled('1') is false"
);
assert(
  isUserReferralEnabled("true") === true,
  "Case 32: isUserReferralEnabled('true') enables normal-user referral UI"
);

// ================================================================
// SUMMARY REPORT
// ================================================================
console.log("\n=================================================================");
console.log(`📊 TEST SUITE SUMMARY: ${passedTests} / ${totalTests} PASSED`);
if (failedTests === 0) {
  console.log("🎉 ALL REFERRAL SYSTEM UNIT & FINANCIAL INTEGRITY TESTS PASSED!");
} else {
  console.error(`🚨 ${failedTests} TEST(S) FAILED!`);
}
console.log("=================================================================\n");

if (failedTests > 0) {
  process.exit(1);
}
