// Relative Path: src/app/api/admin/accounting/reconciliation/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { ReconciliationService } from "@/lib/accounting/reconciliationService";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;

    const where: any = {};
    if (status && status !== "ALL") where.status = status;

    const records = await prisma.reconciliationRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const [matchedCount, mismatchedCount, missingCount] = await Promise.all([
      prisma.reconciliationRecord.count({ where: { status: "MATCHED" } }),
      prisma.reconciliationRecord.count({ where: { status: "MISMATCHED" } }),
      prisma.reconciliationRecord.count({ where: { status: "MISSING" } }),
    ]);

    return NextResponse.json({
      success: true,
      stats: { matchedCount, mismatchedCount, missingCount },
      records,
    });
  } catch (error) {
    console.error("[ADMIN_RECONCILIATION_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch reconciliation records" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const results = await ReconciliationService.runBatchReconciliation();

    return NextResponse.json({
      success: true,
      reconciledCount: results.length,
      message: `Reconciliation completed for ${results.length} transactions!`,
    });
  } catch (error: any) {
    console.error("[ADMIN_RECONCILIATION_POST_ERROR]", error);
    return NextResponse.json({ error: error.message || "Reconciliation failed" }, { status: 500 });
  }
}
