// Relative Path: src/app/api/admin/accounting/reconciliation/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

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

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        code: "LEGACY_RECONCILIATION_WRITE_DISABLED",
        error:
          "Legacy reconciliation writes are disabled pending durable reconciliation cutover.",
      },
      { status: 409 }
    );
  } catch (error) {
    console.error("[ADMIN_RECONCILIATION_POST_ERROR]", error);

    return NextResponse.json(
      { error: "Reconciliation request failed" },
      { status: 500 }
    );
  }
}
