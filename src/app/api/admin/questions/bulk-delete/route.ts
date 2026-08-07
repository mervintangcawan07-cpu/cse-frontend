// Relative Path: src/app/api/admin/questions/bulk-delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSudo } from "@/middleware/requireSudo";

export const DELETE = requireSudo(async (request: NextRequest) => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId || session.role !== "ADMIN") {
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
        deletedBy: String(session.userId),
      },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("[BULK_DELETE_QUESTIONS_ERROR]", error);
    return NextResponse.json({ error: "Failed to soft-delete questions" }, { status: 500 });
  }
});
