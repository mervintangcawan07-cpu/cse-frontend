import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Helper for Session Authentication
async function getAuthUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get("cse_session")?.value;
  if (!token) return null;

  const session = await verifyJWT(token);
  return session?.userId ? String(session.userId) : null;
}

// 1. GET ALL BOOKMARKED QUESTIONS FOR CURRENT USER
export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user bookmarks for questions
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        userId,
        targetType: "QUESTION",
      },
      orderBy: { createdAt: "desc" },
    });

    const questionIds = bookmarks.map((b) => b.targetId);

    // Fetch corresponding question details
    const questions = await prisma.question.findMany({
      where: {
        id: { in: questionIds },
      },
    });

    // Combine bookmark metadata with question content
    const bookmarkedQuestions = bookmarks
      .map((b) => {
        const question = questions.find((q) => q.id === b.targetId);
        if (!question) return null;
        return {
          bookmarkId: b.id,
          bookmarkedAt: b.createdAt,
          ...question,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, bookmarks: bookmarkedQuestions });
  } catch (error: any) {
    console.error("[BOOKMARKS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch bookmarks." }, { status: 500 });
  }
}

// 2. TOGGLE OR ADD BOOKMARK
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