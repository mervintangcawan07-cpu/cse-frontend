// Relative Path: src/app/api/social/rooms/[roomId]/participants/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  try {
    const resolvedParams = await params;
    const roomId = String(resolvedParams.roomId);

    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

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
    const isPlatformAdmin = authenticatedUser.role === "ADMIN";

    if (!isHost && !isModerator && !isPlatformAdmin) {
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
    if (isModerator && !isHost && !isPlatformAdmin) {
      if (targetParticipant.userId === room.hostId || targetParticipant.role === "MODERATOR") {
        return NextResponse.json({ error: "Moderators cannot modify Host or other Moderators" }, { status: 403 });
      }
    }

    const updateData: any = {};

    // Only Host or Platform Admin can change participant roles (Promote to Moderator / Demote to Member)
    if (role !== undefined) {
      if (!isHost && !isPlatformAdmin) {
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

    // 🔔 Dispatch notification if promoted to Moderator
    if (role === "MODERATOR") {
      await createNotification({
        userId: String(targetUserId),
        type: "STUDY_ROOM_MODERATOR",
        title: "Promoted to Room Moderator! 🛡️",
        message: `You were promoted to Moderator in study room "${room.name}". You now have participant moderation and drawing control privileges.`,
      });
    }

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

    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

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
    const isPlatformAdmin = authenticatedUser.role === "ADMIN";

    // 🔒 STRICT GATE: Regular members cannot remove participants
    if (!isHost && !isModerator && !isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden: Only the host or moderators can remove participants." }, { status: 403 });
    }

    if (targetUserId === room.hostId) {
      return NextResponse.json({ error: "The Room Host cannot be removed" }, { status: 400 });
    }

    if (targetUserId === userId) {
      return NextResponse.json({ error: "Cannot kick yourself. Please use Leave Room instead." }, { status: 400 });
    }

    const targetParticipant = room.participants.find((p) => p.userId === String(targetUserId));
    if (!targetParticipant) {
      return NextResponse.json({ error: "Participant not found in room" }, { status: 404 });
    }

    // Moderators cannot remove other moderators
    if (isModerator && !isHost && !isPlatformAdmin && targetParticipant.role === "MODERATOR") {
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
