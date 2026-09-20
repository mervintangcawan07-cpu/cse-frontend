import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { DuelStatus } from "@prisma/client";
import { isDuelEnabled } from "@/lib/config/features";

interface DuelQuestionItem {
  options?: unknown[];
  answerIndex?: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isDuelEnabled()) {
      return NextResponse.json(
        { error: "Duels are temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { id } = await params;
    const match = await prisma.duelMatch.findUnique({
      where: { id },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, match });
  } catch (error) {
    return NextResponse.json({ error: "Failed to poll match state" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isDuelEnabled()) {
      return NextResponse.json(
        { error: "Duels are temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = user.id;
    const { id } = await params;
    const { questionIndex, selectedIndex } = await request.json();

    const match = await prisma.duelMatch.findUnique({ where: { id } });
    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    const isP1 = userId === match.player1Id;
    const isP2 = userId === match.player2Id;
    if (!isP1 && !isP2) {
      return NextResponse.json({ error: "Access denied: You are not a participant in this match" }, { status: 403 });
    }

    if (match.status === DuelStatus.FINISHED || match.status === DuelStatus.DECLINED) {
      return NextResponse.json({ error: "Match has already ended" }, { status: 400 });
    }

    const questions: DuelQuestionItem[] = Array.isArray(match.questions) ? (match.questions as DuelQuestionItem[]) : [];
    if (questions.length === 0) {
      return NextResponse.json({ error: "Match has no questions" }, { status: 400 });
    }

    if (
      typeof questionIndex !== "number" ||
      !Number.isInteger(questionIndex) ||
      questionIndex < 0 ||
      questionIndex >= questions.length
    ) {
      return NextResponse.json({ error: "Invalid questionIndex" }, { status: 400 });
    }

    const currentQ = questions[questionIndex];
    if (!currentQ) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const optionsCount = Array.isArray(currentQ.options) ? currentQ.options.length : 4;
    if (
      typeof selectedIndex !== "number" ||
      !Number.isInteger(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= optionsCount
    ) {
      return NextResponse.json({ error: "Invalid selectedIndex" }, { status: 400 });
    }

    const isCorrect = selectedIndex === currentQ.answerIndex;

    let p1Score = match.p1Score;
    let p2Score = match.p2Score;
    let p1Current = match.p1Current;
    let p2Current = match.p2Current;

    if (isP1) {
      p1Current = Math.max(p1Current, questionIndex + 1);
      if (isCorrect) p1Score += 20;
    } else if (isP2) {
      p2Current = Math.max(p2Current, questionIndex + 1);
      if (isCorrect) p2Score += 20;
    }

    let status: DuelStatus = match.status;
    let winnerId = match.winnerId;

    const totalQuestions = questions.length || 5;
    // Finish match if both players complete all rounds or timer ends
    if (p1Current >= totalQuestions && (p2Current >= totalQuestions || !match.player2Id)) {
      status = DuelStatus.FINISHED;
      if (p1Score > p2Score) winnerId = match.player1Id;
      else if (p2Score > p1Score) winnerId = match.player2Id;
      else winnerId = "DRAW";
    }

    const updated = await prisma.duelMatch.update({
      where: { id },
      data: {
        p1Score,
        p2Score,
        p1Current,
        p2Current,
        status,
        winnerId,
      },
    });

    return NextResponse.json({ success: true, match: updated, isCorrect });
  } catch (error) {
    return NextResponse.json({ error: "Failed to submit answer" }, { status: 500 });
  }
}
