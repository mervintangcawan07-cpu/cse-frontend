import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkStrictSudoRateLimit,
  isStrictSudoRateLimitEnabled,
} from "./strictSudoRateLimit";

test("strict sudo mode defaults disabled", () => {
  const original = process.env.SECURITY_SUDO_RATE_LIMIT_FAIL_CLOSED;
  try {
    delete process.env.SECURITY_SUDO_RATE_LIMIT_FAIL_CLOSED;
    assert.equal(isStrictSudoRateLimitEnabled(), false);
    process.env.SECURITY_SUDO_RATE_LIMIT_FAIL_CLOSED = "1";
    assert.equal(isStrictSudoRateLimitEnabled(), true);
  } finally {
    if (original === undefined) delete process.env.SECURITY_SUDO_RATE_LIMIT_FAIL_CLOSED;
    else process.env.SECURITY_SUDO_RATE_LIMIT_FAIL_CLOSED = original;
  }
});

test("missing limiter blocks admin sudo elevation", async () => {
  const decision = await checkStrictSudoRateLimit(null, "user-id");
  assert.deepEqual(decision, { allowed: false, remainingAttempts: 0, retryAfterSec: 15 });
});

test("limiter outage blocks rather than allowing fallback", async () => {
  const decision = await checkStrictSudoRateLimit({
    async limit() { throw new Error("simulated Redis outage"); },
  }, "user-id");
  assert.equal(decision.allowed, false);
  assert.equal(decision.retryAfterSec, 15);
});

test("valid limiter response grants allowed request and rejects excess", async () => {
  const allowed = await checkStrictSudoRateLimit({
    async limit() { return { success: true, remaining: 2, reset: 12_000 }; },
  }, "user-id", 10_000);
  assert.deepEqual(allowed, { allowed: true, remainingAttempts: 2 });

  const denied = await checkStrictSudoRateLimit({
    async limit() { return { success: false, remaining: 0, reset: 12_000 }; },
  }, "user-id", 10_000);
  assert.deepEqual(denied, { allowed: false, remainingAttempts: 0, retryAfterSec: 2 });
});

test("malformed limiter response blocks", async () => {
  const decision = await checkStrictSudoRateLimit({
    async limit() { return { success: true, remaining: Number.NaN, reset: Date.now() }; },
  }, "user-id");
  assert.equal(decision.allowed, false);
});
