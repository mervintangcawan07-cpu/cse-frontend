import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Official Civil Service Exam Category Breakdown (Total = 170)
const CSE_CATEGORY_QUOTAS: Record<string, number> = {
  "Verbal Ability": 50,
  "Numerical Reasoning": 45,
  "Analytical Reasoning": 45,
  "General Information": 30,
};

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
    const selectedCategory = searchParams.get("category") || "All";

    // 1. Get IDs of all questions the user answered CORRECTLY in past exams
    const userResults = await prisma.examResult.findMany({
      where: { userId },
      select: { detailsJson: true },
    });

    const correctlyAnsweredIds = new Set<string>();

    userResults.forEach((result: { detailsJson: string | null }) => {
      if (result.detailsJson) {
        try {
          const details = JSON.parse(result.detailsJson);
          if (Array.isArray(details)) {
            details.forEach((item: { id?: string; selectedIndex?: number | null; answerIndex?: number }) => {
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
          console.error("Error parsing detailsJson:", e);
        }
      }
    });

    const correctlyAnsweredArray = Array.from(correctlyAnsweredIds);
    let finalExamQuestions: any[] = [];

    // Determine target category quotas
    const activeQuotas: Record<string, number> =
      selectedCategory === "All"
        ? CSE_CATEGORY_QUOTAS
        : { [selectedCategory]: 170 };

    // 2. Build question pool per Category and Subtopic
    for (const [catName, catQuota] of Object.entries(activeQuotas)) {
      // Find all distinct subtopics in this category
      const subtopicRecords = await prisma.question.findMany({
        where: { category: catName },
        select: { subtopic: true },
        distinct: ["subtopic"],
      });

      const subtopics: string[] = subtopicRecords
        .map((s: { subtopic: string | null }) => s.subtopic || "General")
        .filter(Boolean);

      const subtopicCount = subtopics.length || 1;
      const baseQuotaPerSubtopic = Math.floor(catQuota / subtopicCount);
      let remainder = catQuota % subtopicCount;

      let categoryPickedQuestions: any[] = [];

      // Pull questions equally per subtopic
      for (const sub of subtopics) {
        const subQuota = baseQuotaPerSubtopic + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;

        if (subQuota <= 0) continue;

        // Step A: Fetch unmastered / unseen questions for this subtopic
        let subQuestions = await prisma.question.findMany({
          where: {
            category: catName,
            subtopic: sub,
            id: { notIn: correctlyAnsweredArray },
          },
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

        // Step B: Endless Loop Fallback — recycle mastered questions from this subtopic if needed
        if (subQuestions.length < subQuota) {
          const missingCount = subQuota - subQuestions.length;
          const recycledSubQuestions = await prisma.question.findMany({
            where: {
              category: catName,
              subtopic: sub,
              id: { in: correctlyAnsweredArray },
            },
            take: missingCount,
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

          subQuestions = [...subQuestions, ...recycledSubQuestions];
        }

        categoryPickedQuestions.push(...shuffleArray(subQuestions).slice(0, subQuota));
      }

      // Step C: Fallback check if category quota wasn't completely filled
      if (categoryPickedQuestions.length < catQuota) {
        const catMissing = catQuota - categoryPickedQuestions.length;
        const existingCategoryIds = categoryPickedQuestions.map((q: any) => q.id);

        const categoryFillers = await prisma.question.findMany({
          where: {
            category: catName,
            id: { notIn: existingCategoryIds },
          },
          take: catMissing,
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

        categoryPickedQuestions.push(...categoryFillers);
      }

      finalExamQuestions.push(...categoryPickedQuestions);
    }

    // 3. Prepare options & shuffle option indices
    const preparedQuestions = finalExamQuestions.map((q: any) => {
      const resolvedOptions: string[] =
        Array.isArray(q.options) && q.options.length > 0
          ? (q.options as string[])
          : ([q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean) as string[]);

      const indexedOptions = resolvedOptions.map((opt: string, idx: number) => ({
        text: opt,
        isCorrect: idx === q.answerIndex,
      }));

      const shuffledOptions = [...indexedOptions].sort(() => Math.random() - 0.5);

      return {
        id: q.id,
        category: q.category || "General",
        subtopic: q.subtopic || "General",
        prompt: q.prompt,
        options: shuffledOptions.map((o: { text: string; isCorrect: boolean }) => o.text),
        answerIndex: shuffledOptions.findIndex((o: { text: string; isCorrect: boolean }) => o.isCorrect),
        explanation: q.explanation || null,
        imageUrl: q.imageUrl || null,
      };
    });

    // Final cap at 170 items
    const cappedExam = preparedQuestions.slice(0, 170);

    return NextResponse.json({
      success: true,
      totalItems: cappedExam.length,
      questions: cappedExam,
    });
  } catch (error: any) {
    console.error("[CATEGORY_SUBTOPIC_SMART_EXAM_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to assemble categorized exam pool", details: error?.message },
      { status: 500 }
    );
  }
}

// Fisher-Yates Shuffle Utility
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
