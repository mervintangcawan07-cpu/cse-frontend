// Relative Path: src/app/api/exam/start/route.ts
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

// Fisher-Yates Shuffle Utility
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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
            details.forEach(
              (item: { id?: string; selectedIndex?: number | null; answerIndex?: number }) => {
                if (
                  item.id &&
                  item.selectedIndex !== null &&
                  item.selectedIndex !== undefined &&
                  item.selectedIndex === item.answerIndex
                ) {
                  correctlyAnsweredIds.add(String(item.id));
                }
              }
            );
          }
        } catch (e) {
          console.error("Error parsing detailsJson:", e);
        }
      }
    });

    // Determine target category quotas
    const activeQuotas: Record<string, number> =
      selectedCategory === "All"
        ? CSE_CATEGORY_QUOTAS
        : { [selectedCategory]: 170 };

    const requiredCategories = Object.keys(activeQuotas);

    // 2. Fetch ALL non-deleted questions matching active categories in 1 SINGLE DB QUERY
    const allQuestions = await prisma.question.findMany({
      where: {
        deletedAt: null,
        category: { in: requiredCategories, mode: "insensitive" },
        NOT: [
          { category: { equals: "Elimination Drill", mode: "insensitive" } },
          { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
        ],
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

    // Group questions by category in memory
    const categoryMap: Record<string, typeof allQuestions> = {};
    for (const q of allQuestions) {
      const catKey = q.category || "General Information";
      const matchedKey =
        requiredCategories.find((c) => c.toLowerCase() === catKey.toLowerCase()) || catKey;

      if (!categoryMap[matchedKey]) {
        categoryMap[matchedKey] = [];
      }
      categoryMap[matchedKey].push(q);
    }

    let finalExamQuestions: any[] = [];

    // 3. Process subtopics and quotas in memory
    for (const [catName, catQuota] of Object.entries(activeQuotas)) {
      const catQuestions = categoryMap[catName] || [];
      if (catQuestions.length === 0) continue;

      // Group category questions by subtopic
      const subtopicMap: Record<string, typeof catQuestions> = {};
      for (const q of catQuestions) {
        const sub = q.subtopic?.trim() || "General";
        if (!subtopicMap[sub]) subtopicMap[sub] = [];
        subtopicMap[sub].push(q);
      }

      const subtopics = Object.keys(subtopicMap);
      const subtopicCount = subtopics.length || 1;
      const baseQuotaPerSubtopic = Math.floor(catQuota / subtopicCount);
      let remainder = catQuota % subtopicCount;

      let categoryPickedQuestions: any[] = [];
      const pickedIdsInCat = new Set<string>();

      // Pull questions equally per subtopic
      for (const sub of subtopics) {
        const subQuota = baseQuotaPerSubtopic + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        if (subQuota <= 0) continue;

        const subPool = subtopicMap[sub] || [];

        // Split subtopic pool into unmastered vs mastered
        const unmastered = subPool.filter((q) => !correctlyAnsweredIds.has(q.id));
        const mastered = subPool.filter((q) => correctlyAnsweredIds.has(q.id));

        // Step A: Fetch unmastered / unseen questions
        const shuffledUnmastered = shuffleArray(unmastered);
        const pickedFromUnmastered = shuffledUnmastered.slice(0, subQuota);

        pickedFromUnmastered.forEach((q) => {
          categoryPickedQuestions.push(q);
          pickedIdsInCat.add(q.id);
        });

        // Step B: Recycling mastered questions fallback if unmastered pool is smaller than quota
        if (pickedFromUnmastered.length < subQuota) {
          const missingCount = subQuota - pickedFromUnmastered.length;
          const shuffledMastered = shuffleArray(mastered);
          const recycled = shuffledMastered.slice(0, missingCount);

          recycled.forEach((q) => {
            categoryPickedQuestions.push(q);
            pickedIdsInCat.add(q.id);
          });
        }
      }

      // Step C: Fallback check if category quota wasn't completely filled
      if (categoryPickedQuestions.length < catQuota) {
        const catMissing = catQuota - categoryPickedQuestions.length;
        const unpickedInCat = catQuestions.filter((q) => !pickedIdsInCat.has(q.id));
        const categoryFillers = shuffleArray(unpickedInCat).slice(0, catMissing);
        categoryPickedQuestions.push(...categoryFillers);
      }

      finalExamQuestions.push(...shuffleArray(categoryPickedQuestions).slice(0, catQuota));
    }

    // 4. Prepare options & shuffle option indices
    const preparedQuestions = finalExamQuestions.map((q: any) => {
      const resolvedOptions: string[] =
        Array.isArray(q.options) && q.options.length > 0
          ? (q.options as string[])
          : ([q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean) as string[]);

      const indexedOptions = resolvedOptions.map((opt: string, idx: number) => ({
        text: opt,
        isCorrect: idx === q.answerIndex,
      }));

      const shuffledOptions = shuffleArray(indexedOptions);

      return {
        id: q.id,
        category: q.category || "General",
        subtopic: q.subtopic || "General",
        prompt: q.prompt,
        options: shuffledOptions.map((o) => o.text),
        answerIndex: shuffledOptions.findIndex((o) => o.isCorrect),
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