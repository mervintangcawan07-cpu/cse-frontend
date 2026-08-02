import { prisma } from "@/lib/prisma";
import * as cheerio from "cheerio";

const OFFICIAL_CSC_URL = "https://www.csc.gov.ph";

export async function runCSCSynchronization(isManualTrigger = false) {
  // 1. Initialize or update status flag
  await prisma.syncStatus.upsert({
    where: { id: "csc_sync_status" },
    update: { status: "SYNCING" },
    create: {
      id: "csc_sync_status",
      nextSyncAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // Next sync in 12 hours
      status: "SYNCING",
    },
  });

  let recordsUpdated = 0;

  try {
    // 2. Fetch public announcements page with timeout protection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(`${OFFICIAL_CSC_URL}/news-and-updates`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CSE-ReviewerBot/1.0" },
      signal: controller.signal,
      cache: "no-store",
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (response && response.ok) {
      const htmlText = await response.text();
      const $ = cheerio.load(htmlText);

      const parsedAnnouncements: { title: string; link: string; category: string }[] = [];

      $(".news-item, .announcement-item, article").each((_, el) => {
        const title = $(el).find("h2, h3, a").first().text().trim();
        const link = $(el).find("a").first().attr("href") || "";
        if (title && title.length > 5) {
          parsedAnnouncements.push({
            title,
            link: link.startsWith("http") ? link : `${OFFICIAL_CSC_URL}${link}`,
            category: title.toUpperCase().includes("ROOM")
              ? "ROOM_ASSIGNMENT"
              : title.toUpperCase().includes("RESULT")
              ? "RESULTS"
              : "EXAM_NOTICE",
          });
        }
      });

      // 3. Differential check: Insert non-duplicates only
      for (const item of parsedAnnouncements) {
        const existing = await prisma.cSCAnnouncement.findFirst({
          where: { title: item.title },
        });

        if (!existing) {
          await prisma.cSCAnnouncement.create({
            data: {
              title: item.title,
              content: `Official notice published on CSC Portal. Link: ${item.link}`,
              category: item.category,
              sourceUrl: item.link,
            },
          });
          recordsUpdated++;
        }
      }
    }

    // 4. Update status of existing schedules automatically based on real-time date
    const now = new Date();
    const activeSchedules = await prisma.cSCExamSchedule.findMany({
      where: { isManualOverride: false },
    });

    for (const sched of activeSchedules) {
      let newStatus = "UPCOMING";
      if (sched.appOpeningDate && sched.appClosingDate) {
        if (now >= sched.appOpeningDate && now <= sched.appClosingDate) {
          newStatus = "APPLICATIONS_OPEN";
        } else if (now > sched.appClosingDate && now < sched.examDate) {
          newStatus = "CLOSED";
        } else if (now >= sched.examDate) {
          newStatus = "COMPLETED";
        }
      }

      if (sched.status !== newStatus) {
        await prisma.cSCExamSchedule.update({
          where: { id: sched.id },
          data: { status: newStatus },
        });
        recordsUpdated++;
      }
    }

    // 5. Save successful execution log
    await prisma.syncStatus.update({
      where: { id: "csc_sync_status" },
      data: {
        lastSyncAt: new Date(),
        nextSyncAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        status: "SUCCESS",
        recordsUpdated,
        lastError: null,
      },
    });

    await prisma.syncLog.create({
      data: {
        sourceUrl: OFFICIAL_CSC_URL,
        action: isManualTrigger ? "MANUAL_SYNC" : "BACKGROUND_CRON_SYNC",
        details: `Successfully synchronized ${recordsUpdated} new item(s).`,
        isError: false,
      },
    });

    return { success: true, recordsUpdated };
  } catch (error: any) {
    console.error("[CSC_SYNC_ENGINE_ERROR]", error);

    // Fallback: Maintain current database state without clearing local data
    await prisma.syncStatus.update({
      where: { id: "csc_sync_status" },
      data: {
        status: "FAILED",
        lastError: error?.message || "CSC server timeout. Serving cached database data.",
      },
    });

    await prisma.syncLog.create({
      data: {
        sourceUrl: OFFICIAL_CSC_URL,
        action: "SYNC_ERROR",
        details: error?.message || "Failed to query CSC source.",
        isError: true,
      },
    });

    return { success: false, error: error?.message };
  }
}