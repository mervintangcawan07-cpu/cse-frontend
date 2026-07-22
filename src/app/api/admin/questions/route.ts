import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET ALL QUESTIONS
export async function GET() {
  try {
    const questions = await prisma.question.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ questions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// CREATE A NEW QUESTION
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = await prisma.question.create({
      data: {
        category: body.category,
        prompt: body.prompt,
        options: body.options,
        answerIndex: body.answerIndex,
        explanation: body.explanation,
      },
    });
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    console.error("Error creating question:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}