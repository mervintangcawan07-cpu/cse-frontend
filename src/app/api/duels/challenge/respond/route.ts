// Relative Path: src/app/api/duels/challenge/respond/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const userId = session?.userId ? String(session.userId) : null;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { matchId, action } = body; // action: "ACCEPT" | "DECLINE"

    if (!matchId || !action) {
      return NextResponse.json({ error: "Missing matchId or action" }, { status: 400 });
    }

    const match = await prisma.duelMatch.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      return NextResponse.json({ error: "Duel match not found." }, { status: 404 });
    }

    // Verify caller is the challenged user or player 2
    if (match.challengedUserId && match.challengedUserId !== userId && match.player1Id !== userId) {
      return NextResponse.json({ error: "You are not authorized to respond to this challenge." }, { status: 403 });
    }

    const responder = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const responderName = responder?.name || "Opponent";

    if (action === "ACCEPT") {
      const updatedMatch = await prisma.duelMatch.update({
        where: { id: matchId },
        data: {
          player2Id: userId,
          player2Name: responderName,
          status: "IN_PROGRESS",
        },
      });

      // Notify challenger that match was accepted
      if (match.player1Id !== userId) {
        await createNotification({
          userId: match.player1Id,
          title: "⚔️ Duel Accepted!",
          message: `${responderName} accepted your duel challenge! Match starting now.`,
          type: "STUDY_ROOM_INVITE",
        }).catch(() => null);
      }

      return NextResponse.json({
        success: true,
        match: updatedMatch,
        playerRole: userId === match.player1Id ? "P1" : "P2",
      });
    }

    if (action === "DECLINE") {
      const updatedMatch = await prisma.duelMatch.update({
        where: { id: matchId },
        data: {
          status: "DECLINED",
        },
      });

      // Notify challenger that match was declined
      if (match.player1Id !== userId) {
        await createNotification({
          userId: match.player1Id,
          title: "⚔️ Duel Declined",
          message: `${responderName} declined your duel challenge.`,
          type: "INFO",
        }).catch(() => null);
      }

      return NextResponse.json({ success: true, match: updatedMatch });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[DUEL_RESPOND_ERROR]", error);
    return NextResponse.json({ error: "Failed to process duel response." }, { status: 500 });
  }
}
