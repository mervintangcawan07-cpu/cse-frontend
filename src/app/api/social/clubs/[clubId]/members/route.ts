// Relative Path: src/app/api/social/clubs/[clubId]/members/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> | { clubId: string } }
) {
  try {
    const resolvedParams = await params;
    const clubId = String(resolvedParams.clubId);

    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

    const club = await prisma.studyClub.findUnique({
      where: { id: clubId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                studyProfile: {
                  select: {
                    displayName: true,
                    avatar: true,
                    presenceStatus: true,
                  },
                },
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!club) {
      return NextResponse.json({ error: "Study club not found" }, { status: 404 });
    }

    const callerMember = club.members.find((m) => m.userId === userId);
    const isOwner = club.ownerId === userId || callerMember?.role === "OWNER";
    const isAdmin = callerMember?.role === "ADMIN";

    return NextResponse.json({
      success: true,
      clubName: club.name,
      ownerId: club.ownerId,
      currentUserRole: isOwner ? "OWNER" : (isAdmin ? "ADMIN" : "MEMBER"),
      members: club.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.userId === club.ownerId ? "OWNER" : m.role,
        name: m.user.studyProfile?.displayName || m.user.name || "Examinee",
        displayName: m.user.studyProfile?.displayName || m.user.name || "Examinee",
        avatar: m.user.studyProfile?.avatar || null,
        joinedAt: m.joinedAt,
      })),
    });
  } catch (error: any) {
    console.error("[CLUB_MEMBERS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch club members", details: error?.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> | { clubId: string } }
) {
  try {
    const resolvedParams = await params;
    const clubId = String(resolvedParams.clubId);

    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

    const club = await prisma.studyClub.findUnique({
      where: { id: clubId },
      include: { members: true },
    });

    if (!club) {
      return NextResponse.json({ error: "Study club not found" }, { status: 404 });
    }

    const isOwner = club.ownerId === userId;
    const isPlatformAdmin = authenticatedUser.role === "ADMIN";

    // 🔒 Only the group owner or platform admin can promote or demote club moderators/admins
    if (!isOwner && !isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only the club owner can assign moderator roles." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetUserId, role } = body;

    if (!targetUserId || !role || !["ADMIN", "MEMBER"].includes(role)) {
      return NextResponse.json({ error: "Invalid target user or role" }, { status: 400 });
    }

    if (targetUserId === club.ownerId) {
      return NextResponse.json({ error: "Cannot change the club owner's role directly" }, { status: 400 });
    }

    const targetMember = club.members.find((m) => m.userId === String(targetUserId));
    if (!targetMember) {
      return NextResponse.json({ error: "Member not found in this club" }, { status: 404 });
    }

    const updated = await prisma.studyClubMember.update({
      where: { id: targetMember.id },
      data: { role },
    });

    // 🔔 Dispatch notification if promoted to Moderator
    if (role === "ADMIN") {
      await createNotification({
        userId: String(targetUserId),
        type: "STUDY_CLUB_MODERATOR",
        title: "Promoted to Club Moderator! 🛡️",
        message: `You were promoted to Moderator in study club "${club.name}". You now have community moderation privileges.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: role === "ADMIN" ? "Member promoted to Moderator!" : "Moderator demoted to Member.",
      member: updated,
    });
  } catch (error: any) {
    console.error("[CLUB_MEMBERS_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Failed to update member role", details: error?.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> | { clubId: string } }
) {
  try {
    const resolvedParams = await params;
    const clubId = String(resolvedParams.clubId);

    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("targetUserId");

    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId parameter is required" }, { status: 400 });
    }

    const club = await prisma.studyClub.findUnique({
      where: { id: clubId },
      include: { members: true },
    });

    if (!club) {
      return NextResponse.json({ error: "Study club not found" }, { status: 404 });
    }

    // 🔒 Identify caller's actual role in database
    const callerMember = club.members.find((m) => m.userId === userId);
    const isOwner = club.ownerId === userId || callerMember?.role === "OWNER";
    const isClubAdmin = callerMember?.role === "ADMIN";
    const isPlatformAdmin = authenticatedUser.role === "ADMIN";

    // 🔒 STRICT AUTHORIZATION GATE: Regular members cannot remove anyone
    if (!isOwner && !isClubAdmin && !isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to remove members from this club." },
        { status: 403 }
      );
    }

    // 🔒 Cannot remove the Club Owner
    if (targetUserId === club.ownerId) {
      return NextResponse.json(
        { error: "The Club Owner cannot be removed. To leave, the owner must transfer ownership or delete the club." },
        { status: 400 }
      );
    }

    // 🔒 Cannot remove oneself through the kick endpoint (must use leave flow)
    if (targetUserId === userId) {
      return NextResponse.json(
        { error: "You cannot kick yourself. Please use the Leave Club option instead." },
        { status: 400 }
      );
    }

    const targetMember = club.members.find((m) => m.userId === String(targetUserId));
    if (!targetMember) {
      return NextResponse.json({ error: "Target user is not a member of this club" }, { status: 404 });
    }

    // 🔒 Moderators/Admins cannot remove other Moderators/Admins (only the Owner can)
    if (isClubAdmin && !isOwner && !isPlatformAdmin && targetMember.role === "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Club Moderators cannot remove other Moderators." },
        { status: 403 }
      );
    }

    // Execute member removal
    await prisma.studyClubMember.delete({
      where: { id: targetMember.id },
    });

    return NextResponse.json({
      success: true,
      message: "Member successfully removed from the study club.",
    });
  } catch (error: any) {
    console.error("[CLUB_MEMBER_REMOVE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to remove member", details: error?.message },
      { status: 500 }
    );
  }
}
