import { NextResponse } from "next/server";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";
import { updateBankQuestion, softDeleteBankQuestions } from "@/lib/questionBank";
import { questionBankErrorResponse } from "@/lib/contentEligibility";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated && authentication.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !authentication.authenticated ||
      authentication.session.user.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { category, prompt, options, optionA, optionB, optionC, optionD, answerIndex, explanation, imageUrl } = body;

    let finalOptions: string[] = [];
    if (Array.isArray(options) && options.length >= 2) {
      finalOptions = options;
    } else if (optionA && optionB) {
      finalOptions = [optionA, optionB, optionC, optionD].filter(Boolean);
    }

    if (!prompt || finalOptions.length < 2 || answerIndex === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const updatedQuestion = await updateBankQuestion("ORDINARY", id, {
        category: (category || "").trim(),
        prompt: (prompt || "").trim(),
        options: finalOptions,
        answerIndex: Number(answerIndex),
        explanation: (explanation || "").trim(),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl ? String(imageUrl).trim() : null } : {}),
    });

    return NextResponse.json({
      success: true,
      question: updatedQuestion,
      message: "Question updated successfully.",
    });
  } catch (error: any) {
    const bankError = questionBankErrorResponse(error);
    if (bankError) return bankError;
    console.error("[UPDATE_QUESTION_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update question in database" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated && authentication.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !authentication.authenticated ||
      authentication.session.user.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    await softDeleteBankQuestions("ORDINARY", [id], authentication.session.user.id);

    return NextResponse.json({
      success: true,
      message: "Question moved to Trash successfully.",
    });
  } catch (error: any) {
    const bankError = questionBankErrorResponse(error);
    if (bankError) return bankError;
    console.error("[DELETE_QUESTION_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to delete question from database" },
      { status: 500 }
    );
  }
}
