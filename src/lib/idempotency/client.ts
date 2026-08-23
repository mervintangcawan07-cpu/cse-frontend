// Relative Path: src/lib/idempotency/client.ts

interface StoredPendingKey {
  idempotencyKey: string;
  operationType: string;
}

function getStorageKey(operationType: string): string {
  return `govstudyx:pending_idempotency:${operationType}`;
}

/**
 * Generates a cryptographically secure UUID v4 / collision-resistant key.
 * Strictly fails closed if secure Web Crypto is unavailable.
 */
export function generateSecureIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC 4122
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  throw new Error("Unable to safely initialize this financial request. Cryptographically secure random generation is unavailable.");
}

/**
 * Retrieves the currently pending Idempotency-Key for the given operationType from sessionStorage,
 * or generates and durably persists a fresh cryptographically secure key.
 *
 * Strictly fails closed if browser storage is unavailable or unwritable to prevent unpersisted key execution.
 * Never stores monetary amounts, bank accounts, or sensitive payload details.
 */
export function getOrCreatePendingFinancialKey(operationType: string): string {
  if (typeof window === "undefined" || !window.sessionStorage) {
    throw new Error("Unable to safely initialize this financial request. Please enable browser storage and try again.");
  }

  const storageKey = getStorageKey(operationType);
  let raw: string | null = null;

  try {
    raw = window.sessionStorage.getItem(storageKey);
  } catch {
    throw new Error("Unable to safely initialize this financial request. Please enable browser storage and try again.");
  }

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.operationType === operationType &&
        typeof parsed.idempotencyKey === "string"
      ) {
        const trimmed = parsed.idempotencyKey.trim();
        if (trimmed.length >= 1 && trimmed.length <= 128) {
          return trimmed;
        }
      }
    } catch {
      // Malformed JSON record: will be replaced and persisted below
    }
  }

  const newKey = generateSecureIdempotencyKey();
  const record: StoredPendingKey = {
    idempotencyKey: newKey,
    operationType,
  };

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(record));
  } catch {
    throw new Error("Unable to safely initialize this financial request. Please enable browser storage and try again.");
  }

  return newKey;
}

/**
 * Clears the pending Idempotency-Key from sessionStorage upon definitive successful completion (2xx).
 * Safe against storage removal errors because a stale key will replay rather than duplicate.
 */
export function clearPendingFinancialKey(operationType: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }

  try {
    window.sessionStorage.removeItem(getStorageKey(operationType));
  } catch {
    // Silently ignore removal errors; a retained key safely replays upon retry
  }
}

/**
 * Explicit user action to abandon an unresolved pending operation and allow fresh key generation.
 */
export function abandonPendingFinancialOperation(operationType: string): void {
  clearPendingFinancialKey(operationType);
}
