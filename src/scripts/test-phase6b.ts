// Relative Path: src/scripts/test-phase6b.ts

import { encrypt, decrypt, isEncrypted } from "../lib/crypto/encryption";
import { transformForWrite, transformForRead } from "../lib/crypto/fieldTransformer";

console.log("==========================================");
console.log("🧪 TESTING PHASE 6B: AES-256-GCM FIELD ENCRYPTION");
console.log("==========================================");

console.log("\n--- TEST 1: New Encrypted Write ---");
const rawSensitiveData = "sensitive_user_ssn_9999";
const encrypted = encrypt(rawSensitiveData);
console.log("Encrypted Payload:", encrypted);
console.log("Is Encrypted?    ", isEncrypted(encrypted));

console.log("\n--- TEST 2: Decrypt Active Payload ---");
const decrypted = decrypt(encrypted);
console.log("Decrypted Output: ", decrypted);
console.log("Matches Original? ", decrypted === rawSensitiveData);

console.log("\n--- TEST 3: Legacy Plain-Text Pass-Through ---");
const legacyValue = "plain_legacy_database_string";
const legacyOutput = decrypt(legacyValue);
console.log("Legacy Input:     ", legacyValue);
console.log("Legacy Output:    ", legacyOutput);
console.log("Safe Pass-Through?", legacyOutput === legacyValue);

console.log("\n--- TEST 4: Object Field Transformation ---");
const userRecord = {
  id: "usr_9912",
  email: "sensitive.user@example.com",
  banReason: "Violated platform terms of service.",
  role: "USER",
};

const encryptedUser = transformForWrite(userRecord, ["banReason"]);
console.log("Encrypted Record: ", JSON.stringify(encryptedUser, null, 2));

const decryptedUser = transformForRead(encryptedUser, ["banReason"]);
console.log("Decrypted Record: ", JSON.stringify(decryptedUser, null, 2));

console.log("\n✅ Phase 6B field-level encryption unit verification complete!\n");
