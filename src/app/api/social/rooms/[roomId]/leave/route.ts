// Relative Path: src/app/api/social/rooms/[roomId]/leave/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function handleLeaveRoom(
  request: Request,
  params: Promise<{ roomId: string }> | { roomId: string }
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
      return NextResponse.json({ error: "You are not in this room" }, { status: 404 });
    }

    // Remove user from room participants
    await prisma.studyRoomParticipant.delete({
      where: { roomId_userId: { roomId, userId } },
    });

    // If host leaves and other participants remain, assign host role to next participant
    if (participant.role === "HOST") {
      const remaining = await prisma.studyRoomParticipant.findFirst({
        where: { roomId },
        orderBy: { joinedAt: "asc" },
      });

      if (remaining) {
        await prisma.$transaction([
          prisma.studyRoomParticipant.update({
            where: { id: remaining.id },
            data: { role: "HOST" },
          }),
          prisma.studyRoom.update({
            where: { id: roomId },
            data: { hostId: remaining.userId },
          }),
        ]);
      } else {
        // Mark room as ENDED when all participants have left
        await prisma.studyRoom.update({
          where: { id: roomId },
          data: { state: "ENDED" },
        });
      }
    }

    return NextResponse.json({ success: true, message: "Left Study Room successfully" });
  } catch (error: any) {
    console.error("[ROOM_LEAVE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to leave room", details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  return handleLeaveRoom(request, params);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  return handleLeaveRoom(request, params);
}
