// Relative Path: src/app/api/admin/questions/bulk-delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { requireSudo } from "@/middleware/requireSudo";

export const DELETE = requireSudo(async (request: NextRequest) => {
  try {
    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated && authentication.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !authentication.authenticated ||
      authentication.session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No question IDs provided" }, { status: 400 });
    }

    // Soft delete all matching questions in a single query
    const result = await prisma.question.updateMany({
      where: { id: { in: ids } },
      data: {
        deletedAt: new Date(),
        deletedBy: authentication.session.user.id,
      },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("[BULK_DELETE_QUESTIONS_ERROR]", error);
    return NextResponse.json({ error: "Failed to soft-delete questions" }, { status: 500 });
  }
});
