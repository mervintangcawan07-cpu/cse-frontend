// Relative Path: src/app/api/admin/questions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { andQuestionWhere, findBankQuestions, questionTextWhere, softDeleteBankQuestions, updateBankQuestion } from "@/lib/questionBank";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/serverAuth";
import { activeOrdinaryQuestionWhere, assertQuestionBankMetadata, questionBankErrorResponse } from "@/lib/contentEligibility";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    let where: Prisma.Sql = activeOrdinaryQuestionWhere();

    if (category && category !== "All") {
      where = andQuestionWhere(where, questionTextWhere("category", category, false, false));
    }

    const questions = await findBankQuestions({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      questions,
      count: questions.length,
    });
  } catch (error: unknown) {
    const bankError = questionBankErrorResponse(error);
    if (bankError) return bankError;
    const err = error as Error;
    console.error("[QUESTIONS_GET_ERROR]", err);
    return NextResponse.json(
      { error: "Failed to fetch questions." },
      { status: 500 }
    );
  }
}

function validateQuestionPayload(payload: {
  prompt: unknown;
  options: unknown;
  answerIndex: unknown;
  explanation?: unknown;
  category?: unknown;
  subtopic?: unknown;
}): { valid: true; parsedAnswerIndex: number } | { valid: false; error: string } {
  const { prompt, options, answerIndex, explanation, category, subtopic } = payload;

  if (typeof prompt !== "string" || !prompt.trim()) {
    return { valid: false, error: "Prompt is required and must be a non-empty string." };
  }
  if (prompt.length > 10000) {
    return { valid: false, error: "Prompt exceeds maximum length of 10,000 characters." };
  }

  if (!Array.isArray(options) || options.length < 2 || options.length > 10) {
    return { valid: false, error: "Options must be an array containing between 2 and 10 items." };
  }

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    if (typeof opt !== "string" || !opt.trim()) {
      return { valid: false, error: `Option at index ${i} must be a non-empty string.` };
    }
    if (opt.length > 2000) {
      return { valid: false, error: `Option at index ${i} exceeds maximum length of 2,000 characters.` };
    }
  }

  const parsedAnswerIndex = Number(answerIndex);
  if (
    !Number.isInteger(parsedAnswerIndex) ||
    parsedAnswerIndex < 0 ||
    parsedAnswerIndex >= options.length
  ) {
    return {
      valid: false,
      error: `answerIndex must be a valid integer between 0 and ${options.length - 1}.`,
    };
  }

  if (explanation !== null && explanation !== undefined) {
    if (typeof explanation !== "string") {
      return { valid: false, error: "Explanation must be a string." };
    }
    if (explanation.length > 10000) {
      return { valid: false, error: "Explanation exceeds maximum length of 10,000 characters." };
    }
  }

  if (category !== null && category !== undefined) {
    if (typeof category !== "string" || category.length > 255) {
      return { valid: false, error: "Category must be a string not exceeding 255 characters." };
    }
  }

  if (subtopic !== null && subtopic !== undefined) {
    if (typeof subtopic !== "string" || subtopic.length > 255) {
      return { valid: false, error: "Subtopic must be a string not exceeding 255 characters." };
    }
  }

  return { valid: true, parsedAnswerIndex };
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse || !user) {
      return errorResponse ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      category,
      subtopic = "General",
      prompt,
      imageUrl = null,
      options,
      answerIndex = 0,
      explanation = null,
      stepByStep = null,
      whyA = null,
      whyB = null,
      whyC = null,
      whyD = null,
      eliminationStrategy = null,
      commonTrap = null,
      examTip = null,
      difficulty = "MEDIUM",
      tags = [],
      skillTested = null,
    } = body;

    const validation = validateQuestionPayload({
      prompt,
      options,
      answerIndex,
      explanation,
      category,
      subtopic,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    assertQuestionBankMetadata({ category: category || "General", subtopic: subtopic || "General" }, "ORDINARY");

    const createdQuestion = await prisma.question.create({
      data: {
        bankType: "ORDINARY",
        category: category || "General",
        subtopic: subtopic || "General",
        prompt: prompt.trim(),
        imageUrl,
        options,
        optionA: options[0] || null,
        optionB: options[1] || null,
        optionC: options[2] || null,
        optionD: options[3] || null,
        answerIndex: validation.parsedAnswerIndex,
        explanation,
        stepByStep,
        whyA,
        whyB,
        whyC,
        whyD,
        eliminationStrategy,
        commonTrap,
        examTip,
        difficulty,
        tags: Array.isArray(tags) ? tags : [],
        skillTested,
      },
    });

    return NextResponse.json({
      success: true,
      question: createdQuestion,
    });
  } catch (error: unknown) {
    const bankError = questionBankErrorResponse(error);
    if (bankError) return bankError;
    const err = error as Error;
    console.error("[QUESTIONS_POST_ERROR]", err);
    return NextResponse.json(
      { error: "Failed to create question." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse || !user) {
      return errorResponse ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      category,
      subtopic = "General",
      prompt,
      imageUrl = null,
      options,
      answerIndex = 0,
      explanation = null,
      stepByStep = null,
      whyA = null,
      whyB = null,
      whyC = null,
      whyD = null,
      eliminationStrategy = null,
      commonTrap = null,
      examTip = null,
      difficulty = "MEDIUM",
      tags = [],
      skillTested = null,
    } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Question ID is required." },
        { status: 400 }
      );
    }

    const validation = validateQuestionPayload({
      prompt,
      options,
      answerIndex,
      explanation,
      category,
      subtopic,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updatedQuestion = await updateBankQuestion("ORDINARY", id, {
        category: category || "General",
        subtopic: subtopic || "General",
        prompt: prompt.trim(),
        imageUrl,
        options,
        optionA: options[0] || null,
        optionB: options[1] || null,
        optionC: options[2] || null,
        optionD: options[3] || null,
        answerIndex: validation.parsedAnswerIndex,
        explanation,
        stepByStep,
        whyA,
        whyB,
        whyC,
        whyD,
        eliminationStrategy,
        commonTrap,
        examTip,
        difficulty,
        tags: Array.isArray(tags) ? tags : [],
        skillTested,
    });

    return NextResponse.json({
      success: true,
      question: updatedQuestion,
    });
  } catch (error: unknown) {
    const bankError = questionBankErrorResponse(error);
    if (bankError) return bankError;
    const err = error as Error;
    console.error("[QUESTIONS_PUT_ERROR]", err);
    return NextResponse.json(
      { error: "Failed to update question." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse || !user) {
      return errorResponse ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get("id");

    let idsToDelete: string[] = [];
    if (queryId) {
      idsToDelete = [queryId];
    } else {
      try {
        const body = await request.json();
        if (Array.isArray(body.ids)) idsToDelete = body.ids;
        else if (body.id) idsToDelete = [body.id];
      } catch {
        // No body provided
      }
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: "No question ID(s) provided for deletion." }, { status: 400 });
    }

    const deletedCount = await softDeleteBankQuestions("ORDINARY", idsToDelete, user.id);

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Successfully moved ${deletedCount} question(s) to Trash Bin.`,
    });
  } catch (error: unknown) {
    const bankError = questionBankErrorResponse(error);
    if (bankError) return bankError;
    const err = error as Error;
    console.error("[QUESTIONS_DELETE_ERROR]", err);
    return NextResponse.json({ error: "Failed to soft-delete question(s)." }, { status: 500 });
  }
}
