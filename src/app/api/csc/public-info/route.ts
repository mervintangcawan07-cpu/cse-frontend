import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cachedJsonResponse, CACHE_PROFILES } from "@/lib/cache";

export async function GET() {
  try {
    const [nextSchedule, announcements, downloads] = await Promise.all([
      prisma.cSCExamSchedule.findFirst({
        where: { status: { in: ["UPCOMING", "APPLICATIONS_OPEN", "CLOSED"] } },
        orderBy: { examDate: "asc" },
      }),
      prisma.cSCAnnouncement.findMany({
        take: 5,
        orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      }),
      prisma.cSCDownload.findMany({
        take: 5,
      }),
    ]);

    return cachedJsonResponse(
      {
        success: true,
        nextSchedule,
        announcements,
        downloads,
      },
      "STATIC_METADATA"
    );
  } catch (error: any) {
    console.error("[CSC_PUBLIC_INFO_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch CSC public info" },
      { status: 500, headers: CACHE_PROFILES.PRIVATE }
    );
  }
}