import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authenticatedUser.id;

    let attempts: any[] = [];

    // Fetch ALL completed exams with lightweight projection (excluding heavy detailsJson)
    try {
      attempts = await prisma.examResult.findMany({
        where: { userId },
        select: {
          id: true,
          score: true,
          totalItems: true,
          correct: true,
          incorrect: true,
          skipped: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (e) {
      if ((prisma as any).examAttempt) {
        attempts = await (prisma as any).examAttempt.findMany({
          where: { userId },
          select: {
            id: true,
            score: true,
            totalItems: true,
            correct: true,
            incorrect: true,
            skipped: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        });
      }
    }

    // Format fields seamlessly
    const formattedAttempts = attempts.map((item) => {
      const total = item.totalItems || 170;
      const correct = item.correct ?? item.score ?? 0;
      const percentage = item.percentage ?? Math.round((correct / total) * 100);

      return {
        id: item.id,
        score: correct,
        totalItems: total,
        percentage: percentage,
        correct: correct,
        incorrect: item.incorrect ?? (total - correct),
        skipped: item.skipped ?? 0,
        createdAt: item.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      attempts: formattedAttempts,
      history: formattedAttempts,
    });
  } catch (error: any) {
    console.error("[MOCK_EXAM_HISTORY_FETCH_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch mock exam history.", details: error?.message },
      { status: 500 }
    );
  }
}
