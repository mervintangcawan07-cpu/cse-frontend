// Relative Path: src/app/api/admin/questions/bulk-delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";
import { softDeleteBankQuestions } from "@/lib/questionBank";
import { questionBankErrorResponse } from "@/lib/contentEligibility";
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

    const count = await softDeleteBankQuestions("ORDINARY", ids, authentication.session.user.id);

    return NextResponse.json({ success: true, count });
  } catch (error) {
    const bankError = questionBankErrorResponse(error);
    if (bankError) return new NextResponse(bankError.body, { status: bankError.status, headers: bankError.headers });
    console.error("[BULK_DELETE_QUESTIONS_ERROR]", error);
    return NextResponse.json({ error: "Failed to soft-delete questions" }, { status: 500 });
  }
});
