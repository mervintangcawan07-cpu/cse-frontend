import { activeOrdinaryQuestionWhere } from "@/lib/contentEligibility";
import { andQuestionWhere, findBankQuestions, orQuestionWhere, questionIdsWhere, questionTextWhere } from "@/lib/questionBank";
// Relative Path: src/app/api/exam/start/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { isAccountAuthorizedFor } from "@/lib/accountLifecycle";
import { CACHE_PROFILES } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import {
  EXAM_START_LIMITER,
  checkRateLimit,
  createRateLimitResponse,
} from "@/lib/ratelimit";
import { signExamAttemptToken } from "@/lib/examAttemptToken";

// Official Civil Service Exam Category Breakdown (Total = 170)
const CSE_CATEGORY_QUOTAS: Record<string, number> = {
  "Verbal Ability": 50,
  "Numerical Reasoning": 45,
  "Analytical Reasoning": 45,
  "General Information": 30,
};

const ALL_CATEGORIES = Object.keys(CSE_CATEGORY_QUOTAS);

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
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CACHE_PROFILES.PRIVATE });
    }
    const userId = authenticatedUser.id;

    const rateLimitKey = `exam:start:${userId}`;
    const rateResult = await checkRateLimit(EXAM_START_LIMITER, rateLimitKey);
    if (!rateResult.success) {
      return createRateLimitResponse(
        rateResult,
        "Too many exam start requests. Please wait a moment before starting another exam."
      );
    }

    const { searchParams } = new URL(request.url);

    // Raw presence check for the four custom quiz builder parameters
    const hasItemCount = searchParams.has("itemCount");
    const hasCategories = searchParams.has("categories");
    const hasPool = searchParams.has("pool");
    const hasMode = searchParams.has("mode");

    const customParamCount =
      (hasItemCount ? 1 : 0) +
      (hasCategories ? 1 : 0) +
      (hasPool ? 1 : 0) +
      (hasMode ? 1 : 0);

    let isCustom = false;
    let targetItemCount: number | null = null;
    let pool = "ALL";
    let mode = "TIMED";
    let selectedCategory = "All";
    let requiredCategories: string[] = ALL_CATEGORIES;

    // Classification Rule A: 0 of 4 custom parameters -> Standard Mock Exam (Requires PRO)
    if (customParamCount === 0) {
      if (!isAccountAuthorizedFor(authenticatedUser, "PRO")) {
        return NextResponse.json(
          { error: "Payment required. Active PRO subscription required." },
          { status: 402, headers: CACHE_PROFILES.PRIVATE }
        );
      }

      selectedCategory = searchParams.get("category") || "All";
      if (selectedCategory === "All") {
        requiredCategories = ALL_CATEGORIES;
      } else {
        requiredCategories = [selectedCategory];
      }
    }
    // Classification Rule B: 1 to 3 custom parameters -> Malformed partial custom request (HTTP 400)
    else if (customParamCount < 4) {
      return NextResponse.json(
        {
          error:
            "Invalid custom quiz configuration: all four custom parameters (itemCount, categories, pool, mode) must be provided.",
        },
        { status: 400, headers: CACHE_PROFILES.PRIVATE }
      );
    }
    // Classification Rule C: All 4 custom parameters present -> Strict validation -> Allowed for free authenticated users
    else {
      const itemCountRaw = searchParams.get("itemCount") ?? "";
      const categoriesRaw = searchParams.get("categories") ?? "";
      const poolRaw = searchParams.get("pool") ?? "";
      const modeRaw = searchParams.get("mode") ?? "";

      // 1. Validate itemCount: decimal integer only between 1 and 170
      if (!/^\d+$/.test(itemCountRaw)) {
        return NextResponse.json(
          { error: "Invalid itemCount: must be a decimal integer between 1 and 170." },
          { status: 400, headers: CACHE_PROFILES.PRIVATE }
        );
      }
      const parsedItemCount = parseInt(itemCountRaw, 10);
      if (parsedItemCount < 1 || parsedItemCount > 170) {
        return NextResponse.json(
          { error: "Invalid itemCount: must be between 1 and 170." },
          { status: 400, headers: CACHE_PROFILES.PRIVATE }
        );
      }

      // Entitlement authorization: Free practice quizzes capped at 20 items
      if (parsedItemCount > 20 && !isAccountAuthorizedFor(authenticatedUser, "PRO")) {
        return NextResponse.json(
          {
            error:
              "Payment required. Free practice quizzes are limited to 20 items. Upgrade to Pro for up to 170 items.",
          },
          { status: 402, headers: CACHE_PROFILES.PRIVATE }
        );
      }

      // 2. Validate categories: non-empty comma-separated list of supported builder categories
      if (!categoriesRaw.trim()) {
        return NextResponse.json(
          { error: "Invalid categories: at least one valid category must be selected." },
          { status: 400, headers: CACHE_PROFILES.PRIVATE }
        );
      }
      const rawCategoryList = categoriesRaw.split(",");
      const validatedCategories: string[] = [];
      for (const cat of rawCategoryList) {
        const trimmed = cat.trim();
        if (!trimmed) {
          return NextResponse.json(
            { error: "Invalid categories: empty category entries are not allowed." },
            { status: 400, headers: CACHE_PROFILES.PRIVATE }
          );
        }
        if (!ALL_CATEGORIES.includes(trimmed)) {
          return NextResponse.json(
            { error: `Invalid categories: unsupported category "${trimmed}".` },
            { status: 400, headers: CACHE_PROFILES.PRIVATE }
          );
        }
        if (!validatedCategories.includes(trimmed)) {
          validatedCategories.push(trimmed);
        }
      }

      // 3. Validate pool: exactly ALL, UNATTEMPTED, or MISTAKES_ONLY
      const VALID_POOLS = ["ALL", "UNATTEMPTED", "MISTAKES_ONLY"];
      if (!VALID_POOLS.includes(poolRaw)) {
        return NextResponse.json(
          { error: `Invalid pool: must be one of ${VALID_POOLS.join(", ")}.` },
          { status: 400, headers: CACHE_PROFILES.PRIVATE }
        );
      }

      // 4. Validate mode: exactly TIMED or SELF_PACED
      const VALID_MODES = ["TIMED", "SELF_PACED"];
      if (!VALID_MODES.includes(modeRaw)) {
        return NextResponse.json(
          { error: `Invalid mode: must be one of ${VALID_MODES.join(", ")}.` },
          { status: 400, headers: CACHE_PROFILES.PRIVATE }
        );
      }

      isCustom = true;
      targetItemCount = parsedItemCount;
      pool = poolRaw;
      mode = modeRaw;
      requiredCategories = validatedCategories;
    }

    // 1. Gather question IDs from user history for pool filtering
    const userResults = await prisma.examResult.findMany({
      where: { userId },
      select: { detailsJson: true },
    });

    const correctlyAnsweredIds = new Set<string>();
    const attemptedIds = new Set<string>();

    userResults.forEach((result: { detailsJson: string | null }) => {
      if (result.detailsJson) {
        try {
          const details = JSON.parse(result.detailsJson);
          if (Array.isArray(details)) {
            details.forEach(
              (item: { id?: string; selectedIndex?: number | null; answerIndex?: number }) => {
                if (item.id) {
                  attemptedIds.add(String(item.id));
                  if (
                    item.selectedIndex !== null &&
                    item.selectedIndex !== undefined &&
                    item.selectedIndex === item.answerIndex
                  ) {
                    correctlyAnsweredIds.add(String(item.id));
                  }
                }
              }
            );
          }
        } catch (e) {
          console.error("Error parsing detailsJson:", e);
        }
      }
    });

    // For MISTAKES_ONLY pool: get user's mistake question IDs
    const mistakeQuestionIds: Set<string> = new Set();
    if (pool === "MISTAKES_ONLY") {
      const mistakes = await prisma.userMistake.findMany({
        where: { userId, isMastered: false },
        select: { questionId: true },
      });
      mistakes.forEach((m) => mistakeQuestionIds.add(m.questionId));
    }

    // 2. Questions query matching determined categories

    // 3. Fetch ALL matching non-deleted questions in one DB query
    const allQuestions = await findBankQuestions({
      where: andQuestionWhere(
        activeOrdinaryQuestionWhere(),
        orQuestionWhere(...requiredCategories.map(category => questionTextWhere("category", category))),
        ...(pool === "MISTAKES_ONLY" && mistakeQuestionIds.size > 0
          ? [questionIdsWhere(Array.from(mistakeQuestionIds))] : []),
      ),
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
    });

    // 4. Apply UNATTEMPTED pool filter in memory
    const filteredQuestions = pool === "UNATTEMPTED"
      ? allQuestions.filter((q) => !attemptedIds.has(q.id))
      : allQuestions;

    // --- Custom Quiz path: flat shuffle, proportional or equal distribution ---
    if (isCustom && targetItemCount) {
      // Proportional distribution across selected categories
      const categoryMap: Record<string, typeof filteredQuestions> = {};
      for (const q of filteredQuestions) {
        const cat = q.category || "General Information";
        const matchedKey = requiredCategories.find((c) => c.toLowerCase() === cat.toLowerCase()) || cat;
        if (!categoryMap[matchedKey]) categoryMap[matchedKey] = [];
        categoryMap[matchedKey].push(q);
      }

      // Distribute targetItemCount proportionally across categories
      const totalPool = filteredQuestions.length;
      let pickedQuestions: typeof filteredQuestions = [];

      if (totalPool <= targetItemCount) {
        // Pool smaller than requested — take everything available
        pickedQuestions = shuffleArray(filteredQuestions);
      } else {
        const catKeys = Object.keys(categoryMap).filter((k) => categoryMap[k].length > 0);
        const perCat = Math.floor(targetItemCount / catKeys.length);
        let remainder = targetItemCount % catKeys.length;
        const pickedIds = new Set<string>();

        for (const cat of catKeys) {
          const quota = perCat + (remainder > 0 ? 1 : 0);
          if (remainder > 0) remainder--;
          const shuffled = shuffleArray(categoryMap[cat]);
          const picked = shuffled.slice(0, quota);
          picked.forEach((q) => {
            if (!pickedIds.has(q.id)) {
              pickedQuestions.push(q);
              pickedIds.add(q.id);
            }
          });
        }

        // Top-up if still short due to small category pools
        if (pickedQuestions.length < targetItemCount) {
          const remaining = shuffleArray(filteredQuestions.filter((q) => !pickedIds.has(q.id)));
          const needed = targetItemCount - pickedQuestions.length;
          pickedQuestions.push(...remaining.slice(0, needed));
        }

        pickedQuestions = shuffleArray(pickedQuestions);
      }

      const preparedQuestions = pickedQuestions.slice(0, targetItemCount).map((q: any) => {
        const resolvedOptions: string[] =
          Array.isArray(q.options) && q.options.length > 0
            ? (q.options as string[])
            : ([q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean) as string[]);

        return {
          id: q.id,
          category: q.category || "General",
          subtopic: q.subtopic || "General",
          prompt: q.prompt,
          options: resolvedOptions,
          answerIndex: q.answerIndex,
          explanation: q.explanation || null,
          imageUrl: q.imageUrl || null,
          stepByStep: q.stepByStep || null,
          whyA: q.whyA || null,
          whyB: q.whyB || null,
          whyC: q.whyC || null,
          whyD: q.whyD || null,
          eliminationStrategy: q.eliminationStrategy || null,
          commonTrap: q.commonTrap || null,
          examTip: q.examTip || null,
          difficulty: q.difficulty || "MEDIUM",
          tags: q.tags || [],
        };
      });

      let attemptToken: string | null = null;
      if (preparedQuestions.length > 0) {
        const tokenResult = await signExamAttemptToken({
          userId: authenticatedUser.id,
          examType: "CUSTOM_PRACTICE",
          questionIds: preparedQuestions.map((q: any) => q.id),
        });
        attemptToken = tokenResult.attemptToken;
      }

      return NextResponse.json(
        {
          success: true,
          totalItems: preparedQuestions.length,
          questions: preparedQuestions,
          attemptToken,
          meta: { mode, pool, isCustom: true },
        },
        { headers: CACHE_PROFILES.PRIVATE }
      );
    }

    // --- Standard Full Exam path (unchanged behavior) ---
    const activeQuotas: Record<string, number> =
      selectedCategory === "All"
        ? CSE_CATEGORY_QUOTAS
        : { [selectedCategory]: 170 };

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

    const finalExamQuestions: any[] = [];

    // Process subtopics and quotas in memory
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

      const categoryPickedQuestions: any[] = [];
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

    // 4. Prepare options (canonical database order preserved)
    const preparedQuestions = finalExamQuestions.map((q: any) => {
      const resolvedOptions: string[] =
        Array.isArray(q.options) && q.options.length > 0
          ? (q.options as string[])
          : ([q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean) as string[]);

      return {
        id: q.id,
        category: q.category || "General",
        subtopic: q.subtopic || "General",
        prompt: q.prompt,
        options: resolvedOptions,
        answerIndex: q.answerIndex,
        explanation: q.explanation || null,
        imageUrl: q.imageUrl || null,
        stepByStep: q.stepByStep || null,
        whyA: q.whyA || null,
        whyB: q.whyB || null,
        whyC: q.whyC || null,
        whyD: q.whyD || null,
        eliminationStrategy: q.eliminationStrategy || null,
        commonTrap: q.commonTrap || null,
        examTip: q.examTip || null,
        difficulty: q.difficulty || "MEDIUM",
        tags: q.tags || [],
      };
    });

    // Final cap at 170 items
    const cappedExam = preparedQuestions.slice(0, 170);

    let attemptToken: string | null = null;
    if (cappedExam.length > 0) {
      const tokenResult = await signExamAttemptToken({
        userId: authenticatedUser.id,
        examType: "FULL_MOCK",
        questionIds: cappedExam.map((q: any) => q.id),
      });
      attemptToken = tokenResult.attemptToken;
    }

    return NextResponse.json(
      {
        success: true,
        totalItems: cappedExam.length,
        questions: cappedExam,
        attemptToken,
      },
      { headers: CACHE_PROFILES.PRIVATE }
    );
  } catch (error: any) {
    console.error("[CATEGORY_SUBTOPIC_SMART_EXAM_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to assemble categorized exam pool" },
      { status: 500, headers: CACHE_PROFILES.PRIVATE }
    );
  }
}
