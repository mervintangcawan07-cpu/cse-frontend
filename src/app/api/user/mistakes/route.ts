// Relative Path: src/app/api/user/mistakes/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "All";
    const status = searchParams.get("status") || "ACTIVE"; // ACTIVE | MASTERED | ALL
    const search = searchParams.get("search") || "";

    const whereClause: any = {
      userId,
    };

    if (status === "ACTIVE") {
      whereClause.isMastered = false;
    } else if (status === "MASTERED") {
      whereClause.isMastered = true;
    }

    if (category && category !== "All") {
      whereClause.question = {
        category,
      };
    }

    if (search.trim()) {
      whereClause.question = {
        ...(whereClause.question || {}),
        OR: [
          { prompt: { contains: search, mode: "insensitive" } },
          { subtopic: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    // Fetch user mistakes with full question details
    const mistakes = await prisma.userMistake.findMany({
      where: whereClause,
      include: {
        question: {
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
            stepByStep: true,
            whyA: true,
            whyB: true,
            whyC: true,
            whyD: true,
            eliminationStrategy: true,
            commonTrap: true,
            examTip: true,
            difficulty: true,
            tags: true,
          },
        },
      },
      orderBy: { lastAttemptAt: "desc" },
    });

    // Compute summary stats across all user mistakes
    const allUserMistakes = await prisma.userMistake.findMany({
      where: { userId },
      select: {
        id: true,
        isMastered: true,
        incorrectCount: true,
        correctCount: true,
        question: { select: { category: true } },
      },
    });

    const totalRecorded = allUserMistakes.length;
    const activeCount = allUserMistakes.filter((m) => !m.isMastered).length;
    const masteredCount = allUserMistakes.filter((m) => m.isMastered).length;
    const recoveryRate = totalRecorded > 0 ? Math.round((masteredCount / totalRecorded) * 100) : 0;

    // Category breakdown counts
    const categoryCounts: Record<string, { total: number; active: number; mastered: number }> = {};
    for (const m of allUserMistakes) {
      const cat = m.question?.category || "General";
      if (!categoryCounts[cat]) {
        categoryCounts[cat] = { total: 0, active: 0, mastered: 0 };
      }
      categoryCounts[cat].total += 1;
      if (m.isMastered) categoryCounts[cat].mastered += 1;
      else categoryCounts[cat].active += 1;
    }

    // Format mistakes response payload
    const formattedMistakes = mistakes.map((m) => {
      const q = m.question;
      const options =
        Array.isArray(q.options) && q.options.length > 0
          ? q.options
          : [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean);

      return {
        id: m.id,
        questionId: m.questionId,
        userAnswer: m.userAnswer,
        incorrectCount: m.incorrectCount,
        correctCount: m.correctCount,
        lastAttemptAt: m.lastAttemptAt,
        isMastered: m.isMastered,
        masteredAt: m.masteredAt,
        question: {
          ...q,
          options,
        },
      };
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalRecorded,
        activeCount,
        masteredCount,
        recoveryRate,
        categoryCounts,
      },
      mistakes: formattedMistakes,
    });
  } catch (error: any) {
    console.error("[USER_MISTAKES_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch mistakes notebook", details: error?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    const body = await request.json();
    const { questionId, selectedIndex, action } = body;

    if (!questionId) {
      return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

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

    const existing = await prisma.userMistake.findUnique({
      where: {
        userId_questionId: { userId, questionId },
      },
    });

    // Handle Manual Mastery Toggle Action
    if (action === "TOGGLE_MASTERED") {
      const newStatus = existing ? !existing.isMastered : true;
      const updated = await prisma.userMistake.upsert({
        where: { userId_questionId: { userId, questionId } },
        create: {
          userId,
          questionId,
          isMastered: true,
          masteredAt: new Date(),
          lastAttemptAt: new Date(),
        },
        update: {
          isMastered: newStatus,
          masteredAt: newStatus ? new Date() : null,
          lastAttemptAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, mistake: updated, isMastered: newStatus });
    }

    // Handle Practice Answer Evaluation
    if (typeof selectedIndex !== "number") {
      return NextResponse.json({ error: "Selected index is required for practice evaluation" }, { status: 400 });
    }

    const isCorrect = selectedIndex === question.answerIndex;
    const currentCorrectCount = existing ? existing.correctCount : 0;
    const newCorrectCount = isCorrect ? currentCorrectCount + 1 : 0;
    // An item is automatically mastered if correctly answered 2 times in a row
    const isMastered = newCorrectCount >= 2;

    const updated = await prisma.userMistake.upsert({
      where: { userId_questionId: { userId, questionId } },
      create: {
        userId,
        questionId,
        userAnswer: selectedIndex,
        incorrectCount: isCorrect ? 0 : 1,
        correctCount: newCorrectCount,
        isMastered,
        masteredAt: isMastered ? new Date() : null,
        lastAttemptAt: new Date(),
      },
      update: {
        userAnswer: selectedIndex,
        incorrectCount: isCorrect ? existing?.incorrectCount : (existing?.incorrectCount || 0) + 1,
        correctCount: newCorrectCount,
        isMastered,
        masteredAt: isMastered ? new Date() : existing?.masteredAt,
        lastAttemptAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      isCorrect,
      correctAnswerIndex: question.answerIndex,
      explanation: question.explanation,
      newCorrectCount,
      isMastered,
      mistake: updated,
    });
  } catch (error: any) {
    console.error("[USER_MISTAKES_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to process mistake practice", details: error?.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get("questionId");
    const action = searchParams.get("action");

    if (action === "CLEAR_MASTERED") {
      await prisma.userMistake.deleteMany({
        where: { userId, isMastered: true },
      });
      return NextResponse.json({ success: true, message: "Cleared all mastered mistakes" });
    }

    if (questionId) {
      await prisma.userMistake.deleteMany({
        where: { userId, questionId },
      });
      return NextResponse.json({ success: true, message: "Removed mistake entry" });
    }

    return NextResponse.json({ error: "Invalid delete parameters" }, { status: 400 });
  } catch (error: any) {
    console.error("[USER_MISTAKES_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to delete mistake entry", details: error?.message }, { status: 500 });
  }
}
