// Relative Path: src/app/api/drills/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cachedJsonResponse, CACHE_PROFILES } from "@/lib/cache";

export async function GET() {
  try {
    const drillQuestions = await prisma.question.findMany({
      where: {
        deletedAt: null,
        OR: [
          { category: "Elimination Drill" },
          { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return cachedJsonResponse(
      {
        success: true,
        drills: drillQuestions,
        count: drillQuestions.length,
      },
      "STATIC_METADATA"
    );
  } catch (error: unknown) {
    console.error("[STUDENT_DRILLS_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch elimination drills" },
      { status: 500, headers: CACHE_PROFILES.PRIVATE }
    );
  }
}