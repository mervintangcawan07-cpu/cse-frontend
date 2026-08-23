import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/serverAuth";
import { LedgerService } from "@/lib/accounting/ledgerService";
import { PeriodService, PeriodDomainError } from "@/lib/accounting/periodService";
import { IdempotencyService, IdempotencyDomainError } from "@/lib/accounting/idempotencyService";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

function generateAdjustmentNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `ADJ-${dateStr}-${randomHex}`;
}

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adjustments = await prisma.financialAdjustment.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, adjustments });
  } catch (error) {
    console.error("[ADMIN_ADJUSTMENTS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch adjustments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const idempotencyKey = IdempotencyService.parseAndValidateIdempotencyKey(request);

    const body = await request.json();
    const { amountPesos, direction, category, reason, reference } = body;

    if (!amountPesos || amountPesos <= 0 || !reason) {
      return NextResponse.json({ error: "Positive amount and reason are required" }, { status: 400 });
    }

    const normalizedDirection = direction ?? "DEBIT";
    if (normalizedDirection !== "DEBIT" && normalizedDirection !== "CREDIT") {
      return NextResponse.json(
        { error: "Invalid adjustment direction. Must be DEBIT or CREDIT." },
        { status: 400 }
      );
    }

    const amountCentavos = Math.round(Number(amountPesos) * 100);
    const postingTime = new Date();

    const requestHash = idempotencyKey
      ? IdempotencyService.hashCanonicalPayload({
          amountCentavos,
          direction: normalizedDirection,
          category: category || "MANUAL_REVERSAL",
          reason: reason.trim(),
          reference: reference?.trim() || null,
        })
      : null;

    const MAX_ATTEMPTS = 3;
    let resultPayload: { adjustment: any; isReplay: boolean; adjustmentNumber: string } | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const candidateAdjustmentNumber = generateAdjustmentNumber();
      try {
        resultPayload = await prisma.$transaction(async (tx) => {
          // 1. Level 0: Acquire idempotency lock and check existing record if key is supplied
          if (idempotencyKey) {
            await IdempotencyService.acquireIdempotencyLock(
              tx,
              user.id,
              "MANUAL_ADJUSTMENT",
              idempotencyKey
            );

            const existingRecord = await IdempotencyService.findAuthoritativeIdempotencyRecord(
              tx,
              user.id,
              "MANUAL_ADJUSTMENT",
              idempotencyKey
            );

            if (existingRecord) {
              if (existingRecord.requestHash !== requestHash) {
                throw new IdempotencyDomainError(
                  "IDEMPOTENCY_PAYLOAD_MISMATCH",
                  "Idempotency key was previously used with a different request.",
                  409
                );
              }

              const existingAdj = await tx.financialAdjustment.findUnique({
                where: { id: existingRecord.resourceId },
              });

              if (!existingAdj) {
                throw new IdempotencyDomainError(
                  "IDEMPOTENCY_RESOURCE_NOT_FOUND",
                  "Referenced financial adjustment record not found.",
                  500
                );
              }

              return {
                adjustment: existingAdj,
                isReplay: true,
                adjustmentNumber: existingAdj.adjustmentNumber,
              };
            }
          }

          // 2. Lock and resolve covering open accounting period
          const period = await PeriodService.lockAndResolveOpenPeriodForPosting(tx, postingTime);

          // 3. Create FinancialAdjustment
          const adj = await tx.financialAdjustment.create({
            data: {
              adjustmentNumber: candidateAdjustmentNumber,
              amountCentavos,
              direction: normalizedDirection,
              category: category || "MANUAL_REVERSAL",
              reason: reason.trim(),
              reference: reference?.trim() || null,
              status: "APPROVED",
              createdBy: user.id,
              approvedBy: user.id,
              approvedAt: new Date(),
            },
          });

          // 4. Balanced double entry: ADJUSTMENT_SUSPENSE vs CASH_PAYMONGO
          const debitCat = normalizedDirection === "DEBIT" ? "ADJUSTMENT_SUSPENSE" : "CASH_PAYMONGO";
          const creditCat = normalizedDirection === "DEBIT" ? "CASH_PAYMONGO" : "ADJUSTMENT_SUSPENSE";

          await LedgerService.postBalancedDoubleEntry(
            {
              transactionType: "MANUAL_ADJUSTMENT",
              debitCategory: debitCat,
              creditCategory: creditCat,
              amountCentavos,
              sourceEntity: "FinancialAdjustment",
              sourceId: adj.id,
              description: `Manual adjustment ${candidateAdjustmentNumber}: ${adj.reason}`,
              effectiveDate: postingTime,
              periodId: period.id,
              createdBy: user.id,
            },
            tx
          );

          // 5. Persist durable FinancialIdempotencyKey record inside same transaction
          if (idempotencyKey && requestHash) {
            await IdempotencyService.recordFinancialIdempotency(tx, {
              actorId: user.id,
              operationType: "MANUAL_ADJUSTMENT",
              idempotencyKey,
              requestHash,
              resourceId: adj.id,
            });
          }

          return {
            adjustment: adj,
            isReplay: false,
            adjustmentNumber: candidateAdjustmentNumber,
          };
        });

        break; // Successfully committed transaction
      } catch (err: any) {
        if (err instanceof PeriodDomainError || err instanceof IdempotencyDomainError) {
          throw err; // Domain errors must not trigger ID collision retries
        }

        const isAdjustmentNumberCollision =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          (Array.isArray(err.meta?.target)
            ? err.meta.target.includes("adjustmentNumber")
            : typeof err.meta?.target === "string" && err.meta.target.includes("adjustmentNumber"));

        if (isAdjustmentNumberCollision && attempt < MAX_ATTEMPTS) {
          console.warn(
            `[ADMIN_ADJUSTMENTS] Collision on adjustmentNumber ${candidateAdjustmentNumber}. Retrying (attempt ${attempt + 1}/${MAX_ATTEMPTS})...`
          );
          continue;
        }

        // Defensive composite idempotency P2002 recovery from outside aborted transaction
        if (idempotencyKey && IdempotencyService.isIdempotencyCompositeP2002(err)) {
          const fallbackRecord = await IdempotencyService.findAuthoritativeIdempotencyRecord(
            prisma,
            user.id,
            "MANUAL_ADJUSTMENT",
            idempotencyKey
          );

          if (fallbackRecord) {
            if (fallbackRecord.requestHash !== requestHash) {
              throw new IdempotencyDomainError(
                "IDEMPOTENCY_PAYLOAD_MISMATCH",
                "Idempotency key was previously used with a different request.",
                409
              );
            }

            const existingAdj = await prisma.financialAdjustment.findUnique({
              where: { id: fallbackRecord.resourceId },
            });

            if (!existingAdj) {
              throw new IdempotencyDomainError(
                "IDEMPOTENCY_RESOURCE_NOT_FOUND",
                "Referenced financial adjustment record not found.",
                500
              );
            }

            resultPayload = {
              adjustment: existingAdj,
              isReplay: true,
              adjustmentNumber: existingAdj.adjustmentNumber,
            };
            break;
          } else {
            throw new IdempotencyDomainError(
              "IDEMPOTENCY_INCONSISTENT_STATE",
              "Idempotency record is in an inconsistent state.",
              500
            );
          }
        }

        throw err;
      }
    }

    if (!resultPayload) {
      throw new Error("Failed to process financial adjustment");
    }

    const responseHeaders: Record<string, string> = {};
    if (resultPayload.isReplay) {
      responseHeaders["X-Idempotent-Replay"] = "true";
    }

    return NextResponse.json(
      {
        success: true,
        adjustment: resultPayload.adjustment,
        message: resultPayload.isReplay
          ? `Adjustment ${resultPayload.adjustmentNumber} replayed from previous successful submission.`
          : `Adjustment ${resultPayload.adjustmentNumber} created and posted to ledger!`,
      },
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error: any) {
    if (error instanceof IdempotencyDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof PeriodDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[ADMIN_ADJUSTMENTS_POST_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to create adjustment" }, { status: 500 });
  }
}
