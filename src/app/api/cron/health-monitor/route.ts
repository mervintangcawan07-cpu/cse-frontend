// Relative Path: src/app/api/cron/health-monitor/route.ts
import { NextResponse } from "next/server";
import { checkSystemHealthAndAlert } from "@/lib/systemHealthMonitor";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
    }

    const healthReport = await checkSystemHealthAndAlert();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      report: healthReport,
    });
  } catch (error: any) {
    console.error("[CRON_HEALTH_MONITOR_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error during health check", details: error?.message },
      { status: 500 }
    );
  }
}