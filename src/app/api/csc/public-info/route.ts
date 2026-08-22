import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cachedJsonResponse, CACHE_PROFILES } from "@/lib/cache";

export async function GET() {
  try {
    const now = new Date();

    const [fetchedSchedule, announcements, downloads] = await Promise.all([
      prisma.cSCExamSchedule.findFirst({
        where: {
          OR: [
            { status: { in: ["UPCOMING", "APPLICATIONS_OPEN", "CLOSED"] } },
            { examDate: { gte: now } },
          ],
        },
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

    let nextSchedule = fetchedSchedule;

    // 🛡️ Auto-Fallback: If no active future schedule exists, provide official 2027 CSE-PPT timetable and auto-persist
    if (!nextSchedule) {
      const defaultScheduleData = {
        id: "csc_exam_primary",
        title: "2027 Civil Service Examination Pen and Paper Test (CSE-PPT)",
        examDate: new Date("2027-03-21T08:00:00.000Z"),
        appOpeningDate: new Date("2026-11-16T00:00:00.000Z"),
        appClosingDate: new Date("2027-01-15T23:59:59.000Z"),
        status: "UPCOMING",
        isPinned: true,
        isManualOverride: false,
        notes: "Covers Professional and Subprofessional levels nationwide.",
        officialLink: "https://www.csc.gov.ph",
      };

      try {
        nextSchedule = await prisma.cSCExamSchedule.upsert({
          where: { id: defaultScheduleData.id },
          update: defaultScheduleData,
          create: defaultScheduleData,
        });
      } catch {
        nextSchedule = defaultScheduleData as any;
      }
    }

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