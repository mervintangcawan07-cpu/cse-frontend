// Relative Path: src/app/api/social/messages/[conversationId]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> | { conversationId: string } }
) {
  try {
    const resolvedParams = await params;
    const conversationId = String(resolvedParams.conversationId);

    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    // Verify user is a participant
    const participant = await prisma.directMessageParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      return NextResponse.json({ error: "Access denied to conversation" }, { status: 403 });
    }

    // Mark messages sent by other user as READ
    await prisma.directMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        state: { not: "READ" },
      },
      data: { state: "READ" },
    });

    const messages = await prisma.directMessage.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            studyProfile: { select: { displayName: true, avatar: true } },
          },
        },
        replyTo: { select: { id: true, content: true, senderId: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                isPaid: true,
                lastActiveAt: true,
                studyProfile: { select: { displayName: true, avatar: true } },
              },
            },
          },
        },
      },
    });

    const otherParticipant = conversation?.participants.find((p) => p.userId !== userId)?.user || null;

    return NextResponse.json({
      success: true,
      otherUser: otherParticipant,
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        senderName: m.sender.studyProfile?.displayName || m.sender.name,
        state: m.state,
        createdAt: m.createdAt,
        replyTo: m.replyTo
          ? {
              id: m.replyTo.id,
              content: m.replyTo.content,
              senderId: m.replyTo.senderId,
            }
          : null,
      })),
    });
  } catch (error: any) {
    console.error("[MESSAGES_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch messages", details: error?.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> | { conversationId: string } }
) {
  try {
    const resolvedParams = await params;
    const conversationId = String(resolvedParams.conversationId);

    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    const participant = await prisma.directMessageParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      return NextResponse.json({ error: "Access denied to conversation" }, { status: 403 });
    }

    const body = await request.json();
    const { content, replyToId } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Message content cannot be empty" }, { status: 400 });
    }

    const message = await prisma.directMessage.create({
      data: {
        conversationId,
        senderId: userId,
        content: content.trim(),
        state: "SENT",
        replyToId: replyToId ? String(replyToId) : null,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            studyProfile: { select: { displayName: true } },
          },
        },
        replyTo: { select: { id: true, content: true, senderId: true } },
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // 🔔 Dispatch direct message notification to the other participant
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    const otherParticipant = conversation?.participants.find((p) => p.userId !== userId);
    if (otherParticipant) {
      const senderName = message.sender.studyProfile?.displayName || message.sender.name || "A classmate";
      const preview = content.trim().length > 65 ? `${content.trim().slice(0, 62)}...` : content.trim();

      await createNotification({
        userId: otherParticipant.userId,
        type: "DIRECT_MESSAGE",
        title: `New Message from ${senderName}`,
        message: `"${preview}"`,
      });
    }

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        senderName: message.sender.studyProfile?.displayName || message.sender.name,
        state: message.state,
        createdAt: message.createdAt,
        replyTo: message.replyTo,
      },
    });
  } catch (error: any) {
    console.error("[MESSAGES_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to send message", details: error?.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> | { conversationId: string } }
) {
  try {
    const resolvedParams = await params;
    const conversationId = String(resolvedParams.conversationId);

    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId");

    // 1. Single message deletion if messageId is provided
    if (messageId) {
      const msg = await prisma.directMessage.findUnique({
        where: { id: String(messageId) },
      });

      if (!msg || msg.conversationId !== conversationId) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }

      if (msg.senderId !== userId && session?.role !== "ADMIN") {
        return NextResponse.json({ error: "You can only delete your own messages" }, { status: 403 });
      }

      await prisma.directMessage.delete({
        where: { id: String(messageId) },
      });

      return NextResponse.json({ success: true, message: "Message deleted" });
    }

    // 2. Full conversation deletion (Authorized for either classmate participant or ADMIN)
    const isParticipant = await prisma.directMessageParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!isParticipant && session?.role !== "ADMIN") {
      return NextResponse.json({ error: "Access denied: You are not a participant in this conversation" }, { status: 403 });
    }

    // Cascade deletion of messages and participants is handled by DB schema relation
    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    return NextResponse.json({ success: true, message: "Conversation deleted successfully" });
  } catch (error: any) {
    console.error("[MESSAGES_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to delete message or conversation", details: error?.message }, { status: 500 });
  }
}