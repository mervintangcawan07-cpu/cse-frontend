// Relative Path: src/lib/referral/codeGenerator.ts
import crypto from "crypto";

// Unambiguous character set (omitting 0, O, 1, I, L) for supreme readability
const CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const RESERVED_PREFIXES = ["ADMIN", "API", "ROOT", "SYSTEM", "SUPPORT", "STAFF", "TEST", "GOV", "CSE"];

export function generateRandomCodeSuffix(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARSET[bytes[i] % CHARSET.length];
  }
  return result;
}

/**
 * Generates a clean, unique, human-readable referral code.
 * Example: GSX-K8M4VN
 */
export function generateReferralCode(userIdentifier?: string): string {
  let seed = "";
  if (userIdentifier) {
    // Extract up to 3 uppercase alphanumeric chars from user's identifier/name
    const cleanId = userIdentifier.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (cleanId.length >= 2) {
      seed = cleanId.slice(0, 3);
    }
  }

  const randomPart = generateRandomCodeSuffix(seed ? 4 : 6);
  const code = `GSX-${seed}${randomPart}`.toUpperCase();
  return code;
}

/**
 * Normalizes input referral codes (trims whitespace, converts to uppercase).
 */
export function normalizeReferralCode(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Validates format of referral codes.
 */
export function isValidReferralCodeFormat(code: string): boolean {
  if (!code) return false;
  const normalized = normalizeReferralCode(code);
  // Match GSX-XXXXXX or alphanumeric 4-20 chars
  const codeRegex = /^[A-Z0-9_-]{4,20}$/;
  if (!codeRegex.test(normalized)) return false;

  // Check reserved words
  for (const reserved of RESERVED_PREFIXES) {
    if (normalized === reserved || normalized === `GSX-${reserved}`) {
      return false;
    }
  }

  return true;
}
