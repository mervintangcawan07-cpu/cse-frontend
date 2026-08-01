import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

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
    const category = searchParams.get("category");
    const subtopic = searchParams.get("subtopic");
    const limitParam = searchParams.get("limit");
    const requestedLimit = limitParam ? parseInt(limitParam, 10) : 170;

    // ------------------------------------------------------------------
    // 1. SAFELY FETCH USER'S MASTERED QUESTIONS TO PREVENT REPETITION
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

        // Exclude ONLY questions answered CORRECTLY at least once
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
      const whereClause: any = {
        category: { equals: category, mode: "insensitive" },
      };

      if (subtopic && subtopic !== "All") {
        whereClause.subtopic = { equals: subtopic, mode: "insensitive" };
      }

      // Fetch unmastered questions first
      let questions = await prisma.question.findMany({
        where: {
          ...whereClause,
          ...(masteredQuestionIds.size > 0
            ? { id: { notIn: Array.from(masteredQuestionIds) } }
            : {}),
        },
      });

      // Fallback 1: Fill up with mastered items if pool is smaller than requested limit
      if (questions.length < requestedLimit && masteredQuestionIds.size > 0) {
        const fallback = await prisma.question.findMany({
          where: {
            ...whereClause,
            id: { in: Array.from(masteredQuestionIds) },
          },
        });
        questions = [...questions, ...fallback];
      }

      // Fallback 2: If still empty, fetch any questions under this category regardless of subtopic
      if (questions.length === 0) {
        questions = await prisma.question.findMany({
          where: { category: { equals: category, mode: "insensitive" } },
        });
      }

      // Fallback 3: Ultimate safeguard - fetch any questions in the DB
      if (questions.length === 0) {
        questions = await prisma.question.findMany({
          take: requestedLimit,
        });
      }

      // Shuffle and return requested slice
      questions = questions.sort(() => Math.random() - 0.5);

      return NextResponse.json({
        success: true,
        questions: questions.slice(0, requestedLimit),
      });
    }

    // ------------------------------------------------------------------
    // 3. FULL COMPREHENSIVE EXAM MODE ("All"): SUBTOPIC-BALANCED BLOCKS
    // CSC Official Distribution Quotas (Total: 170 items)
    // ------------------------------------------------------------------
    const subjectOrder = [
      {
        name: "Verbal Ability",
        keyword: "Verbal",
        quota: 50,
        subtopics: ["Vocabulary", "Grammar", "Sentence Skills", "Reading Skills"],
      },
      {
        name: "Numerical Reasoning",
        keyword: "Numerical",
        quota: 45,
        subtopics: ["Basic Operations", "Word Problems", "Data Interpretation"],
      },
      {
        name: "Analytical Reasoning",
        keyword: "Analytical",
        quota: 45,
        subtopics: ["Word Analogy", "Logic & Inferences", "Number Series"],
      },
      {
        name: "General Information",
        keyword: "General",
        quota: 30,
        subtopics: ["Philippine Constitution", "R.A. 6713", "Peace & Human Rights"],
      },
    ];

    let finalExamQuestions: any[] = [];
    const addedIds = new Set<string>();

    for (const subject of subjectOrder) {
      let subjectCollected: any[] = [];
      const subCount = subject.subtopics.length;
      const perSubtopicQuota = Math.floor(subject.quota / subCount);
      let extraQuota = subject.quota % subCount;

      // Step A: Attempt subtopic-balanced selection for this subject
      for (const sub of subject.subtopics) {
        const subQuota = perSubtopicQuota + (extraQuota > 0 ? 1 : 0);
        if (extraQuota > 0) extraQuota--;

        if (subQuota <= 0) continue;

        // Fetch unmastered questions for this subtopic
        let subQuestions = await prisma.question.findMany({
          where: {
            category: { contains: subject.keyword, mode: "insensitive" },
            subtopic: { equals: sub, mode: "insensitive" },
            ...(masteredQuestionIds.size > 0
              ? { id: { notIn: Array.from(masteredQuestionIds) } }
              : {}),
          },
        });

        // Top up with mastered questions for this subtopic if needed
        if (subQuestions.length < subQuota && masteredQuestionIds.size > 0) {
          const masteredSub = await prisma.question.findMany({
            where: {
              category: { contains: subject.keyword, mode: "insensitive" },
              subtopic: { equals: sub, mode: "insensitive" },
              id: { in: Array.from(masteredQuestionIds) },
            },
          });
          subQuestions = [...subQuestions, ...masteredSub];
        }

        subQuestions = subQuestions.sort(() => Math.random() - 0.5);
        for (const q of subQuestions.slice(0, subQuota)) {
          if (!addedIds.has(q.id)) {
            addedIds.add(q.id);
            subjectCollected.push(q);
          }
        }
      }

      // Step B: Top up subject block from general category pool if subtopic queries didn't reach full quota
      if (subjectCollected.length < subject.quota) {
        let generalCatQuestions = await prisma.question.findMany({
          where: {
            category: { contains: subject.keyword, mode: "insensitive" },
            id: { notIn: Array.from(addedIds) },
          },
        });

        generalCatQuestions = generalCatQuestions.sort(() => Math.random() - 0.5);
        const needed = subject.quota - subjectCollected.length;

        for (const q of generalCatQuestions.slice(0, needed)) {
          addedIds.add(q.id);
          subjectCollected.push(q);
        }
      }

      finalExamQuestions.push(...subjectCollected);
    }

    // ------------------------------------------------------------------
    // 4. ULTIMATE FALLBACK SAFEGUARDS (PREVENTS EMPTY EXAM SCREENS)
    // ------------------------------------------------------------------
    // If total items < 170, fill up with any remaining questions in DB
    if (finalExamQuestions.length < 170) {
      const extraQuestions = await prisma.question.findMany({
        where: { id: { notIn: Array.from(addedIds) } },
        take: 170 - finalExamQuestions.length,
      });

      for (const q of extraQuestions) {
        if (!addedIds.has(q.id)) {
          addedIds.add(q.id);
          finalExamQuestions.push(q);
        }
      }
    }

    // Absolute fallback: If DB matches returned nothing, fetch top 170 questions
    if (finalExamQuestions.length === 0) {
      finalExamQuestions = await prisma.question.findMany({
        take: 170,
      });
      finalExamQuestions = finalExamQuestions.sort(() => Math.random() - 0.5);
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