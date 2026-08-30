// Relative Path: src/app/api/social/clubs/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("query") || "";
    const filter = searchParams.get("filter") || "all";

    let whereClause: any = { isPublic: true };

    if (filter === "mine") {
      whereClause = {
        members: { some: { userId } },
      };
    } else if (search.trim()) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }

    const clubs = await prisma.studyClub.findMany({
      where: whereClause,
      include: {
        owner: { select: { id: true, name: true, isPaid: true } },
        members: { select: { id: true, userId: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedClubs = clubs.map((club) => ({
      id: club.id,
      name: club.name,
      description: club.description,
      category: club.category,
      isPublic: club.isPublic,
      owner: club.owner,
      isOwner: club.ownerId === userId,
      memberCount: club.members.length,
      isMember: club.members.some((m) => m.userId === userId),
    }));

    return NextResponse.json({ success: true, clubs: formattedClubs });
  } catch (error: any) {
    console.error("[CLUBS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch study clubs", details: error?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

    const body = await request.json();
    const { name, description, category, isPublic } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Club name is required" }, { status: 400 });
    }

    const club = await prisma.studyClub.create({
      data: {
        name: name.trim(),
        description: description ? String(description).trim() : null,
        category: category ? String(category).trim() : "General Study",
        isPublic: isPublic !== false,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: "OWNER",
          },
        },
      },
      include: {
        owner: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, club, message: "Study club created!" });
  } catch (error: any) {
    console.error("[CLUBS_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to create study club", details: error?.message }, { status: 500 });
  }
}
