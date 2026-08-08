// Relative Path: src/app/api/questions/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Papa from "papaparse";

// Official Civil Service Exam Category Breakdown (Total = 170)
const CSE_SUBJECT_ORDER = [
  { name: "Verbal Ability", keyword: "verbal", quota: 50 },
  { name: "Numerical Reasoning", keyword: "numerical", quota: 45 },
  { name: "Analytical Reasoning", keyword: "analytical", quota: 45 },
  { name: "General Information", keyword: "general", quota: 30 },
];

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
    const userId = session?.userId || session?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const subtopic = searchParams.get("subtopic");
    const limitParam = searchParams.get("limit");
    const requestedLimit = limitParam ? parseInt(limitParam, 10) : 170;

    const NOT_ELIMINATION_DRILL: Prisma.QuestionWhereInput[] = [
      { category: { equals: "Elimination Drill", mode: "insensitive" } },
      { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
    ];

    // ------------------------------------------------------------------
    // 1. IDENTIFY MASTERED QUESTIONS (ANSWERED CORRECTLY AT LEAST ONCE)
    // ------------------------------------------------------------------
    const masteredQuestionIds = new Set<string>();

    try {
      const pastResults: any[] = await (prisma.examResult as any).findMany({
        where: { userId },
      });

      const pastAnswerMap = new Map<string, number[]>();
      pastResults.forEach((res: any) => {
        const answers = res.answers || res.userAnswers || res.details;
        if (Array.isArray(answers)) {
          answers.forEach((ans: any) => {
            if (ans?.questionId && typeof ans?.selectedIndex === "number") {
              if (!pastAnswerMap.has(ans.questionId)) {
                pastAnswerMap.set(ans.questionId, []);
              }
              pastAnswerMap.get(ans.questionId)!.push(ans.selectedIndex);
            }
          });
        }
      });

      if (pastAnswerMap.size > 0) {
        const pastQuestions = await prisma.question.findMany({
          where: { id: { in: Array.from(pastAnswerMap.keys()) } },
          select: { id: true, answerIndex: true },
        });

        pastQuestions.forEach((q) => {
          const selectedIndices = pastAnswerMap.get(q.id) || [];
          if (selectedIndices.includes(q.answerIndex)) {
            masteredQuestionIds.add(q.id);
          }
        });
      }
    } catch (err) {
      // Gracefully continue if examResult structure varies
    }

    // ------------------------------------------------------------------
    // 2. SINGLE CATEGORY / SUBTOPIC DRILL MODE
    // ------------------------------------------------------------------
    if (category && category !== "All") {
      const isEliminationQuery =
        category.toLowerCase() === "elimination drill" ||
        (subtopic && subtopic.toLowerCase().includes("elimination drill"));

      const whereClause: Prisma.QuestionWhereInput = {
        deletedAt: null,
        category: { equals: category, mode: "insensitive" },
      };

      if (subtopic && subtopic !== "All") {
        whereClause.subtopic = { equals: subtopic, mode: "insensitive" };
      }

      if (!isEliminationQuery) {
        whereClause.NOT = NOT_ELIMINATION_DRILL;
      }

      // ⚡ FAST BULK FETCH: Query all candidate questions for this category/subtopic in 1 SQL call
      const allCategoryPool = await prisma.question.findMany({
        where: whereClause,
      });

      if (allCategoryPool.length === 0) {
        // Catch-all fallback
        const catchAllWhere: Prisma.QuestionWhereInput = {
          deletedAt: null,
          category: { equals: category, mode: "insensitive" },
        };
        if (!isEliminationQuery) {
          catchAllWhere.NOT = NOT_ELIMINATION_DRILL;
        }
        const catchAllPool = await prisma.question.findMany({
          where: catchAllWhere,
        });
        return NextResponse.json({
          success: true,
          questions: shuffleArray(catchAllPool).slice(0, requestedLimit),
        });
      }

      // In-Memory Prioritization: Unmastered first, then Mastered recycling
      const unmastered = allCategoryPool.filter((q) => !masteredQuestionIds.has(q.id));
      const mastered = allCategoryPool.filter((q) => masteredQuestionIds.has(q.id));

      let picked = shuffleArray(unmastered);
      if (picked.length < requestedLimit && mastered.length > 0) {
        const needed = requestedLimit - picked.length;
        picked.push(...shuffleArray(mastered).slice(0, needed));
      }

      return NextResponse.json({
        success: true,
        questions: picked.slice(0, requestedLimit),
      });
    }

    // ------------------------------------------------------------------
    // 3. FULL MOCK EXAM MODE ("All"): SINGLE BULK QUERY + IN-MEMORY ALLOCATION
    // ------------------------------------------------------------------
    // ⚡ SINGLE SQL QUERY: Retrieve all non-deleted, active questions at once
    const globalPool = await prisma.question.findMany({
      where: {
        deletedAt: null,
        NOT: NOT_ELIMINATION_DRILL,
      },
    });

    let finalExamQuestions: any[] = [];
    const addedIds = new Set<string>();

    for (const subject of CSE_SUBJECT_ORDER) {
      const categoryQuestions: any[] = [];

      // Filter global pool for this subject
      const subjectPool = globalPool.filter((q) =>
        q.category?.toLowerCase().includes(subject.keyword)
      );

      // Discover active subtopics from in-memory pool
      const subtopicMap = new Map<string, typeof globalPool>();
      for (const q of subjectPool) {
        const sub = q.subtopic?.trim() || "General";
        if (sub && !sub.toLowerCase().includes("elimination drill")) {
          if (!subtopicMap.has(sub)) subtopicMap.set(sub, []);
          subtopicMap.get(sub)!.push(q);
        }
      }

      const activeSubtopics = Array.from(subtopicMap.keys());

      // Divide quota across subtopics in memory
      if (activeSubtopics.length > 0) {
        const subCount = activeSubtopics.length;
        const basePerSub = Math.floor(subject.quota / subCount);
        let remainder = subject.quota % subCount;

        for (const sub of activeSubtopics) {
          const subTarget = basePerSub + (remainder > 0 ? 1 : 0);
          if (remainder > 0) remainder--;
          if (subTarget <= 0) continue;

          const subPool = subtopicMap.get(sub) || [];
          const availableUnused = subPool.filter((q) => !addedIds.has(q.id));

          const unmastered = availableUnused.filter((q) => !masteredQuestionIds.has(q.id));
          const mastered = availableUnused.filter((q) => masteredQuestionIds.has(q.id));

          let subPicked = shuffleArray(unmastered).slice(0, subTarget);

          // Recycle mastered if unmastered is insufficient
          if (subPicked.length < subTarget && mastered.length > 0) {
            const missing = subTarget - subPicked.length;
            subPicked.push(...shuffleArray(mastered).slice(0, missing));
          }

          for (const q of subPicked) {
            addedIds.add(q.id);
            categoryQuestions.push(q);
          }
        }
      }

      // Catch-all filling for category if quota wasn't reached
      if (categoryQuestions.length < subject.quota) {
        const needed = subject.quota - categoryQuestions.length;
        const remainingInCat = subjectPool.filter((q) => !addedIds.has(q.id));

        const unmasteredCat = remainingInCat.filter((q) => !masteredQuestionIds.has(q.id));
        const masteredCat = remainingInCat.filter((q) => masteredQuestionIds.has(q.id));

        let extra = shuffleArray(unmasteredCat).slice(0, needed);
        if (extra.length < needed && masteredCat.length > 0) {
          const stillNeeded = needed - extra.length;
          extra.push(...shuffleArray(masteredCat).slice(0, stillNeeded));
        }

        for (const q of extra) {
          addedIds.add(q.id);
          categoryQuestions.push(q);
        }
      }

      finalExamQuestions.push(...categoryQuestions);
    }

    // Safeguard to top up global items if pool total is under 170
    if (finalExamQuestions.length < 170) {
      const neededGlobal = 170 - finalExamQuestions.length;
      const globalRemaining = globalPool.filter((q) => !addedIds.has(q.id));
      const fallback = shuffleArray(globalRemaining).slice(0, neededGlobal);
      for (const q of fallback) {
        addedIds.add(q.id);
        finalExamQuestions.push(q);
      }
    }

    return NextResponse.json({
      success: true,
      questions: finalExamQuestions.slice(0, 170),
    });
  } catch (error: any) {
    console.error("[QUESTIONS_FETCH_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch questions.", details: error?.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// 🎯 POST: BULK CSV IMPORT & SINGLE QUESTION CREATION
// ----------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    const userId = session?.userId || session?.id;

    if (!userId || session?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let rawQuestions: any[] = [];

    // 1. Parse incoming CSV text, multipart data, or JSON payloads
    if (contentType.includes("text/csv") || contentType.includes("multipart/form-data")) {
      const csvText = await request.text();
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
      });
      rawQuestions = parsed.data;
    } else {
      const body = await request.json();
      if (typeof body.csvText === "string") {
        const parsed = Papa.parse(body.csvText, {
          header: true,
          skipEmptyLines: true,
        });
        rawQuestions = parsed.data;
      } else if (Array.isArray(body)) {
        rawQuestions = body;
      } else if (body.questions && Array.isArray(body.questions)) {
        rawQuestions = body.questions;
      } else {
        rawQuestions = [body];
      }
    }

    if (!rawQuestions || rawQuestions.length === 0) {
      return NextResponse.json(
        { error: "No valid questions provided for upload" },
        { status: 400 }
      );
    }

    // 2. Sanitize and structure Category, Subtopic, Options, and Answer Fields
    const formattedData = rawQuestions
      .map((item: any) => {
        const category = String(item.category || item.subject || "General").trim();
        const subtopic = String(item.subtopic || item.sub_topic || item.subTopic || "General").trim();
        const prompt = String(item.prompt || item.question || "").trim();
        const explanation = item.explanation ? String(item.explanation).trim() : null;
        const imageUrl = String(item.imageUrl || item.image_url || item.image || "").trim() || null;

        const optA = String(item.optionA || item.option_a || "").trim();
        const optB = String(item.optionB || item.option_b || "").trim();
        const optC = String(item.optionC || item.option_c || "").trim();
        const optD = String(item.optionD || item.option_d || "").trim();

        let options: string[] = [];
        if (Array.isArray(item.options) && item.options.length > 0) {
          options = item.options.map((o: any) => String(o).trim());
        } else {
          options = [optA, optB, optC, optD].filter(Boolean);
        }

        let answerIndex = 0;
        if (typeof item.answerIndex === "number") {
          answerIndex = item.answerIndex;
        } else if (typeof item.answerIndex === "string") {
          const parsedIdx = parseInt(item.answerIndex, 10);
          answerIndex = isNaN(parsedIdx) ? 0 : parsedIdx;
        } else if (typeof item.correctAnswer === "number") {
          answerIndex = item.correctAnswer;
        } else if (typeof item.correctAnswer === "string") {
          const parsedIdx = parseInt(item.correctAnswer, 10);
          answerIndex = isNaN(parsedIdx) ? 0 : parsedIdx;
        }

        return {
          category,
          subtopic,
          prompt,
          options,
          optionA: optA || (options[0] ?? null),
          optionB: optB || (options[1] ?? null),
          optionC: optC || (options[2] ?? null),
          optionD: optD || (options[3] ?? null),
          answerIndex,
          explanation,
          imageUrl,
        };
      })
      .filter((q) => q.prompt && q.category && q.options.length >= 2);

    if (formattedData.length === 0) {
      return NextResponse.json(
        { error: "No valid questions found after parsing fields." },
        { status: 400 }
      );
    }

    // 3. Batch insert questions into Database
    const createdCount = await prisma.question.createMany({
      data: formattedData as any,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${createdCount.count} question(s).`,
      count: createdCount.count,
    });
  } catch (error: any) {
    console.error("[POST_QUESTIONS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to create/upload questions", details: error?.message },
      { status: 500 }
    );
  }
}