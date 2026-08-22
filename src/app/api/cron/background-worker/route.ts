// Relative Path: src/app/api/cron/background-worker/route.ts
import { NextResponse } from "next/server";
import { cleanExpiredSessionsAndTokens, updateSystemAnalytics } from "@/lib/backgroundTasks";

export async function GET(request: Request) {
  try {
    // Basic Bearer Token Authorization check for Vercel Cron or external schedulers
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
    }

    // Execute background worker maintenance tasks
    const [cleanupResults, analyticsResults] = await Promise.all([
      cleanExpiredSessionsAndTokens(),
      updateSystemAnalytics(),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      workerSummary: {
        cleanup: cleanupResults,
        analytics: analyticsResults,
      },
    });
  } catch (error: any) {
    console.error("[CRON_BACKGROUND_WORKER_ERROR]", error);
    return NextResponse.json(
      { error: "Background worker execution failed", details: error?.message },
      { status: 500 }
    );
  }
}