import { NextResponse } from "next/server";
import { logger } from "@/lib/logger/logger";

export interface DomainErrorLike {
  isDomainError?: boolean;
  name?: string;
  message: string;
  statusCode?: number;
  status?: number;
}

export function handleAccountingError(
  contextTag: string,
  error: unknown,
  metadata?: Record<string, unknown>
): NextResponse {
  const err = error as DomainErrorLike;

  if (err?.name === "PartnerOnboardingError") {
    const code = (error as { code?: string })?.code;
    const status = code === "NOT_FOUND" ? 404 : code === "MISSING_EMAIL" ? 400 : 409;
    return NextResponse.json({ error: err.message }, { status });
  }

  if (
    err?.isDomainError ||
    err?.name === "AccountingDomainError" ||
    err?.name === "PeriodDomainError" ||
    err?.name === "IdempotencyDomainError"
  ) {
    const status = err.statusCode || err.status || 400;
    return NextResponse.json({ error: err.message }, { status });
  }

  logger.error(`[${contextTag}] Internal Failure`, error, metadata);

  return NextResponse.json(
    { error: "A processing error occurred. The operation could not be completed." },
    { status: 500 }
  );
}
