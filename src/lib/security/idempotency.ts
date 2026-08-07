// Relative Path: src/lib/security/idempotency.ts

interface IdempotencyRecord {
  status: "PENDING" | "RESOLVED";
  statusCode?: number;
  responseBody?: unknown;
  expiresAt: number;
}

class IdempotencyStore {
  private store = new Map<string, IdempotencyRecord>();
  private readonly defaultTtlMs = 60 * 1000; // 60 seconds lock retention

  constructor() {
    // Periodically purge expired idempotency entries
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.cleanupExpired(), 30 * 1000);
    }
  }

  /**
   * Attempts to lock an idempotency key.
   * Returns 'ACQUIRED' if new, 'PENDING' if currently processing, or 'RESOLVED' if previously completed.
   */
  public acquire(
    key: string,
    ttlMs: number = this.defaultTtlMs
  ): { status: "ACQUIRED" | "PENDING" | "RESOLVED"; record?: IdempotencyRecord } {
    const existing = this.store.get(key);
    const now = Date.now();

    if (existing && existing.expiresAt > now) {
      if (existing.status === "PENDING") {
        return { status: "PENDING", record: existing };
      }
      return { status: "RESOLVED", record: existing };
    }

    // Acquire lock
    const newRecord: IdempotencyRecord = {
      status: "PENDING",
      expiresAt: now + ttlMs,
    };

    this.store.set(key, newRecord);
    return { status: "ACQUIRED" };
  }

  /**
   * Caches the API response for an acquired idempotency key.
   */
  public resolve(key: string, statusCode: number, responseBody: unknown): void {
    const existing = this.store.get(key);
    if (existing) {
      existing.status = "RESOLVED";
      existing.statusCode = statusCode;
      existing.responseBody = responseBody;
    }
  }

  /**
   * Releases a lock if an unhandled error occurred during processing.
   */
  public release(key: string): void {
    this.store.delete(key);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (record.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

export const idempotencyStore = new IdempotencyStore();
