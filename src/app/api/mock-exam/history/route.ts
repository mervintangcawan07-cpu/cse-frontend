import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    const userId = String(session?.userId || session?.id || "");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let attempts: any[] = [];

    // Fetch ALL completed exams (No 'take: 3' restriction)
    try {
      attempts = await prisma.examResult.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
    } catch (e) {
      if ((prisma as any).examAttempt) {
        attempts = await (prisma as any).examAttempt.findMany({
          where: { userId },
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