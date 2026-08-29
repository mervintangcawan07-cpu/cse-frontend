// Relative Path: src/app/api/duels/challenge/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    const body = await request.json();
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });
    }

    if (targetUserId === userId) {
      return NextResponse.json({ error: "You cannot challenge yourself." }, { status: 400 });
    }

    const challengerName = user.name || "Examinee";

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "Target classmate not found." }, { status: 404 });
    }

    // Pick 5 rapid-fire questions across subjects
    const rawQuestions = await prisma.question.findMany({ take: 20 });
    const shuffled = [...rawQuestions].sort(() => Math.random() - 0.5).slice(0, 5);
    const formattedQuestions = shuffled.map((q) => {
      const indexedOptions = q.options.map((opt, idx) => ({
        text: opt,
        isCorrect: idx === q.answerIndex,
      }));
      const shuffledOptions = [...indexedOptions].sort(() => Math.random() - 0.5);

      return {
        id: q.id,
        category: q.category,
        prompt: q.prompt,
        options: shuffledOptions.map((o) => o.text),
        answerIndex: shuffledOptions.findIndex((o) => o.isCorrect),
        explanation: q.explanation,
      };
    });

    // Create new duel room as Player 1 with WAITING_FOR_ACCEPT
    const match = await prisma.duelMatch.create({
      data: {
        player1Id: userId,
        player1Name: challengerName,
        challengedUserId: targetUserId,
        status: "WAITING_FOR_ACCEPT",
        questions: formattedQuestions,
      },
    });

    // Send real-time notification to target classmate
    await createNotification({
      userId: targetUserId,
      title: "⚔️ 1v1 Speed Duel Challenge!",
      message: `${challengerName} has challenged you to a 5-question speed duel!`,
      type: "STUDY_ROOM_INVITE",
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      match,
      playerRole: "P1",
    });
  } catch (error: any) {
    console.error("[DUEL_CHALLENGE_ERROR]", error);
    return NextResponse.json({ error: "Failed to send duel challenge." }, { status: 500 });
  }
}
