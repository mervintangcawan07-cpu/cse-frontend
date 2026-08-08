// Relative Path: src/app/api/cron/db-storage-check/route.ts
import { NextResponse } from "next/server";
import { checkDbStorageAndNotify } from "@/lib/dbStorageMonitor";

export async function GET(request: Request) {
  try {
    // Basic Bearer Token Authorization check for Vercel Cron or external schedulers
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
    }

    const metrics = await checkDbStorageAndNotify();

    if (!metrics) {
      return NextResponse.json(
        { error: "Failed to calculate database storage metrics." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics,
    });
  } catch (error: any) {
    console.error("[CRON_DB_STORAGE_CHECK_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error while executing storage check." },
      { status: 500 }
    );
  }
}