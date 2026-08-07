// Relative Path: src/app/api/admin/questions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { requireSudo } from "@/middleware/requireSudo";
import { softDeleteRecord } from "@/lib/recovery/softDelete";

export const DELETE = requireSudo(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await softDeleteRecord("question", id, String(session.userId));

    return NextResponse.json({ success: true, message: "Question soft-deleted successfully." });
  } catch (error) {
    console.error("[SINGLE_QUESTION_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
});