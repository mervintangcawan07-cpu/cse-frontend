import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordUserActivityStreak } from "@/lib/streakEngine";
import { evaluateAndAwardBadges } from "@/lib/badges";

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

    // 1. Fetch full questions from DB to build complete review snapshot
    const questionIds = answers.map((a) => a.questionId);
    const dbQuestions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        category: true,
        subtopic: true,
        prompt: true,
        options: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        answerIndex: true,
        explanation: true,
      },
    });

    const questionMap = new Map(dbQuestions.map((q) => [q.id, q]));

    // 2. Grade answers strictly on the server & build details snapshot
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    const detailsSnapshot: any[] = [];

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

      // Format options array
      const resolvedOptions =
        Array.isArray(q.options) && q.options.length > 0
          ? q.options
          : [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean);

      // Build question snapshot item
      detailsSnapshot.push({
        id: q.id,
        category: q.category || "General",
        subtopic: q.subtopic || "General",
        prompt: q.prompt,
        options: resolvedOptions,
        answerIndex: q.answerIndex,
        selectedIndex: userIdx,
        explanation: q.explanation || null,
      });
    }

    // Calculate score percentage
    const itemsCount = totalItems || answers.length;
    const score = itemsCount > 0 ? Math.round((correct / itemsCount) * 100) : 0;

    // 3. Save verified result with full detailsJson snapshot (ALL EXAMS KEPT FOR PROGRESSION LOGS)
    const result = await prisma.examResult.create({
      data: {
        userId,
        score,
        totalItems: itemsCount,
        correct,
        incorrect,
        skipped,
        detailsJson: JSON.stringify(detailsSnapshot),
      },
    });

    // 4. Ingest incorrect questions into the Smart Mistake Notebook (Balik-Aral)
    const incorrectItems = detailsSnapshot.filter(
      (item) => item.selectedIndex !== null && item.selectedIndex !== item.answerIndex
    );

    if (incorrectItems.length > 0) {
      await Promise.all(
        incorrectItems.map(async (item) => {
          try {
            await prisma.userMistake.upsert({
              where: {
                userId_questionId: {
                  userId,
                  questionId: item.id,
                },
              },
              create: {
                userId,
                questionId: item.id,
                userAnswer: item.selectedIndex,
                incorrectCount: 1,
                isMastered: false,
                lastAttemptAt: new Date(),
              },
              update: {
                userAnswer: item.selectedIndex,
                incorrectCount: { increment: 1 },
                isMastered: false,
                lastAttemptAt: new Date(),
              },
            });
          } catch (e) {
            console.error("Failed to record mistake for question", item.id, e);
          }
        })
      );
    }

    // Record active study streak
    const updatedStreak = await recordUserActivityStreak(userId).catch(() => null);

    // Evaluate and award badges (fire-and-forget, non-blocking)
    evaluateAndAwardBadges(userId).catch(() => null);

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