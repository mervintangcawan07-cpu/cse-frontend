import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const drills = await prisma.question.findMany({
      where: {
        OR: [
          { category: "Elimination Drill" },
          { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ drills });
  } catch (error) {
    console.error("Failed to fetch elimination drills:", error);
    return NextResponse.json(
      { error: "Failed to fetch elimination drills" },
      { status: 500 }
    );
  }
}
