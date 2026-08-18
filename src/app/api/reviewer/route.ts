import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/serverAuth";
import { cachedJsonResponse, CACHE_PROFILES } from "@/lib/cache";

// GET: Fetch all study notes
export async function GET() {
  try {
    const notes = await prisma.studyNote.findMany({ orderBy: { createdAt: "desc" } });
    return cachedJsonResponse(
      { notes },
      "STATIC_METADATA"
    );
  } catch (error) {
    console.error("[REVIEWER_NOTES_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch study notes" },
      { status: 500, headers: CACHE_PROFILES.PRIVATE }
    );
  }
}

// POST: Create a new study note
export async function POST(req: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(req);
    if (errorResponse) return errorResponse;

    const { category, title, summary, content, tips, videoUrl } = await req.json();
    const note = await prisma.studyNote.create({
      data: {
        category,
        title,
        summary,
        content: Array.isArray(content) ? content : [content],
        tips,
        videoUrl: videoUrl || null,
      },
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}

// PUT: Update an existing study note
export async function PUT(req: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(req);
    if (errorResponse) return errorResponse;

    const { id, category, title, summary, content, tips, videoUrl } = await req.json();
    if (!id) return NextResponse.json({ error: "Note ID required" }, { status: 400 });

    const note = await prisma.studyNote.update({
      where: { id },
      data: {
        category,
        title,
        summary,
        content: Array.isArray(content) ? content : [content],
        tips,
        videoUrl: videoUrl || null,
      },
    });

    return NextResponse.json({ note });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

// DELETE: Remove a study note
export async function DELETE(req: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(req);
    if (errorResponse) return errorResponse;

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.studyNote.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
