// Relative Path: src/app/api/social/rooms/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Generate unique 6-character alphanumeric invite code
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all"; // 'all', 'mine', 'public'

    const whereClause: any = { state: { in: ["ACTIVE", "SCHEDULED"] } };

    if (filter === "mine") {
      whereClause.participants = { some: { userId } };
    } else if (filter === "public") {
      whereClause.isPublic = true;
    } else {
      whereClause.OR = [{ isPublic: true }, { participants: { some: { userId } } }];
    }

    const rooms = await prisma.studyRoom.findMany({
      where: whereClause,
      include: {
        host: { select: { id: true, name: true, email: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true, isPaid: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedRooms = rooms.map((room) => ({
      id: room.id,
      name: room.name,
      description: room.description,
      topic: room.topic,
      isPublic: room.isPublic,
      maxParticipants: room.maxParticipants,
      inviteCode: room.inviteCode,
      scheduledFor: room.scheduledFor,
      state: room.state,
      host: room.host,
      participantCount: room.participants.length,
      isHost: room.hostId === userId,
      isMember: room.participants.some((p) => p.userId === userId),
      createdAt: room.createdAt,
    }));

    return NextResponse.json({ success: true, rooms: formattedRooms });
  } catch (error: any) {
    console.error("[ROOMS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch study rooms", details: error?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    const body = await request.json();
    const { name, description, topic, isPublic, maxParticipants, scheduledFor } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Room name is required" }, { status: 400 });
    }

    const limit = Math.min(Math.max(Number(maxParticipants) || 10, 2), 50);

    let inviteCode = generateInviteCode();
    while (await prisma.studyRoom.findUnique({ where: { inviteCode } })) {
      inviteCode = generateInviteCode();
    }

    const room = await prisma.studyRoom.create({
      data: {
        name: name.trim(),
        description: description ? String(description).trim() : null,
        topic: topic ? String(topic).trim() : "General Review",
        isPublic: isPublic !== false,
        maxParticipants: limit,
        inviteCode,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        state: scheduledFor && new Date(scheduledFor) > new Date() ? "SCHEDULED" : "ACTIVE",
        hostId: userId,
        participants: {
          create: {
            userId,
            role: "HOST",
          },
        },
      },
      include: {
        host: { select: { id: true, name: true } },
        participants: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({ success: true, room, message: "Study Room created successfully!" });
  } catch (error: any) {
    console.error("[ROOMS_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to create study room", details: error?.message }, { status: 500 });
  }
}