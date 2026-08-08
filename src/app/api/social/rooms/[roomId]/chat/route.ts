// Relative Path: src/app/api/social/rooms/[roomId]/chat/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
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

    const participant = await prisma.studyRoomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!participant) {
      return NextResponse.json({ error: "Access denied to room chat" }, { status: 403 });
    }

    const messages = await prisma.studyRoomMessage.findMany({
      where: { roomId },
      include: {
        sender: { select: { id: true, name: true, role: true, isPaid: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    const pinnedMessage = messages.find((m) => m.isPinned) || null;

    return NextResponse.json({
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        senderName: m.sender.name || "Examinee",
        isPaid: m.sender.isPaid,
        isPinned: m.isPinned,
        createdAt: m.createdAt,
      })),
      pinnedMessage: pinnedMessage
        ? {
            id: pinnedMessage.id,
            content: pinnedMessage.content,
            senderName: pinnedMessage.sender.name || "Examinee",
          }
        : null,
    });
  } catch (error: any) {
    console.error("[ROOM_CHAT_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch room messages", details: error?.message }, { status: 500 });
  }
}

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

    const participant = await prisma.studyRoomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!participant) {
      return NextResponse.json({ error: "Must be a room participant to send messages" }, { status: 403 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Message content cannot be empty" }, { status: 400 });
    }

    const message = await prisma.studyRoomMessage.create({
      data: {
        roomId,
        senderId: userId,
        content: content.trim(),
      },
      include: {
        sender: { select: { id: true, name: true, isPaid: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        senderName: message.sender.name || "Examinee",
        isPaid: message.sender.isPaid,
        isPinned: message.isPinned,
        createdAt: message.createdAt,
      },
    });
  } catch (error: any) {
    console.error("[ROOM_CHAT_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to send room message", details: error?.message }, { status: 500 });
  }
}

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

    const room = await prisma.studyRoom.findUnique({ where: { id: roomId } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    if (room.hostId !== userId) {
      return NextResponse.json({ error: "Only room host can pin messages" }, { status: 403 });
    }

    const body = await request.json();
    const { messageId } = body;

    if (!messageId) {
      return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
    }

    const targetMessage = await prisma.studyRoomMessage.findUnique({
      where: { id: String(messageId) },
    });

    if (!targetMessage || targetMessage.roomId !== roomId) {
      return NextResponse.json({ error: "Message not found in room" }, { status: 404 });
    }

    const newPinnedStatus = !targetMessage.isPinned;

    if (newPinnedStatus) {
      await prisma.studyRoomMessage.updateMany({
        where: { roomId },
        data: { isPinned: false },
      });
    }

    await prisma.studyRoomMessage.update({
      where: { id: String(messageId) },
      data: { isPinned: newPinnedStatus },
    });

    return NextResponse.json({ success: true, message: newPinnedStatus ? "Message pinned" : "Message unpinned" });
  } catch (error: any) {
    console.error("[ROOM_CHAT_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Failed to pin message", details: error?.message }, { status: 500 });
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
    const messageId = searchParams.get("messageId");

    if (!messageId) {
      return NextResponse.json({ error: "Missing messageId parameter" }, { status: 400 });
    }

    const msg = await prisma.studyRoomMessage.findUnique({
      where: { id: String(messageId) },
      include: { room: { select: { hostId: true } } },
    });

    if (!msg || msg.roomId !== roomId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (msg.senderId !== userId && msg.room.hostId !== userId) {
      return NextResponse.json({ error: "Forbidden from deleting this message" }, { status: 403 });
    }

    await prisma.studyRoomMessage.delete({
      where: { id: String(messageId) },
    });

    return NextResponse.json({ success: true, message: "Room message deleted" });
  } catch (error: any) {
    console.error("[ROOM_CHAT_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to delete room message", details: error?.message }, { status: 500 });
  }
}