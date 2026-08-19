// Relative Path: src/app/api/social/posts/[id]/comments/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/social/posts/[id]/comments - List comments for a post
export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const postId = params.id;

    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const currentUserId = String(rawUserId);

    const comments = await prisma.studyPostComment.findMany({
      where: {
        postId,
        deletedAt: null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
            studyProfile: {
              select: {
                displayName: true,
                avatar: true,
                studyGoal: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formattedComments = comments.map((c) => ({
      id: c.id,
      content: c.content,
      isAnonymous: c.isAnonymous,
      isAccepted: c.isAccepted,
      createdAt: c.createdAt.toISOString(),
      isAuthor: c.authorId === currentUserId,
      author: c.isAnonymous
        ? {
            displayName: "Anonymous Examinee",
            avatar: "🎭",
            studyGoal: "Civil Service Exam",
            isAnonymous: true,
          }
        : {
            id: c.author.id,
            displayName: c.author.studyProfile?.displayName || c.author.name || "Examinee",
            avatar: c.author.studyProfile?.avatar || "avatar-grad",
            studyGoal: c.author.studyProfile?.studyGoal || "Civil Service Exam",
            role: c.author.role,
            isAnonymous: false,
          },
    }));

    return NextResponse.json({
      success: true,
      comments: formattedComments,
    });
  } catch (error: any) {
    console.error("Failed to fetch post comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments", details: error?.message },
      { status: 500 }
    );
  }
}

// POST /api/social/posts/[id]/comments - Add a solution or discussion comment
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const postId = params.id;

    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const authorId = String(rawUserId);

    const body = await request.json();
    const { content, isAnonymous } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
    }

    const post = await prisma.studyPost.findUnique({
      where: { id: postId, deletedAt: null },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const newComment = await prisma.studyPostComment.create({
      data: {
        postId,
        authorId,
        content: content.trim().slice(0, 2000),
        isAnonymous: Boolean(isAnonymous),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
            studyProfile: {
              select: {
                displayName: true,
                avatar: true,
                studyGoal: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      comment: {
        id: newComment.id,
        content: newComment.content,
        isAnonymous: newComment.isAnonymous,
        isAccepted: newComment.isAccepted,
        createdAt: newComment.createdAt.toISOString(),
        isAuthor: true,
        author: newComment.isAnonymous
          ? {
              displayName: "Anonymous Examinee",
              avatar: "🎭",
              studyGoal: "Civil Service Exam",
              isAnonymous: true,
            }
          : {
              id: newComment.author.id,
              displayName: newComment.author.studyProfile?.displayName || newComment.author.name || "Examinee",
              avatar: newComment.author.studyProfile?.avatar || "avatar-grad",
              studyGoal: newComment.author.studyProfile?.studyGoal || "Civil Service Exam",
              role: newComment.author.role,
              isAnonymous: false,
            },
      },
    });
  } catch (error: any) {
    console.error("Failed to add comment:", error);
    return NextResponse.json(
      { error: "Failed to add comment", details: error?.message },
      { status: 500 }
    );
  }
}
