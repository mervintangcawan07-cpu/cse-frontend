import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordUserActivityStreak } from "@/lib/streakEngine";

interface SubmittedAnswer {
  questionId: string;
  selectedOption: string; // e.g. "A", "B", "C", "D"
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
    
    // Expect user answers array from frontend instead of client-calculated score
    const { answers, totalItems }: { answers: SubmittedAnswer[]; totalItems: number } = body;

    if (!Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid answers payload" }, { status: 400 });
    }

    // 1. Fetch official correct answers from DB for the submitted questions
    const questionIds = answers.map((a) => a.questionId);
    const dbQuestions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, correctAnswer: true },
    });

    const questionMap = new Map(dbQuestions.map((q) => [q.id, q.correctAnswer]));

    // 2. Grade the answers strictly on the server
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;

    for (const ans of answers) {
      if (!ans.selectedOption) {
        skipped++;
        continue;
      }

      const correctAnswer = questionMap.get(ans.questionId);
      if (correctAnswer && ans.selectedOption === correctAnswer) {
        correct++;
      } else {
        incorrect++;
      }
    }

    // Calculate score on the server (Percentage)
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

    // ⚡ Record active study streak automatically
    const updatedStreak = await recordUserActivityStreak(userId);

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