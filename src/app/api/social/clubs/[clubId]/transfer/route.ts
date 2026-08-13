// Relative Path: src/app/api/social/clubs/[clubId]/transfer/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    const body = await request.json();
    const { newOwnerId, andLeave } = body;

    if (!newOwnerId || typeof newOwnerId !== "string") {
      return NextResponse.json({ error: "New owner ID is required" }, { status: 400 });
    }

    if (newOwnerId === userId) {
      return NextResponse.json({ error: "You are already the owner of this club" }, { status: 400 });
    }

    const club = await prisma.studyClub.findUnique({
      where: { id: clubId },
      include: {
        members: true,
      },
    });

    if (!club) {
      return NextResponse.json({ error: "Study club not found" }, { status: 404 });
    }

    if (club.ownerId !== userId) {
      return NextResponse.json({ error: "Only the current club owner can transfer ownership" }, { status: 403 });
    }

    // Verify new owner is an active member in this club
    const newOwnerMember = club.members.find((m) => m.userId === newOwnerId);
    if (!newOwnerMember) {
      return NextResponse.json({ error: "Selected user is not a member of this club" }, { status: 400 });
    }

    // Execute atomic transaction for ownership transfer
    await prisma.$transaction(async (tx) => {
      // 1. Update club owner
      await tx.studyClub.update({
        where: { id: clubId },
        data: { ownerId: newOwnerId },
      });

      // 2. Promote target member to OWNER
      await tx.studyClubMember.update({
        where: { id: newOwnerMember.id },
        data: { role: "OWNER" },
      });

      // 3. Handle previous owner's membership
      const oldOwnerMember = club.members.find((m) => m.userId === userId);
      if (oldOwnerMember) {
        if (andLeave) {
          await tx.studyClubMember.delete({
            where: { id: oldOwnerMember.id },
          });
        } else {
          await tx.studyClubMember.update({
            where: { id: oldOwnerMember.id },
            data: { role: "MEMBER" },
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: andLeave
        ? "Ownership transferred successfully and you have left the study club."
        : "Ownership transferred successfully.",
    });
  } catch (error: any) {
    console.error("[CLUB_TRANSFER_OWNERSHIP_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to transfer club ownership", details: error?.message },
      { status: 500 }
    );
  }
}
