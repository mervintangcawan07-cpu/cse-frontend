// Relative Path: src/app/api/admin/questions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";
import { requireSudo } from "@/middleware/requireSudo";
import { softDeleteRecord } from "@/lib/recovery/softDelete";

export const DELETE = requireSudo(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated && authentication.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !authentication.authenticated ||
      authentication.session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await softDeleteRecord("question", id, authentication.session.user.id);

    return NextResponse.json({ success: true, message: "Question soft-deleted successfully." });
  } catch (error) {
    console.error("[SINGLE_QUESTION_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
});
