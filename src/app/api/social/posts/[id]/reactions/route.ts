// Relative Path: src/app/api/social/posts/[id]/reactions/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_REACTIONS = ["GOT_IT", "SAME_STRUGGLE", "HIGH_YIELD", "KEEP_PUSHING"];

// POST /api/social/posts/[id]/reactions - Toggle reaction on a post
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const postId = params.id;

    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

    const body = await request.json();
    const reactionType = String(body.reactionType || "").toUpperCase();

    if (!VALID_REACTIONS.includes(reactionType)) {
      return NextResponse.json({ error: "Invalid reaction type" }, { status: 400 });
    }

    const post = await prisma.studyPost.findUnique({
      where: { id: postId, deletedAt: null },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if user already gave this exact reaction
    const existing = await prisma.studyPostReaction.findUnique({
      where: {
        postId_userId_reactionType: {
          postId,
          userId,
          reactionType: reactionType as any,
        },
      },
    });

    if (existing) {
      // Remove reaction (toggle off)
      await prisma.studyPostReaction.delete({
        where: { id: existing.id },
      });
    } else {
      // Add reaction
      await prisma.studyPostReaction.create({
        data: {
          postId,
          userId,
          reactionType: reactionType as any,
        },
      });
    }

    // Fetch updated reaction counts and user reactions for this post
    const allReactions = await prisma.studyPostReaction.findMany({
      where: { postId },
      select: { userId: true, reactionType: true },
    });

    const reactionCounts: Record<string, number> = {
      GOT_IT: 0,
      SAME_STRUGGLE: 0,
      HIGH_YIELD: 0,
      KEEP_PUSHING: 0,
    };
    const userReactions: string[] = [];

    allReactions.forEach((r) => {
      if (reactionCounts[r.reactionType] !== undefined) {
        reactionCounts[r.reactionType]++;
      }
      if (r.userId === userId) {
        userReactions.push(r.reactionType);
      }
    });

    return NextResponse.json({
      success: true,
      reactions: reactionCounts,
      userReactions,
    });
  } catch (error: any) {
    console.error("Failed to toggle reaction:", error);
    return NextResponse.json(
      { error: "Failed to toggle reaction", details: error?.message },
      { status: 500 }
    );
  }
}
