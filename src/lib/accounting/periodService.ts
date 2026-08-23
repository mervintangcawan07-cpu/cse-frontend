// Relative Path: src/lib/accounting/periodService.ts
import { Prisma } from "@prisma/client";

export class PeriodDomainError extends Error {
  public code: string;
  public status: number;

  constructor(code: string, message: string, status: number = 409) {
    super(message);
    this.name = "PeriodDomainError";
    this.code = code;
    this.status = status;
  }
}

export interface LockedAccountingPeriod {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: "OPEN" | "CLOSED" | "LOCKED";
}

export class PeriodService {
  /**
   * Acquires the transaction-scoped PostgreSQL advisory lock for accounting period configuration.
   * Key: 'accounting-period-configuration'
   */
  static async acquireConfigurationLock(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended('accounting-period-configuration', 0))::text AS lock_result`
    );
  }

  /**
   * Resolves and locks the single open AccountingPeriod covering a specific postingTime.
   * Lock sequence:
   * 1. Acquire transaction-scoped advisory lock 'accounting-period-configuration'
   * 2. Query all periods satisfying startDate <= postingTime <= endDate
   * 3. Require exactly 1 matching period (fail if 0 or >1)
   * 4. Acquire FOR UPDATE row lock on that period by id
   * 5. Revalidate date boundaries and status === "OPEN"
   */
  static async lockAndResolveOpenPeriodForPosting(
    tx: Prisma.TransactionClient,
    postingTime: Date
  ): Promise<LockedAccountingPeriod> {
    // 1. Acquire configuration advisory lock
    await this.acquireConfigurationLock(tx);

    // 2. Query all covering periods
    const matchingPeriods = await tx.accountingPeriod.findMany({
      where: {
        startDate: { lte: postingTime },
        endDate: { gte: postingTime },
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    // 3. Handle zero or ambiguous matches
    if (matchingPeriods.length === 0) {
      throw new PeriodDomainError(
        "NO_OPEN_PERIOD",
        "No open accounting period is configured for this posting date.",
        409
      );
    }

    if (matchingPeriods.length > 1) {
      throw new PeriodDomainError(
        "AMBIGUOUS_PERIOD_CONFIGURATION",
        "Accounting period configuration is ambiguous for this posting date.",
        409
      );
    }

    const candidate = matchingPeriods[0];

    // 4. Acquire FOR UPDATE row lock on the candidate period
    const lockedRows = await tx.$queryRaw<Array<{
      id: string;
      name: string;
      startDate: Date;
      endDate: Date;
      status: "OPEN" | "CLOSED" | "LOCKED";
    }>>(
      Prisma.sql`
        SELECT id, name, "startDate", "endDate", status
        FROM "AccountingPeriod"
        WHERE id = ${candidate.id}
        FOR UPDATE
      `
    );

    if (!lockedRows || lockedRows.length === 0) {
      throw new PeriodDomainError(
        "NO_OPEN_PERIOD",
        "No open accounting period is configured for this posting date.",
        409
      );
    }

    const lockedPeriod = lockedRows[0];

    // 5. Revalidate date coverage under row lock
    if (lockedPeriod.startDate > postingTime || lockedPeriod.endDate < postingTime) {
      throw new PeriodDomainError(
        "NO_OPEN_PERIOD",
        "No open accounting period is configured for this posting date.",
        409
      );
    }

    // 6. Revalidate status under row lock
    if (lockedPeriod.status === "CLOSED") {
      throw new PeriodDomainError(
        "PERIOD_CLOSED",
        `Accounting period '${lockedPeriod.name}' is closed for posting.`,
        409
      );
    }

    if (lockedPeriod.status === "LOCKED") {
      throw new PeriodDomainError(
        "PERIOD_LOCKED",
        `Accounting period '${lockedPeriod.name}' is locked for posting.`,
        409
      );
    }

    return lockedPeriod;
  }
}
