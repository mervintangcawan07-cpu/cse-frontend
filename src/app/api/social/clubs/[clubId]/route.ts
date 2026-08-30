// Relative Path: src/app/api/social/clubs/[clubId]/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

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
        owner: {
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

    const currentMember = club.members.find((m) => m.userId === userId);
    const isOwner = club.ownerId === userId;
    const isMember = Boolean(currentMember);

    return NextResponse.json({
      success: true,
      club: {
        id: club.id,
        name: club.name,
        description: club.description,
        category: club.category,
        isPublic: club.isPublic,
        ownerId: club.ownerId,
        isOwner,
        isMember,
        currentUserRole: isOwner ? "OWNER" : (currentMember?.role || null),
        memberCount: club.members.length,
        owner: {
          id: club.owner.id,
          name: club.owner.studyProfile?.displayName || club.owner.name,
          studyProfile: club.owner.studyProfile,
        },
        members: club.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.userId === club.ownerId ? "OWNER" : m.role,
          name: m.user.studyProfile?.displayName || m.user.name || "Examinee",
          displayName: m.user.studyProfile?.displayName || m.user.name || "Examinee",
          avatar: m.user.studyProfile?.avatar || null,
          joinedAt: m.joinedAt,
        })),
      },
    });
  } catch (error: any) {
    console.error("[CLUB_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch study club", details: error?.message }, { status: 500 });
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

    const club = await prisma.studyClub.findUnique({
      where: { id: clubId },
    });

    if (!club) {
      return NextResponse.json({ error: "Study club not found" }, { status: 404 });
    }

    // 🔒 Strictly enforce that ONLY the club owner (or ADMIN) can delete the club
    if (club.ownerId !== userId && authenticatedUser.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only the club owner can delete this study club" },
        { status: 403 }
      );
    }

    // Cascade deletion of members is handled by DB schema relation
    await prisma.studyClub.delete({
      where: { id: clubId },
    });

    return NextResponse.json({
      success: true,
      message: "Study Club deleted successfully",
    });
  } catch (error: any) {
    console.error("[CLUB_DELETE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to delete study club", details: error?.message },
      { status: 500 }
    );
  }
}
