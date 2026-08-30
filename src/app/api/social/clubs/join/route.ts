// Relative Path: src/app/api/social/clubs/join/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

    const body = await request.json();
    const { clubId, action } = body; // action: 'JOIN' | 'LEAVE'

    if (!clubId || !action || !["JOIN", "LEAVE"].includes(action)) {
      return NextResponse.json({ error: "Invalid club ID or action" }, { status: 400 });
    }

    const club = await prisma.studyClub.findUnique({
      where: { id: String(clubId) },
    });

    if (!club) {
      return NextResponse.json({ error: "Study club not found" }, { status: 404 });
    }

    const existingMember = await prisma.studyClubMember.findUnique({
      where: { clubId_userId: { clubId: String(clubId), userId } },
    });

    if (action === "JOIN") {
      if (existingMember) {
        return NextResponse.json({ success: true, message: "Already a member" });
      }
      await prisma.studyClubMember.create({
        data: {
          clubId: String(clubId),
          userId,
          role: "MEMBER",
        },
      });
      return NextResponse.json({ success: true, message: "Joined Study Club!" });
    }

    if (action === "LEAVE") {
      if (!existingMember) {
        return NextResponse.json({ error: "Not a member of this club" }, { status: 400 });
      }

      // 🔒 Prevent Club Owner from leaving without transferring ownership
      if (existingMember.role === "OWNER" || club.ownerId === userId) {
        return NextResponse.json(
          {
            error: "Club owner cannot leave without transferring ownership. Please transfer ownership or delete the club.",
            code: "OWNER_MUST_TRANSFER",
            requireTransfer: true,
          },
          { status: 400 }
        );
      }

      await prisma.studyClubMember.delete({
        where: { id: existingMember.id },
      });

      return NextResponse.json({ success: true, message: "Left Study Club" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[CLUB_JOIN_LEAVE_ERROR]", error);
    return NextResponse.json({ error: "Failed to update club membership", details: error?.message }, { status: 500 });
  }
}
