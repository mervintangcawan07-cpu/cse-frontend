import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get("userId");

    // Authenticate via session cookie if userId param isn't provided directly
    if (!userId) {
      const cookieStore = await cookies();
      const token = cookieStore.get("cse_session")?.value;
      if (token) {
        const session = await verifyJWT(token);
        userId = String(session?.userId || session?.id || "");
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: Missing user authentication" }, { status: 401 });
    }

    // Try fetching from ExamResult first, with fallback to examAttempt
    let history: any[] = [];
    try {
      history = await prisma.examResult.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
    } catch (dbErr) {
      if ((prisma as any).examAttempt) {
        history = await (prisma as any).examAttempt.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
      }
    }

    // Standardize object fields
    const formattedHistory = history.map((item) => ({
      id: item.id,
      score: item.score ?? item.correct ?? 0,
      totalItems: item.totalItems ?? 170,
      percentage: item.percentage ?? (item.totalItems ? Math.round((item.correct / item.totalItems) * 100) : item.score),
      correct: item.correct ?? item.score ?? 0,
      incorrect: item.incorrect ?? 0,
      skipped: item.skipped ?? 0,
      createdAt: item.createdAt,
    }));

    return NextResponse.json({ history: formattedHistory, attempts: formattedHistory }, { status: 200 });
  } catch (error: any) {
    console.error("[EXAMS_HISTORY_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch exam history", details: error?.message },
      { status: 500 }
    );
  }
}