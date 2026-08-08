// Relative Path: src/app/api/social/rooms/[roomId]/participants/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    const room = await prisma.studyRoom.findUnique({ where: { id: roomId } });
    if (!room || room.hostId !== userId) {
      return NextResponse.json({ error: "Only the host can remove participants" }, { status: 403 });
    }

    if (targetUserId === userId) {
      return NextResponse.json({ error: "Host cannot kick themselves" }, { status: 400 });
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