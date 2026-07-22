import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, score, totalItems, correct, incorrect, skipped } = body;

    // Validate required fields
    if (!userId || score === undefined) {
      return NextResponse.json(
        { error: "Missing required fields (userId, score)" },
        { status: 400 }
      );
    }

    // Save the exam result into Neon PostgreSQL via Prisma
    const newResult = await prisma.examResult.create({
      data: {
        userId,
        score,
        totalItems,
        correct,
        incorrect,
        skipped,
      },
    });

    return NextResponse.json(
      { message: "Exam result saved successfully!", data: newResult },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving exam result:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}