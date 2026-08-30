// Relative Path: src/app/api/social/posts/[id]/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// DELETE /api/social/posts/[id] - Soft delete post if author or admin
export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const postId = params.id;

    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const currentUserId = authenticatedUser.id;

    const post = await prisma.studyPost.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, deletedAt: true },
    });

    if (!post || post.deletedAt) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const isAuthor = post.authorId === currentUserId;
    const isAdmin = authenticatedUser.role === "ADMIN";

    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden: You cannot delete this post." }, { status: 403 });
    }

    await prisma.studyPost.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "Post deleted successfully" });
  } catch (error: any) {
    console.error("Failed to delete post:", error);
    return NextResponse.json(
      { error: "Failed to delete post", details: error?.message },
      { status: 500 }
    );
  }
}
