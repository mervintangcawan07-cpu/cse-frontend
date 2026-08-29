import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = user.id;
    const userName = user.name || "Reviewee";

    // 1. Look for open match waiting for an opponent
    const openMatch = await prisma.duelMatch.findFirst({
      where: {
        status: "WAITING",
        player1Id: { not: userId },
      },
      orderBy: { createdAt: "asc" },
    });

    if (openMatch) {
      // Join match as Player 2
      const updatedMatch = await prisma.duelMatch.update({
        where: { id: openMatch.id },
        data: {
          player2Id: userId,
          player2Name: userName,
          status: "IN_PROGRESS",
        },
      });

      return NextResponse.json({ success: true, match: updatedMatch, playerRole: "P2" });
    }

    // 2. No open match: Pick 5 rapid-fire questions across subjects
    const rawQuestions = await prisma.question.findMany({
      take: 20,
    });

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

    // 3. Create new duel room as Player 1
    const newMatch = await prisma.duelMatch.create({
      data: {
        player1Id: userId,
        player1Name: userName,
        status: "WAITING",
        questions: formattedQuestions,
      },
    });

    return NextResponse.json({ success: true, match: newMatch, playerRole: "P1" });
  } catch (error: any) {
    console.error("[DUEL_MATCHMAKE_ERROR]", error);
    return NextResponse.json({ error: "Failed to create duel match." }, { status: 500 });
  }
}
