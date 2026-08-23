// Relative Path: src/app/api/admin/accounting/adjustments/route.ts
import crypto from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { LedgerService } from "@/lib/accounting/ledgerService";
import { formatCentavosToPesos } from "@/lib/accounting/money";

function generateAdjustmentNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().replace(/[-:T]/g, "").slice(2, 14); // YYMMDDHHMMSS in UTC
  const randomHex = crypto.randomBytes(8).toString("hex").toUpperCase(); // 16 hex chars (64-bit entropy)
  return `ADJ-${datePart}-${randomHex}`;
}

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const adjustments = await prisma.financialAdjustment.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const formatted = adjustments.map((a) => ({
      id: a.id,
      adjustmentNumber: a.adjustmentNumber,
      amountCentavos: a.amountCentavos,
      formattedAmount: formatCentavosToPesos(a.amountCentavos),
      direction: a.direction,
      category: a.category,
      reason: a.reason,
      reference: a.reference,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, adjustments: formatted });
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

    const body = await request.json();
    const { amountPesos, direction, category, reason, reference } = body;

    if (!amountPesos || amountPesos <= 0 || !reason) {
      return NextResponse.json({ error: "Positive amount and reason are required" }, { status: 400 });
    }

    const amountCentavos = Math.round(Number(amountPesos) * 100);

    const MAX_ATTEMPTS = 3;
    let createdAdjustment: any = null;
    let finalAdjustmentNumber = "";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const candidateAdjustmentNumber = generateAdjustmentNumber();
      try {
        createdAdjustment = await prisma.$transaction(async (tx) => {
          const adj = await tx.financialAdjustment.create({
            data: {
              adjustmentNumber: candidateAdjustmentNumber,
              amountCentavos,
              direction: direction || "DEBIT",
              category: category || "MANUAL_REVERSAL",
              reason: reason.trim(),
              reference: reference?.trim() || null,
              status: "APPROVED",
              createdBy: user.id,
              approvedBy: user.id,
              approvedAt: new Date(),
            },
          });

          // Balanced double entry: ADJUSTMENT_SUSPENSE vs CASH_PAYMONGO
          const debitCat = direction === "DEBIT" ? "ADJUSTMENT_SUSPENSE" : "CASH_PAYMONGO";
          const creditCat = direction === "DEBIT" ? "CASH_PAYMONGO" : "ADJUSTMENT_SUSPENSE";

          await LedgerService.postBalancedDoubleEntry(
            {
              transactionType: "MANUAL_ADJUSTMENT",
              debitCategory: debitCat,
              creditCategory: creditCat,
              amountCentavos,
              sourceEntity: "FinancialAdjustment",
              sourceId: adj.id,
              description: `Manual adjustment ${candidateAdjustmentNumber}: ${adj.reason}`,
              createdBy: user.id,
            },
            tx
          );

          return adj;
        });

        finalAdjustmentNumber = candidateAdjustmentNumber;
        break; // Successfully committed transaction
      } catch (err: any) {
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

        throw err;
      }
    }

    return NextResponse.json({
      success: true,
      adjustment: createdAdjustment,
      message: `Adjustment ${finalAdjustmentNumber} created and posted to ledger!`,
    });
  } catch (error: any) {
    console.error("[ADMIN_ADJUSTMENTS_POST_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to create adjustment" }, { status: 500 });
  }
}
