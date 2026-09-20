import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { DuelStatus } from "@prisma/client";
import { isDuelEnabled } from "@/lib/config/features";
import { sanitizeDuelMatchForPlayer } from "@/lib/duels/sanitize";

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

    return NextResponse.json({ success: true, match: sanitizeDuelMatchForPlayer(match) });
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
    const body = await request.json().catch(() => ({}));
    const { questionIndex, selectedIndex } = body;

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

    // Expected current index validation
    const expectedCurrentIndex = isP1 ? match.p1Current : match.p2Current;
    if (questionIndex !== expectedCurrentIndex) {
      return NextResponse.json(
        { error: "Question index does not match expected round or has already been answered" },
        { status: 409 }
      );
    }

    const currentQ = questions[questionIndex];
    if (!currentQ) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const optionsCount = Array.isArray(currentQ.options) ? currentQ.options.length : 4;
    if (
      typeof selectedIndex !== "number" ||
      !Number.isInteger(selectedIndex) ||
      (selectedIndex !== -1 && (selectedIndex < 0 || selectedIndex >= optionsCount))
    ) {
      return NextResponse.json({ error: "Invalid selectedIndex" }, { status: 400 });
    }

    const isCorrect = selectedIndex !== -1 && selectedIndex === currentQ.answerIndex;
    const scoreIncrement = isCorrect ? 20 : 0;
    const nextIndex = questionIndex + 1;
    const totalQuestions = questions.length || 5;

    // Concurrency / replay safe atomic transaction
    const finalMatch = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.duelMatch.updateMany({
        where: {
          id,
          ...(isP1 ? { p1Current: questionIndex } : { p2Current: questionIndex }),
          status: { notIn: [DuelStatus.FINISHED, DuelStatus.DECLINED] },
        },
        data: {
          ...(isP1
            ? { p1Current: nextIndex, p1Score: { increment: scoreIncrement } }
            : { p2Current: nextIndex, p2Score: { increment: scoreIncrement } }),
        },
      });

      if (updateResult.count === 0) {
        throw new Error("CONCURRENT_UPDATE_CONFLICT");
      }

      const current = await tx.duelMatch.findUnique({ where: { id } });
      if (!current) throw new Error("MATCH_NOT_FOUND");

      if (current.p1Current >= totalQuestions && (current.p2Current >= totalQuestions || !current.player2Id)) {
        let winnerId = "DRAW";
        if (current.p1Score > current.p2Score) winnerId = current.player1Id;
        else if (current.p2Score > current.p1Score) winnerId = current.player2Id!;

        return await tx.duelMatch.update({
          where: { id },
          data: {
            status: DuelStatus.FINISHED,
            winnerId,
          },
        });
      }

      return current;
    });

    return NextResponse.json({
      success: true,
      match: sanitizeDuelMatchForPlayer(finalMatch),
      isCorrect,
      correctIndex: currentQ.answerIndex,
    });
  } catch (error: any) {
    if (error?.message === "CONCURRENT_UPDATE_CONFLICT") {
      return NextResponse.json(
        { error: "Conflict: Round has already been processed" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to submit answer" }, { status: 500 });
  }
}
