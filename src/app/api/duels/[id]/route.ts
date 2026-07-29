import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = String(session.userId);
    const { id } = await params;
    const { questionIndex, selectedIndex } = await request.json();

    const match = await prisma.duelMatch.findUnique({ where: { id } });
    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    const questions: any[] = match.questions as any[];
    const currentQ = questions[questionIndex];
    const isCorrect = currentQ && selectedIndex === currentQ.answerIndex;

    const isP1 = userId === match.player1Id;
    const isP2 = userId === match.player2Id;

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

    let status = match.status;
    let winnerId = match.winnerId;

    // Finish match if both players complete 5 rounds or timer ends
    if (p1Current >= 5 && (p2Current >= 5 || !match.player2Id)) {
      status = "FINISHED";
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