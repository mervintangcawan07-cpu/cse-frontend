import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordUserActivityStreak } from "@/lib/streakEngine";

export async function POST(request: Request) {
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
    const body = await request.json();
    const { score, totalItems, correct, incorrect, skipped } = body;

    // Save exam result record
    const result = await prisma.examResult.create({
      data: {
        userId,
        score: Number(score) || 0,
        totalItems: Number(totalItems) || 0,
        correct: Number(correct) || 0,
        incorrect: Number(incorrect) || 0,
        skipped: Number(skipped) || 0,
      },
    });

    // ⚡ Record active study streak automatically
    const updatedStreak = await recordUserActivityStreak(userId);

    // Clear any active exam draft once successfully submitted
    await prisma.examDraft.delete({
      where: { userId },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      result,
      streak: updatedStreak?.currentStreak || 1,
    });
  } catch (error) {
    console.error("Exam submission error:", error);
    return NextResponse.json({ error: "Failed to process exam result" }, { status: 500 });
  }
}