import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/serverAuth";
import { activeOrdinaryQuestionWhere } from "@/lib/contentEligibility";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const [totalUsers, paidUsers, totalQuestions, totalExams] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.user.count({ where: { isPaid: true } }).catch(() => 0),
      prisma.question.count({ where: activeOrdinaryQuestionWhere() }).catch(() => 0),
      prisma.examResult.count().catch(() => 0),
    ]);

    return NextResponse.json({ totalUsers, paidUsers, totalQuestions, totalExams });
  } catch (error) {
    console.error("[ADMIN_STATS_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch administrative statistics." },
      { status: 500 }
    );
  }
}
