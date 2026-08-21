import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 1. Seed Official Upcoming Civil Service Exam Schedule (CSE-PPT)
    const examSchedule = await prisma.cSCExamSchedule.upsert({
      where: { id: "csc_exam_primary" },
      update: {
        title: "2027 Civil Service Examination Pen and Paper Test (CSE-PPT)",
        examDate: new Date("2027-03-21T08:00:00.000Z"), // Upcoming Sunday CSE-PPT
        appOpeningDate: new Date("2026-11-16T00:00:00.000Z"),
        appClosingDate: new Date("2027-01-15T23:59:59.000Z"),
        status: "UPCOMING",
        isPinned: true,
        isManualOverride: false,
        notes: "Covers Professional and Subprofessional levels nationwide.",
        officialLink: "https://www.csc.gov.ph",
      },
      create: {
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
      },
    });

    // 2. Seed Initial Announcements
    const announcement1 = await prisma.cSCAnnouncement.upsert({
      where: { id: "csc_announcement_2026_1" },
      update: {},
      create: {
        id: "csc_announcement_2026_1",
        title: "Examination Announcement No. 01, s. 2026 - Conduct of CSE-PPT",
        content:
          "Official guidelines and testing center instructions for the upcoming Pen and Paper Test (CSE-PPT).",
        category: "EXAM_NOTICE",
        sourceUrl: "https://www.csc.gov.ph",
        isPinned: true,
      },
    });

    const announcement2 = await prisma.cSCAnnouncement.upsert({
      where: { id: "csc_announcement_2026_2" },
      update: {},
      create: {
        id: "csc_announcement_2026_2",
        title: "Online ERPO Room Assignment Verification Portal Active",
        content:
          "Examinees may verify school and room assignments via the Online Examination School Assignment System (ONSA / ERPO).",
        category: "ROOM_ASSIGNMENT",
        sourceUrl: "https://erpo.csc.gov.ph",
        isPinned: false,
      },
    });

    // 3. Seed Initial Downloadable Forms
    await prisma.cSCDownload.upsert({
      where: { id: "csc_download_csform100" },
      update: {},
      create: {
        id: "csc_download_csform100",
        title: "CS Form No. 100 (Revised September 2016) - Examination Application Form",
        category: "APPLICATION_FORM",
        fileUrl: "https://www.csc.gov.ph/downloads/category/212-cs-form-100-revised-september-2016",
        fileSize: "PDF (Fillable)",
      },
    });

    // 4. Initialize Sync Status
    await prisma.syncStatus.upsert({
      where: { id: "csc_sync_status" },
      update: {
        lastSyncAt: new Date(),
        status: "SUCCESS",
        recordsUpdated: 3,
      },
      create: {
        id: "csc_sync_status",
        lastSyncAt: new Date(),
        nextSyncAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: "SUCCESS",
        recordsUpdated: 3,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Successfully seeded initial 2026 CSC Examination schedule, announcements, and forms!",
      schedule: examSchedule,
      announcements: [announcement1, announcement2],
    });
  } catch (error: any) {
    console.error("[CSC_SEED_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to seed CSC data", details: error?.message },
      { status: 500 }
    );
  }
}