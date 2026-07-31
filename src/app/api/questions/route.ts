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
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = String(session.userId);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    // 1. Safely fetch user's past exam submissions to check question mastery
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

        // 🎯 MASTERED QUESTIONS: Exclude ONLY questions answered CORRECTLY at least once.
        // Questions answered INCORRECTLY remain in the active pool for re-testing!
        pastQuestions.forEach((q) => {
          const selectedIndices = pastAnswerMap.get(q.id) || [];
          if (selectedIndices.includes(q.answerIndex)) {
            masteredQuestionIds.add(q.id);
          }
        });
      }
    } catch (err) {
      // Gracefully ignore if answers column is not present in DB schema
    }

    // 2. SINGLE CATEGORY MODE
    if (category && category !== "All") {
      let questions = await prisma.question.findMany({
        where: {
          category,
          id: masteredQuestionIds.size > 0 ? { notIn: Array.from(masteredQuestionIds) } : undefined,
        },
      });

      // Fallback: If unmastered questions are under 170, fill up with mastered items
      if (questions.length < 170 && masteredQuestionIds.size > 0) {
        const fallback = await prisma.question.findMany({
          where: {
            category,
            id: { in: Array.from(masteredQuestionIds) },
          },
        });
        questions = [...questions, ...fallback];
      }

      // Shuffle order within category
      questions = questions.sort(() => Math.random() - 0.5);

      return NextResponse.json({ success: true, questions: questions.slice(0, 170) });
    }

    // 3. FULL COMPREHENSIVE EXAM MODE ("All"): Sequential Subject Blocks
    // Exact CSC Subject Order & Quotas (Total 170 items)
    const subjectOrder = [
      { name: "Verbal Ability", quota: 50 },
      { name: "Numerical Reasoning", quota: 45 },
      { name: "Analytical Ability", quota: 45 },
      { name: "General Information", quota: 30 },
    ];

    let finalExamQuestions: any[] = [];

    for (const subject of subjectOrder) {
      // Fetch unmastered items for this subject
      let catQuestions = await prisma.question.findMany({
        where: {
          category: subject.name,
          id: masteredQuestionIds.size > 0 ? { notIn: Array.from(masteredQuestionIds) } : undefined,
        },
      });

      // Shuffle questions WITHIN this subject block
      catQuestions = catQuestions.sort(() => Math.random() - 0.5);

      // If unmastered items are less than quota, fill up with mastered items from this subject
      if (catQuestions.length < subject.quota && masteredQuestionIds.size > 0) {
        let catMastered = await prisma.question.findMany({
          where: {
            category: subject.name,
            id: { in: Array.from(masteredQuestionIds) },
          },
        });
        catMastered = catMastered.sort(() => Math.random() - 0.5);
        catQuestions = [...catQuestions, ...catMastered];
      }

      // Append subject block questions sequentially up to quota
      finalExamQuestions.push(...catQuestions.slice(0, subject.quota));
    }

    // Fallback for custom categories if DB has subjects not in default list
    const handledCategories = new Set(subjectOrder.map((s) => s.name));
    const customCategories = await prisma.question.findMany({
      distinct: ["category"],
      where: { category: { notIn: Array.from(handledCategories) } },
      select: { category: true },
    });

    for (const customCat of customCategories) {
      let extraQuestions = await prisma.question.findMany({
        where: { category: customCat.category },
      });
      extraQuestions = extraQuestions.sort(() => Math.random() - 0.5);
      finalExamQuestions.push(...extraQuestions);
    }

    // Return subject blocks IN SEQUENTIAL ORDER (No global scramble across subjects)
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

// 🎯 POST: Bulk Upload / CSV Import & Single Question Creation
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId || session.role !== "ADMIN") {
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

    // 2. Sanitize and structure each question field cleanly
    const formattedData = rawQuestions
      .map((item: any) => {
        const category = (item.category || item.subject || "").trim();
        const prompt = (item.prompt || item.question || "").trim();
        const explanation = (item.explanation || "").trim();
        const imageUrl = (item.imageUrl || item.image_url || item.image || "").trim() || null;

        let options: string[] = [];
        if (Array.isArray(item.options)) {
          options = item.options.map((o: any) => String(o).trim());
        } else {
          options = [
            item.optionA || item.option_a || "",
            item.optionB || item.option_b || "",
            item.optionC || item.option_c || "",
            item.optionD || item.option_d || "",
          ]
            .map((o) => String(o).trim())
            .filter(Boolean);
        }

        let answerIndex = 0;
        if (typeof item.answerIndex === "number") {
          answerIndex = item.answerIndex;
        } else if (typeof item.answerIndex === "string") {
          answerIndex = parseInt(item.answerIndex, 10) || 0;
        } else if (typeof item.correctAnswer === "number") {
          answerIndex = item.correctAnswer;
        }

        return {
          category,
          prompt,
          options,
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