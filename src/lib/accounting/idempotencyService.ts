// Relative Path: src/lib/accounting/idempotencyService.ts
import crypto from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";

export type FinancialOperationType =
  | "MANUAL_ADJUSTMENT"
  | "MANUAL_DEDUCTION"
  | "PARTNER_PAYOUT_REQUEST"
  | "REFERRAL_PAYOUT_REQUEST"
  | "REFUND_EXECUTION";

export class IdempotencyDomainError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status: number = 400) {
    super(message);
    this.name = "IdempotencyDomainError";
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, IdempotencyDomainError.prototype);
  }
}

export class IdempotencyService {
  /**
   * Extracts and validates optional Idempotency-Key from HTTP request headers.
   * Accepts "Idempotency-Key" and/or "x-idempotency-key".
   * If both are supplied, requires identical trimmed values; otherwise rejects with 400.
   * Returns trimmed key or null if missing (Phase-1 dual-mode compatibility).
   */
  public static parseAndValidateIdempotencyKey(request: Request): string | null {
    const hasPrimary = request.headers.has("idempotency-key");
    const hasAlias = request.headers.has("x-idempotency-key");

    if (!hasPrimary && !hasAlias) {
      return null;
    }

    const primaryRaw = request.headers.get("idempotency-key");
    const aliasRaw = request.headers.get("x-idempotency-key");

    const primaryTrimmed = primaryRaw !== null ? primaryRaw.trim() : null;
    const aliasTrimmed = aliasRaw !== null ? aliasRaw.trim() : null;

    let key: string;

    if (hasPrimary && hasAlias) {
      if (primaryTrimmed !== aliasTrimmed) {
        throw new IdempotencyDomainError(
          "CONFLICTING_IDEMPOTENCY_HEADERS",
          "Conflicting Idempotency-Key headers.",
          400
        );
      }
      key = primaryTrimmed!;
    } else if (hasPrimary) {
      key = primaryTrimmed!;
    } else {
      key = aliasTrimmed!;
    }

    if (key.length < 1 || key.length > 128) {
      throw new IdempotencyDomainError(
        "INVALID_IDEMPOTENCY_KEY",
        "Invalid Idempotency-Key header.",
        400
      );
    }

    return key;
  }

  /**
   * Deterministically computes a canonical SHA-256 hash of a normalized financial payload.
   */
  public static hashCanonicalPayload(payload: Record<string, any>): string {
    const sortedKeys = Object.keys(payload).sort();
    const sortedObj: Record<string, any> = {};
    for (const key of sortedKeys) {
      sortedObj[key] = payload[key];
    }
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(sortedObj))
      .digest("hex");
  }

  /**
   * Acquires Level 0 transaction-scoped advisory lock for the authoritative idempotency scope.
   */
  public static async acquireIdempotencyLock(
    tx: Prisma.TransactionClient,
    actorId: string,
    operationType: FinancialOperationType,
    idempotencyKey: string
  ): Promise<void> {
    const lockKey = `idempotency:${actorId}:${operationType}:${idempotencyKey}`;
    await tx.$queryRaw(
      Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS lock_result
      `
    );
  }

  /**
   * Queries authoritative FinancialIdempotencyKey record inside or outside a transaction.
   */
  public static async findAuthoritativeIdempotencyRecord(
    client: Prisma.TransactionClient | PrismaClient,
    actorId: string,
    operationType: FinancialOperationType,
    idempotencyKey: string
  ) {
    return client.financialIdempotencyKey.findUnique({
      where: {
        actorId_operationType_idempotencyKey: {
          actorId,
          operationType,
          idempotencyKey,
        },
      },
    });
  }

  /**
   * Persists a newly completed financial idempotency record inside the active transaction.
   */
  public static async recordFinancialIdempotency(
    tx: Prisma.TransactionClient,
    params: {
      actorId: string;
      operationType: FinancialOperationType;
      idempotencyKey: string;
      requestHash: string;
      resourceId: string;
    }
  ) {
    return tx.financialIdempotencyKey.create({
      data: {
        actorId: params.actorId,
        operationType: params.operationType,
        idempotencyKey: params.idempotencyKey,
        requestHash: params.requestHash,
        resourceId: params.resourceId,
      },
    });
  }

  /**
   * Determines if a caught error represents a Prisma P2002 collision strictly on the composite FinancialIdempotencyKey uniqueness.
   */
  public static isIdempotencyCompositeP2002(err: any): boolean {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
      return false;
    }

    const target = err.meta?.target;
    if (Array.isArray(target)) {
      return (
        target.includes("actorId") &&
        target.includes("operationType") &&
        target.includes("idempotencyKey")
      );
    }
    if (typeof target === "string") {
      return target === "FinancialIdempotencyKey_actorId_operationType_idempotencyKey_key";
    }
    return false;
  }
}
