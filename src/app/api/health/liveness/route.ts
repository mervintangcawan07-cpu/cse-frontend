// Relative Path: src/app/api/health/liveness/route.ts

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const memoryUsage = process.memoryUsage();

  return NextResponse.json(
    {
      status: "UP",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "development",
      metrics: {
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      },
    },
    { status: 200 }
  );
}
