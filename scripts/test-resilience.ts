import { logger } from "../src/lib/logger/logger";
import { sanitizePayload } from "../src/lib/validation/sanitizer";
import { validateLoginSchema } from "../src/lib/validation/schemas";
import { idempotencyStore } from "../src/lib/security/idempotency";

console.log("\n==========================================");
console.log("🧪 TESTING PHASE 1: LOGGING & PII SCRUBBING");
console.log("==========================================");
logger.info("Test Info Log", { user: "test@example.com" });
logger.error("Test Error Log with Sensitive Data", new Error("Simulated Database Timeout"), {
  password: "SuperSecretPassword123",
  token: "bearer eyJhbGciOiJIUzI1NiJ9.testToken",
});

console.log("\n==========================================");
console.log("🧪 TESTING PHASE 3: SANITIZATION & SCHEMAS");
console.log("==========================================");
const dirtyInput = {
  comment: "<script>alert('xss')</script> Hello World!",
  email: " JUAN@GMAIL.COM ",
};
const cleanInput = sanitizePayload(dirtyInput);
console.log("Dirty Input:", dirtyInput);
console.log("Sanitizer Output:", cleanInput);

const invalidLogin = validateLoginSchema({ email: "invalid-email", password: "123" });
console.log("Schema Validation (Invalid):", JSON.stringify(invalidLogin, null, 2));

console.log("\n==========================================");
console.log("🧪 TESTING PHASE 4: IDEMPOTENCY LOCK STORE");
console.log("==========================================");
const key = "test-route:key-123";
console.log("1st Lock Attempt:", idempotencyStore.acquire(key));
console.log("2nd Lock Attempt (Duplicate):", idempotencyStore.acquire(key));

idempotencyStore.resolve(key, 200, { status: "success", data: "cached" });
console.log("3rd Lock Attempt (After Resolved):", idempotencyStore.acquire(key));

console.log("\n✅ Unit logic verification complete!\n");
