import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { formatCentavosToPesos } from "@/lib/accounting/money";
import { LedgerService } from "@/lib/accounting/ledgerService";
import { PeriodService, PeriodDomainError } from "@/lib/accounting/periodService";
import { IdempotencyService, IdempotencyDomainError } from "@/lib/accounting/idempotencyService";
import { DeductionCategory } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const deductions = await prisma.financialDeduction.findMany({
      orderBy: { date: "desc" },
      take: 100,
    });

    const formatted = deductions.map((d) => ({
      id: d.id,
      date: d.date.toISOString(),
      category: d.category,
      description: d.description,
      amountCentavos: d.amountCentavos,
      amountPesos: formatCentavosToPesos(d.amountCentavos),
      reference: d.reference,
      notes: d.notes,
      periodId: d.periodId,
    }));

    return NextResponse.json({ success: true, deductions: formatted });
  } catch (error) {
    console.error("[ADMIN_DEDUCTIONS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch deductions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const idempotencyKey = IdempotencyService.parseAndValidateIdempotencyKey(request);

    const body = await request.json();
    const { category, description, amountPesos, reference, notes } = body;

    // 1. Description validation and normalization
    if (typeof description !== "string") {
      return NextResponse.json({ error: "Description must be a string" }, { status: 400 });
    }
    const normalizedDescription = description.trim();
    if (normalizedDescription.length === 0) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    // 2. Amount validation and normalization
    const numericAmount =
      typeof amountPesos === "number"
        ? amountPesos
        : typeof amountPesos === "string" && amountPesos.trim() !== ""
          ? Number(amountPesos)
          : NaN;

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: "Positive numeric amount is required" }, { status: 400 });
    }

    const amountCentavos = Math.round(numericAmount * 100);
    if (!Number.isSafeInteger(amountCentavos) || amountCentavos <= 0) {
      return NextResponse.json({ error: "Valid positive amount in centavos is required" }, { status: 400 });
    }

    // 3. Category validation and normalization
    let normalizedCategory: DeductionCategory = DeductionCategory.OTHER_EXPENSE;
    if (category !== undefined && category !== null) {
      if (typeof category !== "string") {
        return NextResponse.json({ error: "Category must be a string if provided" }, { status: 400 });
      }
      const trimmedCategory = category.trim();
      if (trimmedCategory && Object.values(DeductionCategory).includes(trimmedCategory as DeductionCategory)) {
        normalizedCategory = trimmedCategory as DeductionCategory;
      } else if (trimmedCategory) {
        normalizedCategory = DeductionCategory.OTHER_EXPENSE;
      }
    }

    // 4. Optional reference and notes validation and normalization
    let normalizedReference: string | null = null;
    if (reference !== undefined && reference !== null) {
      if (typeof reference !== "string") {
        return NextResponse.json({ error: "Reference must be a string if provided" }, { status: 400 });
      }
      normalizedReference = reference.trim() || null;
    }

    let normalizedNotes: string | null = null;
    if (notes !== undefined && notes !== null) {
      if (typeof notes !== "string") {
        return NextResponse.json({ error: "Notes must be a string if provided" }, { status: 400 });
      }
      normalizedNotes = notes.trim() || null;
    }

    const postingTime = new Date();

    const requestHash = idempotencyKey
      ? IdempotencyService.hashCanonicalPayload({
          amountCentavos,
          category: normalizedCategory,
          description: normalizedDescription,
          reference: normalizedReference,
          notes: normalizedNotes,
        })
      : null;

    let resultPayload: { deduction: any; isReplay: boolean } | null = null;

    try {
      resultPayload = await prisma.$transaction(async (tx) => {
        // 1. Level 0: Acquire idempotency lock and check existing record if key is supplied
        if (idempotencyKey) {
          await IdempotencyService.acquireIdempotencyLock(
            tx,
            user.id,
            "MANUAL_DEDUCTION",
            idempotencyKey
          );

          const existingRecord = await IdempotencyService.findAuthoritativeIdempotencyRecord(
            tx,
            user.id,
            "MANUAL_DEDUCTION",
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

            const existingDeduction = await tx.financialDeduction.findUnique({
              where: { id: existingRecord.resourceId },
            });

            if (!existingDeduction) {
              throw new IdempotencyDomainError(
                "IDEMPOTENCY_RESOURCE_NOT_FOUND",
                "Referenced financial deduction record not found.",
                500
              );
            }

            return {
              deduction: existingDeduction,
              isReplay: true,
            };
          }
        }

        // 2. Lock and resolve covering open accounting period
        const period = await PeriodService.lockAndResolveOpenPeriodForPosting(tx, postingTime);

        // 3. Create FinancialDeduction with periodId and date
        const d = await tx.financialDeduction.create({
          data: {
            category: normalizedCategory,
            description: normalizedDescription,
            amountCentavos,
            reference: normalizedReference,
            notes: normalizedNotes,
            periodId: period.id,
            date: postingTime,
            createdBy: user.id,
            approvedBy: user.id,
          },
        });

        // 4. Post to double-entry ledger: Debit EXPENSE_OPERATIONAL, Credit CASH_PAYMONGO
        await LedgerService.postBalancedDoubleEntry(
          {
            transactionType: "DEDUCTION_EXPENSE",
            debitCategory: "EXPENSE_OPERATIONAL",
            creditCategory: "CASH_PAYMONGO",
            amountCentavos,
            sourceEntity: "FinancialDeduction",
            sourceId: d.id,
            description: `Operational Expense (${d.category}): ${d.description}`,
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
            operationType: "MANUAL_DEDUCTION",
            idempotencyKey,
            requestHash,
            resourceId: d.id,
          });
        }

        return {
          deduction: d,
          isReplay: false,
        };
      });
    } catch (err: any) {
      if (err instanceof PeriodDomainError || err instanceof IdempotencyDomainError) {
        throw err;
      }

      // Defensive composite idempotency P2002 recovery from outside aborted transaction
      if (idempotencyKey && IdempotencyService.isIdempotencyCompositeP2002(err)) {
        const fallbackRecord = await IdempotencyService.findAuthoritativeIdempotencyRecord(
          prisma,
          user.id,
          "MANUAL_DEDUCTION",
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

          const existingDeduction = await prisma.financialDeduction.findUnique({
            where: { id: fallbackRecord.resourceId },
          });

          if (!existingDeduction) {
            throw new IdempotencyDomainError(
              "IDEMPOTENCY_RESOURCE_NOT_FOUND",
              "Referenced financial deduction record not found.",
              500
            );
          }

          resultPayload = {
            deduction: existingDeduction,
            isReplay: true,
          };
        } else {
          throw new IdempotencyDomainError(
            "IDEMPOTENCY_INCONSISTENT_STATE",
            "Idempotency record is in an inconsistent state.",
            500
          );
        }
      } else {
        throw err;
      }
    }

    if (!resultPayload) {
      throw new Error("Failed to record deduction");
    }

    const responseHeaders: Record<string, string> = {};
    if (resultPayload.isReplay) {
      responseHeaders["X-Idempotent-Replay"] = "true";
    }

    return NextResponse.json(
      {
        success: true,
        deduction: resultPayload.deduction,
        message: resultPayload.isReplay
          ? "Operational deduction replayed from previous successful submission."
          : "Operational deduction recorded in accounting ledger!",
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
    console.error("[ADMIN_DEDUCTIONS_POST_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to record deduction" }, { status: 500 });
  }
}
