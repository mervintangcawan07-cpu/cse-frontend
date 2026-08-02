import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json({
      success: true,
      nextSchedule,
      announcements,
      downloads,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch CSC public info" }, { status: 500 });
  }
}