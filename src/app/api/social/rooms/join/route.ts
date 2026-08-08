// Relative Path: src/app/api/social/rooms/join/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const { roomId, inviteCode } = body;

    if (!roomId && !inviteCode) {
      return NextResponse.json({ error: "Provide either a Room ID or Invite Code" }, { status: 400 });
    }

    let room = null;
    if (inviteCode) {
      room = await prisma.studyRoom.findUnique({
        where: { inviteCode: String(inviteCode).toUpperCase().trim() },
        include: { participants: true },
      });
    } else {
      room = await prisma.studyRoom.findUnique({
        where: { id: String(roomId) },
        include: { participants: true },
      });
    }

    if (!room || room.state === "ENDED" || room.state === "CANCELLED") {
      return NextResponse.json({ error: "Study Room not found or no longer active" }, { status: 404 });
    }

    // Check if user is already a member
    const existing = room.participants.find((p) => p.userId === userId);
    if (existing) {
      return NextResponse.json({ success: true, roomId: room.id, message: "Already in room" });
    }

    // Check participant capacity
    if (room.participants.length >= room.maxParticipants) {
      return NextResponse.json({ error: "Study Room is at maximum capacity" }, { status: 400 });
    }

    // Check privacy authorization
    if (!room.isPublic && !inviteCode) {
      return NextResponse.json({ error: "Private room requires an invite code or link" }, { status: 403 });
    }

    await prisma.studyRoomParticipant.create({
      data: {
        roomId: room.id,
        userId,
        role: "MEMBER",
      },
    });

    return NextResponse.json({ success: true, roomId: room.id, message: "Joined Study Room!" });
  } catch (error: any) {
    console.error("[ROOM_JOIN_ERROR]", error);
    return NextResponse.json({ error: "Failed to join room", details: error?.message }, { status: 500 });
  }
}