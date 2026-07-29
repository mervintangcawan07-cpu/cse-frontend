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