import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// UPDATE A QUESTION
export async function PUT(
  request: Request, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // We must await the params object in modern Next.js
    const { id } = await params;
    const body = await request.json();
    
    const question = await prisma.question.update({
      where: { id },
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
export async function DELETE(
  request: Request, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // We must await the params object in modern Next.js
    const { id } = await params;
    
    await prisma.question.delete({
      where: { id },
    });
    return NextResponse.json({ message: "Question deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting question:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}