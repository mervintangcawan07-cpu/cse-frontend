import assert from "node:assert/strict";

import { calculateRefundPolicy } from "../lib/payment/refundPolicy";

let passed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  PASS: ${name}`);
  } catch (error) {
    console.error(`  FAIL: ${name}`);
    throw error;
  }
}

console.log("=== QR PH REFUND POLICY REGRESSION ===");

test(
  "QR Ph discretionary first refund becomes full and merchant absorbs original fee",
  () => {
    const decision = calculateRefundPolicy({
      reason: "OTHER",
      paymentMethod: "qrph",
      originalPaymentCentavos: 2000,
      originalProcessingFeeCentavos: 30,
      cumulativeRefundedCentavos: 0,
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.code, "APPROVED_FULL");
    assert.equal(decision.reasonClass, "DISCRETIONARY");
    assert.equal(decision.paymentMethod, "qrph");
    assert.equal(decision.remainingRefundableCentavos, 2000);
    assert.equal(decision.customerRefundCentavos, 2000);
    assert.equal(decision.deductedOriginalProcessingFeeCentavos, 0);
    assert.equal(
      decision.merchantAbsorbedOriginalProcessingFeeCentavos,
      30
    );
    assert.equal(decision.isPartialRefund, false);
    assert.equal(decision.paymongoReason, "others");
  }
);

test(
  "QR Ph discretionary prior successful refund still requires manual review",
  () => {
    const decision = calculateRefundPolicy({
      reason: "OTHER",
      paymentMethod: "qrph",
      originalPaymentCentavos: 2000,
      originalProcessingFeeCentavos: 30,
      cumulativeRefundedCentavos: 500,
    });

    assert.equal(decision.allowed, false);
    assert.equal(
      decision.code,
      "PRIOR_REFUND_REQUIRES_MANUAL_REVIEW"
    );
    assert.equal(decision.customerRefundCentavos, 0);
  }
);

test(
  "GCash discretionary behavior still deducts the actual original fee",
  () => {
    const decision = calculateRefundPolicy({
      reason: "OTHER",
      paymentMethod: "gcash",
      originalPaymentCentavos: 2000,
      originalProcessingFeeCentavos: 30,
      cumulativeRefundedCentavos: 0,
    });

    assert.equal(decision.allowed, true);
    assert.equal(
      decision.code,
      "APPROVED_NET_DISCRETIONARY"
    );
    assert.equal(decision.customerRefundCentavos, 1970);
    assert.equal(
      decision.deductedOriginalProcessingFeeCentavos,
      30
    );
    assert.equal(
      decision.merchantAbsorbedOriginalProcessingFeeCentavos,
      0
    );
    assert.equal(decision.isPartialRefund, true);
  }
);

test(
  "Protected QR Ph refund remains full and merchant absorbs original fee",
  () => {
    const decision = calculateRefundPolicy({
      reason: "SERVICE_NOT_DELIVERED",
      paymentMethod: "qrph",
      originalPaymentCentavos: 2000,
      originalProcessingFeeCentavos: 30,
      cumulativeRefundedCentavos: 0,
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.code, "APPROVED_FULL");
    assert.equal(decision.reasonClass, "PROTECTED");
    assert.equal(decision.customerRefundCentavos, 2000);
    assert.equal(decision.deductedOriginalProcessingFeeCentavos, 0);
    assert.equal(
      decision.merchantAbsorbedOriginalProcessingFeeCentavos,
      30
    );
    assert.equal(decision.isPartialRefund, false);
  }
);

test(
  "Unauthorized charge still requires manual review",
  () => {
    const decision = calculateRefundPolicy({
      reason: "UNAUTHORIZED_CHARGE",
      paymentMethod: "qrph",
      originalPaymentCentavos: 2000,
      originalProcessingFeeCentavos: 30,
      cumulativeRefundedCentavos: 0,
    });

    assert.equal(decision.allowed, false);
    assert.equal(
      decision.code,
      "UNAUTHORIZED_REQUIRES_MANUAL_REVIEW"
    );
    assert.equal(decision.customerRefundCentavos, 0);
  }
);

test(
  "Maya same-day discretionary partial-refund protection remains intact",
  () => {
    const paymentCreatedAt =
      new Date("2026-08-27T01:00:00.000Z");
    const now =
      new Date("2026-08-27T03:00:00.000Z");

    const decision = calculateRefundPolicy({
      reason: "OTHER",
      paymentMethod: "paymaya",
      originalPaymentCentavos: 2000,
      originalProcessingFeeCentavos: 30,
      cumulativeRefundedCentavos: 0,
      paymentCreatedAt,
      now,
    });

    assert.equal(decision.allowed, false);
    assert.equal(
      decision.code,
      "MAYA_PARTIAL_NOT_YET_AVAILABLE"
    );
    assert.equal(decision.customerRefundCentavos, 1970);
    assert.equal(decision.isPartialRefund, true);
  }
);

test(
  "Unsupported payment method remains blocked",
  () => {
    const decision = calculateRefundPolicy({
      reason: "OTHER",
      paymentMethod: "unknown-method",
      originalPaymentCentavos: 2000,
      originalProcessingFeeCentavos: 30,
      cumulativeRefundedCentavos: 0,
    });

    assert.equal(decision.allowed, false);
    assert.equal(
      decision.code,
      "UNSUPPORTED_PAYMENT_METHOD"
    );
  }
);

console.log("");
console.log(`RESULTS: ${passed}/7 PASSED (0 FAILED)`);