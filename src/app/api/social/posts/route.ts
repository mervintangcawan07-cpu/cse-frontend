// Relative Path: src/app/api/social/posts/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/social/posts - List posts with topic filtering, reactions, and comment counts
export async function GET(request: Request) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const currentUserId = authenticatedUser.id;

    const { searchParams } = new URL(request.url);
    const topic = searchParams.get("topic") || "ALL"; // 'ALL', 'QUESTION_HELP', 'EXAM_INTEL', 'MINDSET_VENT', 'STUDY_HACKS'
    const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10), 50);

    const whereClause: any = {
      deletedAt: null,
    };

    if (topic && topic !== "ALL") {
      whereClause.topic = topic;
    }

    const posts = await prisma.studyPost.findMany({
      where: whereClause,
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
                experienceLevel: true,
              },
            },
          },
        },
        reactions: {
          select: {
            id: true,
            userId: true,
            reactionType: true,
          },
        },
        _count: {
          select: {
            comments: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: [
        { isPinned: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
    });

    const formattedPosts = posts.map((post) => {
      // Group reactions by reactionType and count
      const reactionCounts: Record<string, number> = {
        GOT_IT: 0,
        SAME_STRUGGLE: 0,
        HIGH_YIELD: 0,
        KEEP_PUSHING: 0,
      };

      const userReactions: string[] = [];

      post.reactions.forEach((r: any) => {
        if (reactionCounts[r.reactionType] !== undefined) {
          reactionCounts[r.reactionType]++;
        }
        if (r.userId === currentUserId) {
          userReactions.push(r.reactionType);
        }
      });

      const isAuthor = post.authorId === currentUserId;

      return {
        id: post.id,
        topic: post.topic,
        title: post.title,
        content: post.content,
        hasSpoiler: post.hasSpoiler,
        spoilerContent: post.spoilerContent,
        isAnonymous: post.isAnonymous,
        isPinned: post.isPinned,
        createdAt: post.createdAt.toISOString(),
        isAuthor,
        author: post.isAnonymous
          ? {
              displayName: "Anonymous Examinee",
              avatar: "🎭",
              studyGoal: "Civil Service Exam",
              isAnonymous: true,
            }
          : {
              id: post.author.id,
              displayName: post.author.studyProfile?.displayName || post.author.name || "Examinee",
              avatar: post.author.studyProfile?.avatar || "avatar-grad",
              studyGoal: post.author.studyProfile?.studyGoal || "Civil Service Exam",
              role: post.author.role,
              isAnonymous: false,
            },
        reactions: reactionCounts,
        userReactions,
        commentsCount: post._count.comments,
      };
    });

    return NextResponse.json({
      success: true,
      posts: formattedPosts,
    });
  } catch (error: any) {
    console.error("Failed to fetch study posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch study posts", details: error?.message },
      { status: 500 }
    );
  }
}

// POST /api/social/posts - Create a new Study Commons post
export async function POST(request: Request) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const authorId = authenticatedUser.id;

    const body = await request.json();
    const { topic, title, content, hasSpoiler, spoilerContent, isAnonymous } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Content is required." }, { status: 400 });
    }

    const validTopics = ["QUESTION_HELP", "EXAM_INTEL", "MINDSET_VENT", "STUDY_HACKS"];
    const postTopic = validTopics.includes(topic) ? topic : "QUESTION_HELP";

    const cleanContent = content.trim().slice(0, 5000);
    const cleanTitle = typeof title === "string" ? title.trim().slice(0, 150) : null;
    const cleanSpoiler = hasSpoiler && typeof spoilerContent === "string" ? spoilerContent.trim().slice(0, 3000) : null;

    const newPost = await prisma.studyPost.create({
      data: {
        authorId,
        topic: postTopic as any,
        title: cleanTitle || null,
        content: cleanContent,
        hasSpoiler: Boolean(hasSpoiler && cleanSpoiler),
        spoilerContent: cleanSpoiler || null,
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
      post: {
        id: newPost.id,
        topic: newPost.topic,
        title: newPost.title,
        content: newPost.content,
        hasSpoiler: newPost.hasSpoiler,
        spoilerContent: newPost.spoilerContent,
        isAnonymous: newPost.isAnonymous,
        isPinned: newPost.isPinned,
        createdAt: newPost.createdAt.toISOString(),
        isAuthor: true,
        author: newPost.isAnonymous
          ? {
              displayName: "Anonymous Examinee",
              avatar: "🎭",
              studyGoal: "Civil Service Exam",
              isAnonymous: true,
            }
          : {
              id: newPost.author.id,
              displayName: newPost.author.studyProfile?.displayName || newPost.author.name || "Examinee",
              avatar: newPost.author.studyProfile?.avatar || "avatar-grad",
              studyGoal: newPost.author.studyProfile?.studyGoal || "Civil Service Exam",
              role: newPost.author.role,
              isAnonymous: false,
            },
        reactions: {
          GOT_IT: 0,
          SAME_STRUGGLE: 0,
          HIGH_YIELD: 0,
          KEEP_PUSHING: 0,
        },
        userReactions: [],
        commentsCount: 0,
      },
    });
  } catch (error: any) {
    console.error("Failed to create study post:", error);
    return NextResponse.json(
      { error: "Failed to create study post", details: error?.message },
      { status: 500 }
    );
  }
}
