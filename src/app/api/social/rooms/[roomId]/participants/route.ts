// Relative Path: src/app/api/social/rooms/[roomId]/participants/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
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
      include: { participants: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Study room not found" }, { status: 404 });
    }

    const isHost = room.hostId === userId;
    const callerParticipant = room.participants.find((p) => p.userId === userId);
    const isModerator = callerParticipant?.role === "MODERATOR";

    if (!isHost && !isModerator) {
      return NextResponse.json({ error: "Only Host and Moderators can manage participant controls" }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId, role, canDraw, canShare, isMuted } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
    }

    const targetParticipant = room.participants.find((p) => p.userId === String(targetUserId));
    if (!targetParticipant) {
      return NextResponse.json({ error: "Participant not found in room" }, { status: 404 });
    }

    // Moderators cannot manage host or other moderators
    if (isModerator && !isHost) {
      if (targetParticipant.userId === room.hostId || targetParticipant.role === "MODERATOR") {
        return NextResponse.json({ error: "Moderators cannot modify Host or other Moderators" }, { status: 403 });
      }
    }

    const updateData: any = {};

    // Only Host can change participant roles (Promote to Moderator / Demote to Member)
    if (role !== undefined) {
      if (!isHost) {
        return NextResponse.json({ error: "Only the Room Host can promote or demote roles" }, { status: 403 });
      }
      if (role === "MODERATOR" || role === "MEMBER") {
        updateData.role = role;
      }
    }

    if (canDraw !== undefined) updateData.canDraw = Boolean(canDraw);
    if (canShare !== undefined) updateData.canShare = Boolean(canShare);
    if (isMuted !== undefined) updateData.isMuted = Boolean(isMuted);

    const updated = await prisma.studyRoomParticipant.update({
      where: {
        roomId_userId: {
          roomId,
          userId: String(targetUserId),
        },
      },
      data: updateData,
    });

    return NextResponse.json({ success: true, participant: updated });
  } catch (error: any) {
    console.error("[ROOM_PARTICIPANT_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Failed to update participant", details: error?.message }, { status: 500 });
  }
}

export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("targetUserId");

    if (!targetUserId) {
      return NextResponse.json({ error: "Target user ID required" }, { status: 400 });
    }

    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
      include: { participants: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Study room not found" }, { status: 404 });
    }

    const isHost = room.hostId === userId;
    const callerParticipant = room.participants.find((p) => p.userId === userId);
    const isModerator = callerParticipant?.role === "MODERATOR";

    if (!isHost && !isModerator) {
      return NextResponse.json({ error: "Only the host or moderators can remove participants" }, { status: 403 });
    }

    if (targetUserId === room.hostId) {
      return NextResponse.json({ error: "The Room Host cannot be removed" }, { status: 400 });
    }

    const targetParticipant = room.participants.find((p) => p.userId === String(targetUserId));
    if (!targetParticipant) {
      return NextResponse.json({ error: "Participant not found in room" }, { status: 404 });
    }

    // Moderators cannot remove other moderators
    if (isModerator && !isHost && targetParticipant.role === "MODERATOR") {
      return NextResponse.json({ error: "Moderators cannot remove other moderators" }, { status: 403 });
    }

    await prisma.studyRoomParticipant.delete({
      where: { roomId_userId: { roomId, userId: String(targetUserId) } },
    });

    return NextResponse.json({ success: true, message: "Participant removed from room" });
  } catch (error: any) {
    console.error("[ROOM_PARTICIPANT_KICK_ERROR]", error);
    return NextResponse.json({ error: "Failed to remove participant", details: error?.message }, { status: 500 });
  }
}