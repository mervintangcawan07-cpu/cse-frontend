import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await req.json();
    const { score, totalItems, correct, incorrect, skipped } = body;

    // Save exam result linked to logged-in user ID retrieved from JWT session
    const newResult = await prisma.examResult.create({
      data: {
        userId: String(session.userId),
        score: Number(score),
        totalItems: Number(totalItems),
        correct: Number(correct),
        incorrect: Number(incorrect),
        skipped: Number(skipped),
      },
    });

    return NextResponse.json(
      { message: "Exam result saved successfully!", data: newResult },
      { status: 201 }
    );
  } catch (error) {
    console.error("[EXAM_SUBMIT_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}