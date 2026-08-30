// Relative Path: src/app/api/social/messages/conversations/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

    // Fetch user's conversation IDs
    const userParticipants = await prisma.directMessageParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    const conversationIds = userParticipants.map((p) => p.conversationId);

    const conversations = await prisma.conversation.findMany({
      where: { id: { in: conversationIds } },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, isPaid: true, lastActiveAt: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // ⚡ Batch query unread counts for all conversations in a single SQL operation
    const unreadGroups = await prisma.directMessage.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: userId },
        state: { not: "READ" },
      },
      _count: { id: true },
    });

    const unreadMap = new Map<string, number>(
      unreadGroups.map((g) => [g.conversationId, g._count.id])
    );

    const formatted = conversations.map((conv) => {
      const otherParticipant = conv.participants.find((p) => p.userId !== userId)?.user || null;
      const unreadCount = unreadMap.get(conv.id) || 0;
      const lastMessage = conv.messages[0] || null;

      return {
        id: conv.id,
        otherUser: otherParticipant,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              senderName: lastMessage.sender.name,
              state: lastMessage.state,
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount,
        updatedAt: conv.updatedAt,
      };
    });

    return NextResponse.json({ success: true, conversations: formatted });
  } catch (error: any) {
    console.error("[CONVERSATIONS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch conversations", details: error?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

    const body = await request.json();
    const { targetUserId } = body;

    if (!targetUserId || typeof targetUserId !== "string" || targetUserId === userId) {
      return NextResponse.json({ error: "Invalid target user ID" }, { status: 400 });
    }

    // Verify connected classmate status server-side
    const relation = await prisma.classmateRelation.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: userId },
        ],
      },
    });

    if (!relation || relation.status !== "ACCEPTED") {
      return NextResponse.json(
        { error: "You can only start conversations with connected classmates." },
        { status: 403 }
      );
    }

    // Check if conversation already exists
    const existingConversations = await prisma.conversation.findMany({
      where: {
        participants: {
          every: {
            userId: { in: [userId, targetUserId] },
          },
        },
      },
      include: {
        participants: true,
      },
    });

    const existingConv = existingConversations.find(
      (c) => c.participants.length === 2
    );

    if (existingConv) {
      return NextResponse.json({ success: true, conversationId: existingConv.id });
    }

    // Create new conversation
    const newConversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId }, { userId: targetUserId }],
        },
      },
    });

    return NextResponse.json({ success: true, conversationId: newConversation.id });
  } catch (error: any) {
    console.error("[CONVERSATIONS_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to create conversation", details: error?.message }, { status: 500 });
  }
}
