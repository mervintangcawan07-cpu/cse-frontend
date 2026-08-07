// Relative Path: src/app/api/drills/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

    return NextResponse.json({
      success: true,
      drills: drillQuestions,
      count: drillQuestions.length,
    });
  } catch (error: unknown) {
    console.error("[STUDENT_DRILLS_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch elimination drills" },
      { status: 500 }
    );
  }
}