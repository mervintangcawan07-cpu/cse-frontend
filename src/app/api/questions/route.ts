import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Fetch all questions from Neon database
    const questions = await prisma.question.findMany({
      select: {
        id: true,
        category: true,
        prompt: true,
        options: true,
        answerIndex: true,
        explanation: true,
      },
    });

    return NextResponse.json({ questions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}