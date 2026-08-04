import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Papa from "papaparse";

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

    // 🛡️ EXCLUSION FILTER: Typed with Prisma.QuestionWhereInput[] to satisfy QueryMode
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

      const whereClause: any = {
        category: { equals: category, mode: "insensitive" },
      };

      if (subtopic && subtopic !== "All") {
        whereClause.subtopic = { equals: subtopic, mode: "insensitive" };
      }

      if (!isEliminationQuery) {
        whereClause.NOT = NOT_ELIMINATION_DRILL;
      }

      // Priority 1: Fetch Unmastered questions first (New + Past Incorrect)
      let questions = await prisma.question.findMany({
        where: {
          ...whereClause,
          ...(masteredQuestionIds.size > 0
            ? { id: { notIn: Array.from(masteredQuestionIds) } }
            : {}),
        },
      });

      // Priority 2: RECYCLING TRIGGER - Top up with Mastered items if unmastered pool runs low
      if (questions.length < requestedLimit && masteredQuestionIds.size > 0) {
        const masteredFallback = await prisma.question.findMany({
          where: {
            ...whereClause,
            id: { in: Array.from(masteredQuestionIds) },
          },
        });
        const shuffledMastered = masteredFallback.sort(() => Math.random() - 0.5);
        questions = [...questions, ...shuffledMastered];
      }

      // Priority 3: MAIN CATEGORY CATCH-ALL - If subtopic query was empty, fetch any questions under this category
      if (questions.length === 0) {
        const catchAllWhere: any = {
          category: { equals: category, mode: "insensitive" },
        };
        if (!isEliminationQuery) {
          catchAllWhere.NOT = NOT_ELIMINATION_DRILL;
        }
        questions = await prisma.question.findMany({
          where: catchAllWhere,
        });
      }

      questions = questions.sort(() => Math.random() - 0.5);

      return NextResponse.json({
        success: true,
        questions: questions.slice(0, requestedLimit),
      });
    }

    // ------------------------------------------------------------------
    // 3. FULL MOCK EXAM MODE ("All"): DYNAMIC SUBTOPICS & STRICT CATEGORY QUOTAS
    // ------------------------------------------------------------------
    const subjectOrder = [
      { name: "Verbal Ability", keyword: "Verbal", quota: 50 },
      { name: "Numerical Reasoning", keyword: "Numerical", quota: 45 },
      { name: "Analytical Reasoning", keyword: "Analytical", quota: 45 },
      { name: "General Information", keyword: "General", quota: 30 },
    ];

    let finalExamQuestions: any[] = [];
    const addedIds = new Set<string>();

    for (const subject of subjectOrder) {
      const categoryQuestions: any[] = [];

      // 🔍 A. DISCOVER ALL SUBTOPICS DYNAMICALLY FROM DATABASE FOR THIS CATEGORY (EXCLUDING ELIMINATION DRILLS)
      const dbSubtopicObjects = await prisma.question.findMany({
        where: {
          category: { contains: subject.keyword, mode: "insensitive" },
          NOT: NOT_ELIMINATION_DRILL,
        },
        select: { subtopic: true },
        distinct: ["subtopic"],
      });

      const activeSubtopics = dbSubtopicObjects
        .map((s) => s.subtopic?.trim())
        .filter(
          (s): s is string =>
            Boolean(s) && s !== "" && !s.toLowerCase().includes("elimination drill")
        );

      // ⚖️ B. EVENLY DIVIDE CATEGORY QUOTA ACROSS ALL DISCOVERED SUBTOPICS
      if (activeSubtopics.length > 0) {
        const subCount = activeSubtopics.length;
        const basePerSub = Math.floor(subject.quota / subCount);
        let remainder = subject.quota % subCount;

        for (const sub of activeSubtopics) {
          const subTarget = basePerSub + (remainder > 0 ? 1 : 0);
          if (remainder > 0) remainder--;
          if (subTarget <= 0) continue;

          // Priority 1: Unmastered questions for this specific subtopic
          let subQuestions = await prisma.question.findMany({
            where: {
              category: { contains: subject.keyword, mode: "insensitive" },
              subtopic: { equals: sub, mode: "insensitive" },
              id: {
                notIn: [
                  ...Array.from(masteredQuestionIds),
                  ...Array.from(addedIds),
                ],
              },
              NOT: NOT_ELIMINATION_DRILL,
            },
          });

          // Priority 2: RECYCLING TRIGGER - Recycle Mastered questions for this subtopic if unmastered is exhausted
          if (subQuestions.length < subTarget && masteredQuestionIds.size > 0) {
            const masteredSub = await prisma.question.findMany({
              where: {
                category: { contains: subject.keyword, mode: "insensitive" },
                subtopic: { equals: sub, mode: "insensitive" },
                id: {
                  in: Array.from(masteredQuestionIds),
                  notIn: Array.from(addedIds),
                },
                NOT: NOT_ELIMINATION_DRILL,
              },
            });
            const shuffledMastered = masteredSub.sort(() => Math.random() - 0.5);
            subQuestions = [...subQuestions, ...shuffledMastered];
          }

          subQuestions = subQuestions.sort(() => Math.random() - 0.5);

          for (const q of subQuestions.slice(0, subTarget)) {
            addedIds.add(q.id);
            categoryQuestions.push(q);
          }
        }
      }

      // 🛡️ C. MAIN CATEGORY CATCH-ALL & RECYCLING (EXCLUDING ELIMINATION DRILLS)
      if (categoryQuestions.length < subject.quota) {
        const needed = subject.quota - categoryQuestions.length;

        // Catch-All Priority 1: Unmastered Category Questions
        let extraUnmastered = await prisma.question.findMany({
          where: {
            category: { contains: subject.keyword, mode: "insensitive" },
            id: {
              notIn: [
                ...Array.from(masteredQuestionIds),
                ...Array.from(addedIds),
              ],
            },
            NOT: NOT_ELIMINATION_DRILL,
          },
        });

        extraUnmastered = extraUnmastered.sort(() => Math.random() - 0.5);
        for (const q of extraUnmastered.slice(0, needed)) {
          addedIds.add(q.id);
          categoryQuestions.push(q);
        }

        // Catch-All Priority 2: Mastered Category Questions
        if (categoryQuestions.length < subject.quota) {
          const stillNeeded = subject.quota - categoryQuestions.length;
          let extraMastered = await prisma.question.findMany({
            where: {
              category: { contains: subject.keyword, mode: "insensitive" },
              id: {
                in: Array.from(masteredQuestionIds),
                notIn: Array.from(addedIds),
              },
              NOT: NOT_ELIMINATION_DRILL,
            },
          });

          extraMastered = extraMastered.sort(() => Math.random() - 0.5);
          for (const q of extraMastered.slice(0, stillNeeded)) {
            addedIds.add(q.id);
            categoryQuestions.push(q);
          }
        }
      }

      finalExamQuestions.push(...categoryQuestions);
    }

    // 🛡️ D. INFINITE EXAM READINESS SAFEGUARD (If DB total items < 170 items, EXCLUDING ELIMINATION DRILLS)
    if (finalExamQuestions.length < 170) {
      const neededGlobal = 170 - finalExamQuestions.length;
      let globalFallback = await prisma.question.findMany({
        where: {
          id: { notIn: Array.from(addedIds) },
          NOT: NOT_ELIMINATION_DRILL,
        },
        take: neededGlobal,
      });

      globalFallback = globalFallback.sort(() => Math.random() - 0.5);
      for (const q of globalFallback) {
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