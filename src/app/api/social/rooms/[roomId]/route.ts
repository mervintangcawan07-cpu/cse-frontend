// Relative Path: src/app/api/social/rooms/[roomId]/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function GET(
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
      include: {
        host: {
          select: {
            id: true,
            name: true,
            email: true,
            lastActiveAt: true,
            studyProfile: {
              select: {
                displayName: true,
                avatar: true,
                presenceStatus: true,
                customStatusText: true,
                customStatusEmoji: true,
                showActivity: true,
              },
            },
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                isPaid: true,
                lastActiveAt: true,
                studyProfile: {
                  select: {
                    displayName: true,
                    avatar: true,
                    presenceStatus: true,
                    customStatusText: true,
                    customStatusEmoji: true,
                    showActivity: true,
                  },
                },
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Study room not found" }, { status: 404 });
    }

    const currentParticipant = room.participants.find((p) => p.userId === userId);
    const isMember = Boolean(currentParticipant);
    if (!room.isPublic && !isMember) {
      return NextResponse.json({ error: "Access denied to private room" }, { status: 403 });
    }

    const currentUserRole = room.hostId === userId ? "HOST" : (currentParticipant?.role || "MEMBER");

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        topic: room.topic,
        isPublic: room.isPublic,
        maxParticipants: room.maxParticipants,
        inviteCode: room.inviteCode,
        state: room.state,
        allowMemberWhiteboard: room.allowMemberWhiteboard ?? true,
        allowMemberScreenShare: room.allowMemberScreenShare ?? true,
        allowMemberChat: room.allowMemberChat ?? true,
        isLocked: room.isLocked ?? false,
        activeTopicType: room.activeTopicType || null,
        activeQuestionId: room.activeQuestionId || null,
        activeTopicImage: room.activeTopicImage || null,
        activeTopicMeta: room.activeTopicMeta || null,
        host: {
          id: room.host.id,
          name: room.host.studyProfile?.displayName || room.host.name,
          studyProfile: room.host.studyProfile,
        },
        hostId: room.hostId,
        isHost: room.hostId === userId,
        currentUserRole,
        isMember,
        participants: room.participants.map((p) => ({
          id: p.id,
          userId: p.userId,
          role: p.userId === room.hostId ? "HOST" : p.role,
          canDraw: p.canDraw ?? true,
          canShare: p.canShare ?? true,
          isMuted: p.isMuted ?? false,
          name: p.user.studyProfile?.displayName || p.user.name,
          displayName: p.user.studyProfile?.displayName || p.user.name,
          avatar: p.user.studyProfile?.avatar || null,
          studyProfile: p.user.studyProfile,
          isPaid: p.user.isPaid,
          lastActiveAt: p.user.lastActiveAt,
          joinedAt: p.joinedAt,
        })),
      },
    });
  } catch (error: any) {
    console.error("[ROOM_DETAIL_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch room details", details: error?.message }, { status: 500 });
  }
}

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

    const room = await prisma.studyRoom.findUnique({ where: { id: roomId } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    if (room.hostId !== userId) {
      return NextResponse.json({ error: "Only the room host can modify settings" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      topic,
      isPublic,
      state,
      allowMemberWhiteboard,
      allowMemberScreenShare,
      allowMemberChat,
      isLocked,
    } = body;

    const updateData: any = {};
    if (name) updateData.name = String(name).trim();
    if (description !== undefined) updateData.description = description ? String(description).trim() : null;
    if (topic) updateData.topic = String(topic).trim();
    if (isPublic !== undefined) updateData.isPublic = Boolean(isPublic);
    if (state && ["SCHEDULED", "ACTIVE", "ENDED", "CANCELLED"].includes(state)) {
      updateData.state = state;
    }
    if (allowMemberWhiteboard !== undefined) updateData.allowMemberWhiteboard = Boolean(allowMemberWhiteboard);
    if (allowMemberScreenShare !== undefined) updateData.allowMemberScreenShare = Boolean(allowMemberScreenShare);
    if (allowMemberChat !== undefined) updateData.allowMemberChat = Boolean(allowMemberChat);
    if (isLocked !== undefined) updateData.isLocked = Boolean(isLocked);

    const updatedRoom = await prisma.studyRoom.update({
      where: { id: roomId },
      data: updateData,
    });

    return NextResponse.json({ success: true, room: updatedRoom, message: "Room updated successfully" });
  } catch (error: any) {
    console.error("[ROOM_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Failed to update room", details: error?.message }, { status: 500 });
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

    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json({ error: "Study room not found" }, { status: 404 });
    }

    // 🔒 Strictly enforce that ONLY the room host (or ADMIN) can delete the study room
    if (room.hostId !== userId && authenticatedUser.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only the room host can delete this study room" },
        { status: 403 }
      );
    }

    // Cascade deletion of participants and messages is handled by DB schema relations
    await prisma.studyRoom.delete({
      where: { id: roomId },
    });

    return NextResponse.json({
      success: true,
      message: "Study Room deleted successfully",
    });
  } catch (error: any) {
    console.error("[ROOM_DELETE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to delete study room", details: error?.message },
      { status: 500 }
    );
  }
}
