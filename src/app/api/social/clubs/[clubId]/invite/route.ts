// Relative Path: src/app/api/social/clubs/[clubId]/invite/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> | { clubId: string } }
) {
  try {
    const resolvedParams = await params;
    const clubId = String(resolvedParams.clubId);

    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    const club = await prisma.studyClub.findUnique({
      where: { id: clubId },
      include: {
        members: true,
      },
    });

    if (!club) {
      return NextResponse.json({ error: "Study club not found" }, { status: 404 });
    }

    const isMember = club.ownerId === userId || club.members.some((m) => m.userId === userId);
    if (!isMember) {
      return NextResponse.json({ error: "You must be a member of the club to invite others" }, { status: 403 });
    }

    const body = await request.json();
    const targetUserIds: string[] = Array.isArray(body.targetUserIds)
      ? body.targetUserIds
      : body.targetUserId
      ? [String(body.targetUserId)]
      : [];

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: "No target user IDs provided" }, { status: 400 });
    }

    const callerUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        studyProfile: { select: { displayName: true } },
      },
    });

    const senderName = callerUser?.studyProfile?.displayName || callerUser?.name || "A classmate";

    let invitedCount = 0;
    for (const targetId of targetUserIds) {
      if (targetId === userId) continue;
      // Skip if already in club
      if (club.members.some((m) => m.userId === targetId)) continue;

      await createNotification({
        userId: targetId,
        type: "STUDY_CLUB_INVITE",
        title: "Study Club Invitation 🏛️",
        message: `${senderName} invited you to join the study club "${club.name}"!`,
      });
      invitedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Invitations sent to ${invitedCount} examinees!`,
      invitedCount,
    });
  } catch (error: any) {
    console.error("[CLUB_INVITE_ERROR]", error);
    return NextResponse.json({ error: "Failed to send club invites", details: error?.message }, { status: 500 });
  }
}
