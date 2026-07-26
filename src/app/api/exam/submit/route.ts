import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordUserActivityStreak } from "@/lib/streakEngine";

interface SubmittedAnswer {
  questionId: string;
  selectedOption?: string | number;
  selectedIndex?: number;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = String(session.userId);
    const body = await request.json();
    
    const { answers, totalItems }: { answers: SubmittedAnswer[]; totalItems: number } = body;

    if (!Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid answers payload" }, { status: 400 });
    }

    // 1. Fetch questions from DB with official answerIndex field
    const questionIds = answers.map((a) => a.questionId);
    const dbQuestions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, answerIndex: true, options: true },
    });

    const questionMap = new Map(dbQuestions.map((q) => [q.id, q]));

    // 2. Grade answers strictly on the server
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;

    for (const ans of answers) {
      const q = questionMap.get(ans.questionId);
      if (!q) {
        skipped++;
        continue;
      }

      // Resolve submitted answer index (0, 1, 2, 3)
      let userIdx: number | null = null;

      if (typeof ans.selectedIndex === "number" && ans.selectedIndex >= 0) {
        userIdx = ans.selectedIndex;
      } else if (typeof ans.selectedOption === "number" && ans.selectedOption >= 0) {
        userIdx = ans.selectedOption;
      } else if (typeof ans.selectedOption === "string" && ans.selectedOption.trim() !== "") {
        const val = ans.selectedOption.trim();
        const letterIdx = ["A", "B", "C", "D"].indexOf(val.toUpperCase());
        if (letterIdx !== -1) {
          userIdx = letterIdx;
        } else if (!isNaN(Number(val))) {
          userIdx = Number(val);
        } else if (Array.isArray(q.options)) {
          userIdx = q.options.indexOf(val);
        }
      }

      if (userIdx === null || userIdx < 0) {
        skipped++;
      } else if (userIdx === q.answerIndex) {
        correct++;
      } else {
        incorrect++;
      }
    }

    // Calculate score percentage
    const itemsCount = totalItems || answers.length;
    const score = itemsCount > 0 ? Math.round((correct / itemsCount) * 100) : 0;

    // 3. Save verified result to Neon DB
    const result = await prisma.examResult.create({
      data: {
        userId,
        score,
        totalItems: itemsCount,
        correct,
        incorrect,
        skipped,
      },
    });

    // Record active study streak
    const updatedStreak = await recordUserActivityStreak(userId).catch(() => null);

    // Clear active exam draft
    await prisma.examDraft.delete({
      where: { userId },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      result,
      streak: updatedStreak?.currentStreak || 1,
    });
  } catch (error) {
    console.error("Exam submission error:", error);
    return NextResponse.json({ error: "Failed to process exam result" }, { status: 500 });
  }
}