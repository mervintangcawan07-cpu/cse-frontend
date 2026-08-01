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

    // 1. SAFELY FETCH USER'S MASTERED QUESTIONS TO PREVENT REPETITION OF SOLVED ITEMS
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

    // 2. SINGLE CATEGORY / SUBTOPIC DRILL MODE
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

      // Fallback: Fill up with mastered items if pool is smaller than requested limit
      if (questions.length < requestedLimit && masteredQuestionIds.size > 0) {
        const fallback = await prisma.question.findMany({
          where: {
            ...whereClause,
            id: { in: Array.from(masteredQuestionIds) },
          },
        });
        questions = [...questions, ...fallback];
      }

      // Shuffle and limit output
      questions = questions.sort(() => Math.random() - 0.5);

      return NextResponse.json({
        success: true,
        questions: questions.slice(0, requestedLimit),
      });
    }

    // 3. FULL COMPREHENSIVE EXAM MODE ("All"): BALANCED SUBJECT BLOCKS & SUBTOPICS
    // CSC Official Distribution Quotas (Total: 170 items)
    const subjectOrder = [
      {
        name: "Verbal Ability",
        quota: 50,
        subtopics: ["Vocabulary", "Grammar", "Sentence Skills", "Reading Skills"],
      },
      {
        name: "Numerical Reasoning",
        quota: 45,
        subtopics: ["Basic Operations", "Word Problems", "Data Interpretation"],
      },
      {
        name: "Analytical Reasoning",
        quota: 45,
        subtopics: ["Word Analogy", "Logic & Inferences", "Number Series"],
      },
      {
        name: "General Information",
        quota: 30,
        subtopics: ["Philippine Constitution", "R.A. 6713", "Peace & Human Rights"],
      },
    ];

    let finalExamQuestions: any[] = [];

    for (const subject of subjectOrder) {
      // Fetch all available unmastered questions for this category
      let subjectQuestions = await prisma.question.findMany({
        where: {
          category: { contains: subject.name.split(" ")[0], mode: "insensitive" },
          ...(masteredQuestionIds.size > 0
            ? { id: { notIn: Array.from(masteredQuestionIds) } }
            : {}),
        },
      });

      // Shuffle subject questions
      subjectQuestions = subjectQuestions.sort(() => Math.random() - 0.5);

      // Fallback: Top up with mastered questions for this subject if below quota
      if (subjectQuestions.length < subject.quota && masteredQuestionIds.size > 0) {
        let masteredSubjectQuestions = await prisma.question.findMany({
          where: {
            category: { contains: subject.name.split(" ")[0], mode: "insensitive" },
            id: { in: Array.from(masteredQuestionIds) },
          },
        });
        masteredSubjectQuestions = masteredSubjectQuestions.sort(() => Math.random() - 0.5);
        subjectQuestions = [...subjectQuestions, ...masteredSubjectQuestions];
      }

      // Add subject block up to its quota
      finalExamQuestions.push(...subjectQuestions.slice(0, subject.quota));
    }

    // Handle custom categories if database has items outside standard 4 categories
    const handledCategoryKeywords = ["Verbal", "Numerical", "Analytical", "General"];
    const customQuestions = await prisma.question.findMany({
      where: {
        AND: handledCategoryKeywords.map((keyword) => ({
          category: { not: { contains: keyword, mode: "insensitive" } },
        })),
      },
    });

    if (customQuestions.length > 0) {
      const shuffledCustom = customQuestions.sort(() => Math.random() - 0.5);
      finalExamQuestions.push(...shuffledCustom);
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

// 🎯 POST: BULK CSV IMPORT & SINGLE QUESTION CREATION (SAVES CATEGORY + SUBTOPIC + OPTIONS)
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

    // 1. Handle CSV payload or JSON payload safely
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