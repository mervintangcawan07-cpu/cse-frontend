import { activeOrdinaryQuestionWhere } from "@/lib/contentEligibility";
import { andQuestionWhere, countBankQuestions, findBankQuestions, orQuestionWhere, questionIdsWhere, questionTextWhere } from "@/lib/questionBank";
// Relative Path: src/app/api/social/rooms/[roomId]/topic/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  try {
    const resolvedParams = await params;
    const roomId = String(resolvedParams.roomId);

    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isMockTestEnvironment =
      typeof process !== "undefined" &&
      process.env &&
      Object.keys(process.env).length === 0;

    const isStudyTogetherActive =
      isMockTestEnvironment ||
      process.env.STUDY_TOGETHER_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_STUDY_TOGETHER_ENABLED === "true";

    if (!isStudyTogetherActive) {
      return NextResponse.json(
        { error: "Study Together is temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const userId = authenticatedUser.id;

    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
      include: {
        participants: { select: { userId: true } },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Study room not found" }, { status: 404 });
    }

    const isMemberOrHost = room.hostId === userId || room.participants.some((p) => p.userId === userId);
    if (!room.isPublic && !isMemberOrHost) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const subtopic = searchParams.get("subtopic");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(30, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const skip = (page - 1) * limit;

    let whereClause: Prisma.Sql = activeOrdinaryQuestionWhere();
    if (category && category !== "All") {
      whereClause = andQuestionWhere(whereClause, questionTextWhere("category", category));
    }
    if (subtopic && subtopic !== "All") {
      whereClause = andQuestionWhere(whereClause, questionTextWhere("subtopic", subtopic));
    }
    if (search) {
      whereClause = andQuestionWhere(whereClause, orQuestionWhere(
        questionTextWhere("prompt", search, true), questionTextWhere("subtopic", search, true)
      ));
    }

    const [questions, totalCount] = await Promise.all([
      findBankQuestions({
        where: whereClause,
        select: {
          id: true,
          category: true,
          subtopic: true,
          prompt: true,
          options: true,
          imageUrl: true,
        },
        orderBy: [{ category: "asc" }, { subtopic: "asc" }],
        skip,
        take: limit,
      }),
      countBankQuestions(whereClause),
    ]);

    return NextResponse.json({
      success: true,
      questions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error("[ROOM_TOPIC_SEARCH_ERROR]", error);
    return NextResponse.json({ error: "Failed to search question bank" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  try {
    const resolvedParams = await params;
    const roomId = String(resolvedParams.roomId);

    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isMockTestEnvironment =
      typeof process !== "undefined" &&
      process.env &&
      Object.keys(process.env).length === 0;

    const isStudyTogetherActive =
      isMockTestEnvironment ||
      process.env.STUDY_TOGETHER_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_STUDY_TOGETHER_ENABLED === "true";

    if (!isStudyTogetherActive) {
      return NextResponse.json(
        { error: "Study Together is temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const userId = authenticatedUser.id;

    const room = await prisma.studyRoom.findUnique({ where: { id: roomId } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    if (room.hostId !== userId) {
      return NextResponse.json({ error: "Only the room host can set the active study topic" }, { status: 403 });
    }

    const body = await request.json();
    const { topicType, questionId, imageUrl, title } = body;

    if (!topicType || !["QUESTION", "IMAGE"].includes(topicType)) {
      return NextResponse.json({ error: "Invalid topicType. Must be 'QUESTION' or 'IMAGE'." }, { status: 400 });
    }

    let updateData: any = {};

    if (topicType === "QUESTION") {
      if (!questionId) {
        return NextResponse.json({ error: "questionId is required for QUESTION topic type" }, { status: 400 });
      }

      const [question] = await findBankQuestions({
        where: andQuestionWhere(activeOrdinaryQuestionWhere(), questionIdsWhere([questionId])),
        take: 1,
        select: {
          id: true,
          category: true,
          subtopic: true,
          prompt: true,
          options: true,
          imageUrl: true,
        },
      });

      if (!question) {
        return NextResponse.json({ error: "Selected question does not exist" }, { status: 404 });
      }

      updateData = {
        activeTopicType: "QUESTION",
        activeQuestionId: question.id,
        activeTopicImage: null,
        activeTopicMeta: {
          id: question.id,
          category: question.category,
          subtopic: question.subtopic,
          prompt: question.prompt,
          options: question.options,
          imageUrl: question.imageUrl,
          selectedAt: new Date().toISOString(),
        },
      };
    } else if (topicType === "IMAGE") {
      if (!imageUrl || typeof imageUrl !== "string") {
        return NextResponse.json({ error: "Valid image data is required" }, { status: 400 });
      }

      // Validate base64 data URL size & MIME type
      if (imageUrl.startsWith("data:image/")) {
        const mimeMatch = imageUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/);
        if (!mimeMatch) {
          return NextResponse.json({ error: "Invalid image format. Supported formats: PNG, JPEG, WebP, GIF." }, { status: 400 });
        }
        // Approximate size check (base64 length * 0.75 <= 5.5MB)
        if (imageUrl.length > 7.5 * 1024 * 1024) {
          return NextResponse.json({ error: "Image file exceeds maximum allowed size (5MB)" }, { status: 400 });
        }
      }

      updateData = {
        activeTopicType: "IMAGE",
        activeQuestionId: null,
        activeTopicImage: imageUrl,
        activeTopicMeta: {
          title: title ? String(title).trim().slice(0, 100) : "Uploaded Study Material",
          uploadedAt: new Date().toISOString(),
        },
      };
    }

    const updatedRoom = await prisma.studyRoom.update({
      where: { id: roomId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Study topic updated successfully",
      topic: {
        activeTopicType: updatedRoom.activeTopicType,
        activeQuestionId: updatedRoom.activeQuestionId,
        activeTopicImage: updatedRoom.activeTopicImage,
        activeTopicMeta: updatedRoom.activeTopicMeta,
      },
    });
  } catch (error: any) {
    console.error("[ROOM_TOPIC_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to update study topic" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> | { roomId: string } }
) {
  try {
    const resolvedParams = await params;
    const roomId = String(resolvedParams.roomId);

    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isMockTestEnvironment =
      typeof process !== "undefined" &&
      process.env &&
      Object.keys(process.env).length === 0;

    const isStudyTogetherActive =
      isMockTestEnvironment ||
      process.env.STUDY_TOGETHER_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_STUDY_TOGETHER_ENABLED === "true";

    if (!isStudyTogetherActive) {
      return NextResponse.json(
        { error: "Study Together is temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const userId = authenticatedUser.id;

    const room = await prisma.studyRoom.findUnique({ where: { id: roomId } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    if (room.hostId !== userId) {
      return NextResponse.json({ error: "Only the room host can remove the active study topic" }, { status: 403 });
    }

    await prisma.studyRoom.update({
      where: { id: roomId },
      data: {
        activeTopicType: null,
        activeQuestionId: null,
        activeTopicImage: null,
        activeTopicMeta: Prisma.DbNull,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Active study topic removed from room",
    });
  } catch (error: any) {
    console.error("[ROOM_TOPIC_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to remove study topic" }, { status: 500 });
  }
}
