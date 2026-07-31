import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const { category, prompt, options, answerIndex, explanation } = body;

    if (!prompt || !options || options.length < 2 || answerIndex === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const updatedQuestion = await prisma.question.update({
      where: { id },
      data: {
        category,
        prompt,
        options,
        answerIndex: Number(answerIndex),
        explanation: explanation || "",
      },
    });

    return NextResponse.json({
      success: true,
      question: updatedQuestion,
      message: "Question updated successfully.",
    });
  } catch (error) {
    console.error("[UPDATE_QUESTION_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update question in database" },
      { status: 500 }
    );
  }
}