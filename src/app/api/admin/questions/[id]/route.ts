import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// UPDATE A QUESTION
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const question = await prisma.question.update({
      where: { id: params.id },
      data: {
        category: body.category,
        prompt: body.prompt,
        options: body.options,
        answerIndex: body.answerIndex,
        explanation: body.explanation,
      },
    });
    return NextResponse.json({ question }, { status: 200 });
  } catch (error) {
    console.error("Error updating question:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE A QUESTION
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.question.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ message: "Question deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting question:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}