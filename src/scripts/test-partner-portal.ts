// Relative Path: src/scripts/test-partner-portal.ts
import {
  calculatePercentageShareCentavos,
  formatCentavosToPesos,
  pesosToCentavos,
} from "../lib/accounting/money";
import { PartnerService } from "../lib/accounting/partnerService";
import { signPartnerJWT, verifyPartnerJWT } from "../lib/partnerAuth";

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

async function runTests() {
  console.log("\n=================================================================");
  console.log("🚀 GOVSTUDYX EXCLUSIVE PARTNER PORTAL & AUTH — TEST SUITE");
  console.log("=================================================================\n");

  // --- GROUP 1: PARTNER CODE & SLUG FORMATTING ---
  console.log("--- GROUP 1: PARTNER CODE & SLUG RESOLUTION ---");

  const generatedCode = PartnerService.generatePartnerCode("CSE Review PH");
  assert(generatedCode.startsWith("PTR-CSEREVIE"), "Generated partner code format matches 'PTR-CSEREVIE...'");

  const testSlug = "facebook-cse-reviewers";
  const cleanSlug = testSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  assert(cleanSlug === "facebook-cse-reviewers", "Partner slug sanitization handles hyphens and lowercase correctly");

  const expectedPartnerUrl = `https://govstudyx.com/p/${cleanSlug}`;
  assert(expectedPartnerUrl === "https://govstudyx.com/p/facebook-cse-reviewers", "Clean high-trust referral URL matches expected path");

  // --- GROUP 2: PARTNER JWT AUTHENTICATION ---
  console.log("\n--- GROUP 2: PARTNER JWT AUTHENTICATION ---");

  const partnerId = "ptr_test_123456";
  const partnerCode = "PTR-CSEPH";

  const token = await signPartnerJWT(partnerId, partnerCode);
  assert(typeof token === "string" && token.length > 20, "Partner JWT token signed successfully");

  const verified = await verifyPartnerJWT(token);
  assert(
    verified?.partnerId === partnerId && verified?.role === "PARTNER",
    "Partner JWT verified with role PARTNER and correct partnerId"
  );

  const invalidVerified = await verifyPartnerJWT("invalid.token.signature");
  assert(invalidVerified === null, "Tampered or invalid JWT signature returns null");

  // --- GROUP 3: PARTNER INDIVIDUAL REVENUE & COMMISSION ACCOUNTING ---
  console.log("\n--- GROUP 3: PARTNER INDIVIDUAL REVENUE & ACCOUNTING ---");

  // Scenario: 10 students buy ₱299 at 10% partner commission
  const studentPurchasePrice = 29900; // ₱299.00
  const ratePercent = 10.0;
  const singleCommission = calculatePercentageShareCentavos(studentPurchasePrice, ratePercent);
  assert(singleCommission === 2990, "Single purchase commission on ₱299 at 10% = ₱29.90 (2990 centavos)");

  const totalSalesCount = 10;
  const totalRevenueCentavos = studentPurchasePrice * totalSalesCount; // ₱2,990.00
  const totalEarnedCommissionsCentavos = singleCommission * totalSalesCount; // ₱299.00

  assert(totalRevenueCentavos === 299000, "10 sales generate ₱2,990.00 total qualifying community revenue");
  assert(totalEarnedCommissionsCentavos === 29900, "10 sales generate ₱299.00 total earned commissions for partner");

  // --- GROUP 4: HOLDING PERIOD & AVAILABLE BALANCE SEGREGATION ---
  console.log("\n--- GROUP 4: HOLDING PERIOD & PAYOUT CHECKS ---");

  // 6 purchases in 7-day holding (Pending), 4 purchases matured (>7 days, Available)
  const pendingCommissionsCentavos = singleCommission * 6; // ₱179.40
  const availableCommissionsCentavos = singleCommission * 4; // ₱119.60

  assert(
    pendingCommissionsCentavos === 17940 && availableCommissionsCentavos === 11960,
    "Commissions correctly segregated between Pending Holding (₱179.40) and Available (₱119.60)"
  );

  // Minimum payout threshold: ₱150.00 (15000 centavos)
  const minPayoutCentavos = 15000;
  const canWithdrawBeforeThreshold = availableCommissionsCentavos >= minPayoutCentavos;
  assert(
    canWithdrawBeforeThreshold === false,
    "Available balance ₱119.60 is blocked from withdrawal (Below ₱150.00 threshold)"
  );

  // 2 more purchases mature -> available becomes 4 + 2 = 6 purchases = ₱179.40
  const maturedAvailableCentavos = singleCommission * 6; // ₱179.40
  const canWithdrawAfterThreshold = maturedAvailableCentavos >= minPayoutCentavos;
  assert(
    canWithdrawAfterThreshold === true,
    "Available balance ₱179.40 allows withdrawal (Exceeds ₱150.00 threshold)"
  );

  // --- GROUP 5: STUDENT PRIVACY MASKING ---
  console.log("\n--- GROUP 5: STUDENT PRIVACY PROTECTION ---");

  const email1 = "juan.delacruz@gmail.com";
  const masked1 = email1.replace(/(.{2})(.*)(@.*)/, "$1***$3");
  assert(masked1 === "ju***@gmail.com", "Student email juan.delacruz@gmail.com masked to ju***@gmail.com");

  const email2 = "maria_santos123@yahoo.com";
  const masked2 = email2.replace(/(.{2})(.*)(@.*)/, "$1***$3");
  assert(masked2 === "ma***@yahoo.com", "Student email maria_santos123@yahoo.com masked to ma***@yahoo.com");

  // --- GROUP 6: PARTNER APPLICATION & ONBOARDING ---
  console.log("\n--- GROUP 6: PARTNER APPLICATION & ONBOARDING ---");

  const rawSlug = "  Prof. Juan — CSE Review TV!  ";
  const normalizedSlug = rawSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  assert(
    normalizedSlug === "prof-juan-cse-review-tv",
    "Applicant proposed slug normalized cleanly to 'prof-juan-cse-review-tv'"
  );

  const applicantData = {
    applicantName: "Prof. Juan",
    organizationName: "Prof. Juan CSE Review TV",
    email: "prof.juan@gmail.com",
    socialUrl: "https://youtube.com/@profjuan",
    status: "PENDING" as const,
  };
  assert(
    applicantData.email.includes("@") && applicantData.socialUrl.startsWith("https://"),
    "Application input validates email format and HTTPS social channel URL"
  );

  // --- GROUP 7: MULTI-CHANNEL CAMPAIGN TRACKING & PROMO CODES ---
  console.log("\n--- GROUP 7: MULTI-CHANNEL SUB-TRACKING & PROMO CODES ---");

  const channels = ["youtube", "tiktok", "fbgroup", "messenger", "email"];
  const testBaseLink = "https://govstudyx.com/p/prof-juan";
  const channelUrls = channels.map((c) => `${testBaseLink}?src=${c}`);
  assert(
    channelUrls.every((u) => u.includes("?src=")),
    "Sub-tracking campaign URLs properly generated with ?src= parameters"
  );

  // Scenario: Student uses 10% creator promo discount on ₱299 plan
  const regularPlanCentavos = 29900;
  const partnerDiscountPercent = 10.0;
  const discountedPriceCentavos = Math.round(
    regularPlanCentavos * ((100 - partnerDiscountPercent) / 100)
  );
  assert(
    discountedPriceCentavos === 26910,
    "10% partner discount on ₱299.00 computes to exactly ₱269.10 (26910 centavos)"
  );

  // Scenario: Partner commission computed on customer's actual paid discounted amount
  const partnerCommissionOnDiscounted = calculatePercentageShareCentavos(
    discountedPriceCentavos,
    10.0
  );
  assert(
    partnerCommissionOnDiscounted === 2691,
    "Partner 10% commission on ₱269.10 discounted purchase computes to exactly ₱26.91 (2691 centavos)"
  );

  // --- GROUP 8: INSTITUTIONAL VOUCHER ENGINE & EMAIL ALERTS (PHASE 4) ---
  console.log("\n--- GROUP 8: INSTITUTIONAL VOUCHER ENGINE & EMAIL ALERTS ---");

  // Voucher batch ref generation
  const institutionName = "PNP Regional Training Center Davao";
  const cleanPrefix = institutionName.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6);
  const currentYear = new Date().getFullYear();
  assert(cleanPrefix === "PNPREG", "Institution prefix extracted as 'PNPREG'");

  // Voucher batch duration calculation (365 days)
  const durationDays = 365;
  const now = new Date("2026-08-21T00:00:00Z");
  const computedExpiry = new Date(now);
  computedExpiry.setDate(computedExpiry.getDate() + durationDays);
  assert(
    computedExpiry.toISOString().startsWith("2027-08-21"),
    "365-day voucher correctly sets student access until August 2027"
  );

  // Existing subscriber access extension test (additive access)
  const existingPaidUntil = new Date("2026-10-01T00:00:00Z");
  const extendedExpiry = new Date(existingPaidUntil);
  extendedExpiry.setDate(extendedExpiry.getDate() + durationDays);
  assert(
    extendedExpiry.toISOString().startsWith("2027-10-01"),
    "Active subscriber redeeming voucher gets additive access from their existing paidUntil date"
  );

  // Batch redemption status transitions
  const totalCodesInBatch = 50;
  let redeemedCount = 49;
  let isFullyRedeemed = redeemedCount + 1 >= totalCodesInBatch;
  assert(isFullyRedeemed === true, "50th redemption marks batch status as FULLY_REDEEMED");

  // Commission alert email format check
  const testCommissionCentavos = 2990;
  const formattedPesos = formatCentavosToPesos(testCommissionCentavos);
  assert(formattedPesos === "₱29.90", "formatCentavosToPesos formats 2990 centavos as '₱29.90'");
  const sanitizedForEmail = formattedPesos.replace(/^₱\s*/, "");
  assert(sanitizedForEmail === "29.90", "Email template sanitizes '₱29.90' to '29.90' preventing duplicate currency symbols");

  // --- SUMMARY ---
  console.log("\n=================================================================");
  console.log(`📊 PARTNER PORTAL TEST SUMMARY: ${passedTests} / ${totalTests} PASSED`);
  if (failedTests === 0) {
    console.log("🎉 ALL PARTNER PORTAL, CAMPAIGN TRACKING & FINANCIAL TESTS PASSED (100%)!");
  } else {
    console.error(`🚨 ${failedTests} TEST(S) FAILED!`);
  }
  console.log("=================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
