// Relative Path: src/app/api/social/clubs/[clubId]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
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
    });

    if (!club) {
      return NextResponse.json({ error: "Study club not found" }, { status: 404 });
    }

    // 🔒 Strictly enforce that ONLY the club owner (or ADMIN) can delete the club
    if (club.ownerId !== userId && session?.role !== "ADMIN") {
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
