// Relative Path: src/app/api/questions/daily/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordUserActivityStreak } from "@/lib/streakEngine";

function getTodayDateString(): string {
  // Use Philippines Time (UTC+8) for all examinees
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const pht = new Date(utc + 3600000 * 8);
  return pht.toISOString().split("T")[0]; // YYYY-MM-DD
}

function stringToHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    let userId: string | null = null;

    if (token) {
      const session = await verifyJWT(token).catch(() => null);
      if (session?.userId) userId = String(session.userId);
    }

    const dateString = getTodayDateString();

    // 1. Fetch total count of active questions
    const totalQuestions = await prisma.question.count({
      where: { deletedAt: null },
    });

    if (totalQuestions === 0) {
      return NextResponse.json({ error: "No active questions available" }, { status: 404 });
    }

    // 2. Select deterministic question for today
    const questionIndex = stringToHash(dateString) % totalQuestions;
    const todayQuestions = await prisma.question.findMany({
      where: { deletedAt: null },
      skip: questionIndex,
      take: 1,
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
        imageUrl: true,
      },
    });

    const question = todayQuestions[0];
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const options =
      Array.isArray(question.options) && question.options.length > 0
        ? question.options
        : [question.optionA, question.optionB, question.optionC, question.optionD].filter(Boolean);

    // 3. Check if user already answered today
    let userAttempt: any = null;
    if (userId) {
      userAttempt = await prisma.dailyQuestionAttempt.findUnique({
        where: {
          userId_dateString: {
            userId,
            dateString,
          },
        },
      });
    }

    // 4. Compute community stats for today's question
    const allAttempts = await prisma.dailyQuestionAttempt.findMany({
      where: { dateString, questionId: question.id },
      select: { userAnswer: true, isCorrect: true },
    });

    const totalCommunityAttempts = allAttempts.length;
    const correctCount = allAttempts.filter((a) => a.isCorrect).length;
    const communityAccuracy = totalCommunityAttempts > 0 ? Math.round((correctCount / totalCommunityAttempts) * 100) : 100;

    // Option distribution counts
    const distribution = [0, 0, 0, 0, 0];
    for (const a of allAttempts) {
      if (typeof a.userAnswer === "number" && a.userAnswer >= 0 && a.userAnswer < distribution.length) {
        distribution[a.userAnswer] += 1;
      }
    }

    // If not answered yet, redact answerIndex and explanation to prevent cheating
    const hasAnswered = Boolean(userAttempt);

    return NextResponse.json({
      success: true,
      dateString,
      hasAnswered,
      userAttempt: userAttempt
        ? {
            userAnswer: userAttempt.userAnswer,
            isCorrect: userAttempt.isCorrect,
            createdAt: userAttempt.createdAt,
          }
        : null,
      question: {
        id: question.id,
        category: question.category,
        subtopic: question.subtopic,
        prompt: question.prompt,
        options,
        imageUrl: question.imageUrl,
        answerIndex: hasAnswered ? question.answerIndex : null,
        explanation: hasAnswered ? question.explanation : null,
      },
      communityStats: {
        totalAttempts: totalCommunityAttempts,
        communityAccuracy,
        distribution,
      },
    });
  } catch (error: any) {
    console.error("[DAILY_QUESTION_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch daily question", details: error?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const userId = session?.userId ? String(session.userId) : null;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { questionId, selectedIndex } = body;

    if (!questionId || typeof selectedIndex !== "number") {
      return NextResponse.json({ error: "Invalid question ID or selected option" }, { status: 400 });
    }

    const dateString = getTodayDateString();

    // Check if user already submitted today
    const existingAttempt = await prisma.dailyQuestionAttempt.findUnique({
      where: {
        userId_dateString: {
          userId,
          dateString,
        },
      },
    });

    if (existingAttempt) {
      return NextResponse.json({
        error: "You have already completed today's challenge!",
        attempt: existingAttempt,
      }, { status: 400 });
    }

    // Verify question and evaluate answer
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        answerIndex: true,
        explanation: true,
      },
    });

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const isCorrect = selectedIndex === question.answerIndex;

    // Record attempt
    const attempt = await prisma.dailyQuestionAttempt.create({
      data: {
        userId,
        dateString,
        questionId,
        userAnswer: selectedIndex,
        isCorrect,
      },
    });

    // Record active study streak
    const streakResult = await recordUserActivityStreak(userId).catch(() => null);

    // If incorrect, automatically ingest into UserMistake (Balik-Aral Notebook)
    if (!isCorrect) {
      try {
        await prisma.userMistake.upsert({
          where: {
            userId_questionId: { userId, questionId },
          },
          create: {
            userId,
            questionId,
            userAnswer: selectedIndex,
            incorrectCount: 1,
            isMastered: false,
            lastAttemptAt: new Date(),
          },
          update: {
            userAnswer: selectedIndex,
            incorrectCount: { increment: 1 },
            isMastered: false,
            lastAttemptAt: new Date(),
          },
        });
      } catch (e) {
        console.error("Failed to log daily mistake:", e);
      }
    }

    // Fetch updated community distribution
    const allAttempts = await prisma.dailyQuestionAttempt.findMany({
      where: { dateString, questionId: question.id },
      select: { userAnswer: true, isCorrect: true },
    });

    const totalCommunityAttempts = allAttempts.length;
    const correctCount = allAttempts.filter((a) => a.isCorrect).length;
    const communityAccuracy = Math.round((correctCount / totalCommunityAttempts) * 100);

    const distribution = [0, 0, 0, 0, 0];
    for (const a of allAttempts) {
      if (typeof a.userAnswer === "number" && a.userAnswer >= 0 && a.userAnswer < distribution.length) {
        distribution[a.userAnswer] += 1;
      }
    }

    return NextResponse.json({
      success: true,
      isCorrect,
      correctAnswerIndex: question.answerIndex,
      explanation: question.explanation,
      streak: streakResult?.currentStreak || 1,
      attempt,
      communityStats: {
        totalAttempts: totalCommunityAttempts,
        communityAccuracy,
        distribution,
      },
    });
  } catch (error: any) {
    console.error("[DAILY_QUESTION_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to submit daily question", details: error?.message }, { status: 500 });
  }
}
