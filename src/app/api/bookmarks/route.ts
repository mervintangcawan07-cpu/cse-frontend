import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

// Helper for Session Authentication
async function getAuthUserId() {
  return (await getAuthenticatedUser())?.id ?? null;
}

// 1. GET ALL BOOKMARKED QUESTIONS & STUDY NOTES FOR CURRENT USER
export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all user bookmarks
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // Extract target IDs by targetType
    const questionIds = bookmarks
      .filter((b) => b.targetType === "QUESTION" || !b.targetType)
      .map((b) => b.targetId);

    const studyNoteIds = bookmarks
      .filter((b) => b.targetType === "STUDY_NOTE")
      .map((b) => b.targetId);

    // Fetch corresponding entities from DB in parallel
    const [questions, studyNotes] = await Promise.all([
      prisma.question.findMany({
        where: { id: { in: questionIds } },
      }),
      prisma.studyNote.findMany({
        where: { id: { in: studyNoteIds } },
      }),
    ]);

    // Combine bookmark metadata with actual entity details
    const bookmarkedItems = bookmarks
      .map((b) => {
        const type = b.targetType || "QUESTION";

        if (type === "QUESTION") {
          const question = questions.find((q) => q.id === b.targetId);
          if (!question) return null;
          return {
            bookmarkId: b.id,
            targetType: "QUESTION",
            bookmarkedAt: b.createdAt,
            ...question,
          };
        }

        if (type === "STUDY_NOTE") {
          const note = studyNotes.find((n) => n.id === b.targetId);
          if (!note) return null;
          return {
            bookmarkId: b.id,
            targetType: "STUDY_NOTE",
            bookmarkedAt: b.createdAt,
            ...note,
          };
        }

        return null;
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, bookmarks: bookmarkedItems });
  } catch (error: any) {
    console.error("[BOOKMARKS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch bookmarks." }, { status: 500 });
  }
}

// 2. TOGGLE OR ADD BOOKMARK (QUESTION OR STUDY_NOTE)
export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { targetId, targetType = "QUESTION" } = body;

    if (!targetId) {
      return NextResponse.json({ error: "Target ID is required." }, { status: 400 });
    }

    // Check if bookmark exists
    const existing = await prisma.bookmark.findUnique({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType,
          targetId,
        },
      },
    });

    if (existing) {
      // Remove bookmark if already saved
      await prisma.bookmark.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({ success: true, isBookmarked: false, message: "Bookmark removed." });
    } else {
      // Add new bookmark
      const newBookmark = await prisma.bookmark.create({
        data: {
          userId,
          targetType,
          targetId,
        },
      });
      return NextResponse.json({ success: true, isBookmarked: true, bookmark: newBookmark });
    }
  } catch (error: any) {
    console.error("[BOOKMARKS_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to update bookmark." }, { status: 500 });
  }
}

// 3. DELETE SPECIFIC BOOKMARK BY ID
export async function DELETE(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Bookmark ID is required." }, { status: 400 });
    }

    await prisma.bookmark.deleteMany({
      where: {
        id,
        userId,
      },
    });

    return NextResponse.json({ success: true, message: "Bookmark deleted." });
  } catch (error: any) {
    console.error("[BOOKMARKS_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to delete bookmark." }, { status: 500 });
  }
}
