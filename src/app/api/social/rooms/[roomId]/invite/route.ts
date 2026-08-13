// Relative Path: src/app/api/social/rooms/[roomId]/invite/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  try {
    const resolvedParams = await params;
    const roomId = String(resolvedParams.roomId);

    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
      include: {
        host: {
          select: {
            name: true,
            studyProfile: { select: { displayName: true } },
          },
        },
        participants: true,
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Study room not found" }, { status: 404 });
    }

    const isHost = room.hostId === userId;
    const isParticipant = room.participants.some((p) => p.userId === userId);

    if (!isHost && !isParticipant) {
      return NextResponse.json({ error: "You must be in the room to send invites" }, { status: 403 });
    }

    const body = await request.json();
    const targetUserIds: string[] = Array.isArray(body.targetUserIds)
      ? body.targetUserIds
      : body.targetUserId
      ? [String(body.targetUserId)]
      : [];

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: "No target user IDs provided" }, { status: 400 });
    }

    const callerUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        studyProfile: { select: { displayName: true } },
      },
    });

    const senderName = callerUser?.studyProfile?.displayName || callerUser?.name || "A classmate";

    let invitedCount = 0;
    for (const targetId of targetUserIds) {
      if (targetId === userId) continue;
      // Skip if already in room
      if (room.participants.some((p) => p.userId === targetId)) continue;

      await createNotification({
        userId: targetId,
        type: "STUDY_ROOM_INVITE",
        title: "Study Room Invitation 🎧",
        message: `${senderName} invited you to join the study room "${room.name}"!`,
      });
      invitedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Invitations sent to ${invitedCount} examinees!`,
      invitedCount,
    });
  } catch (error: any) {
    console.error("[ROOM_INVITE_ERROR]", error);
    return NextResponse.json({ error: "Failed to send room invites", details: error?.message }, { status: 500 });
  }
}
