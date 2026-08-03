import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "All";
    const EXAM_SIZE = 170;

    // 1. Fetch user's previous exam results to extract questions answered CORRECTLY
    const userResults = await prisma.examResult.findMany({
      where: { userId },
      select: { detailsJson: true },
    });

    const correctlyAnsweredIds = new Set<string>();

    userResults.forEach((result) => {
      if (result.detailsJson) {
        try {
          const details = JSON.parse(result.detailsJson);
          if (Array.isArray(details)) {
            details.forEach((item: any) => {
              if (
                item.id &&
                item.selectedIndex !== null &&
                item.selectedIndex !== undefined &&
                item.selectedIndex === item.answerIndex
              ) {
                correctlyAnsweredIds.add(String(item.id));
              }
            });
          }
        } catch (e) {
          console.error("Error parsing detailsJson in exam start:", e);
        }
      }
    });

    const categoryFilter = category !== "All" ? { category } : {};

    // 2. Query UNSEEN or PREVIOUSLY INCORRECT questions
    let eligibleQuestions = await prisma.question.findMany({
      where: {
        ...categoryFilter,
        id: {
          notIn: Array.from(correctlyAnsweredIds), // Exclude mastered items
        },
      },
      select: {
        id: true,
        category: true,
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

    // 3. ENDLESS LOOP FALLBACK: If unmastered questions < 170, supplement with recycled questions
    if (eligibleQuestions.length < EXAM_SIZE) {
      const neededCount = EXAM_SIZE - eligibleQuestions.length;

      const supplementalQuestions = await prisma.question.findMany({
        where: {
          ...categoryFilter,
          id: {
            in: Array.from(correctlyAnsweredIds), // Recycle mastered questions to fill gap
          },
        },
        take: neededCount,
        select: {
          id: true,
          category: true,
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

      eligibleQuestions = [...eligibleQuestions, ...supplementalQuestions];
    }

    // 4. Shuffle option order & re-index answerIndex for each question
    const preparedQuestions = eligibleQuestions.map((q) => {
      const resolvedOptions =
        Array.isArray(q.options) && q.options.length > 0
          ? q.options
          : [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean);

      const indexedOptions = resolvedOptions.map((opt, idx) => ({
        text: opt,
        isCorrect: idx === q.answerIndex,
      }));

      const shuffledOptions = [...indexedOptions].sort(() => Math.random() - 0.5);

      return {
        id: q.id,
        category: q.category || "General",
        prompt: q.prompt,
        options: shuffledOptions.map((o) => o.text),
        answerIndex: shuffledOptions.findIndex((o) => o.isCorrect),
        explanation: q.explanation || null,
        imageUrl: q.imageUrl || null,
      };
    });

    // 5. Shuffle overall question order
    const finalQuestions = shuffleArray(preparedQuestions).slice(0, EXAM_SIZE);

    return NextResponse.json({
      success: true,
      totalItems: finalQuestions.length,
      questions: finalQuestions,
    });
  } catch (error: any) {
    console.error("[SMART_EXAM_START_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to generate smart exam questions", details: error?.message },
      { status: 500 }
    );
  }
}

// Utility: Fisher-Yates Shuffle Algorithm
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}