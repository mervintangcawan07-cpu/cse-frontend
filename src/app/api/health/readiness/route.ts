// Relative Path: src/app/api/health/readiness/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = performance.now();
  const checks: Record<string, { status: "UP" | "DOWN"; latencyMs?: number; error?: string }> = {};
  let isReady = true;

  // 1. Check Database Connectivity
  const dbStart = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: "UP",
      latencyMs: Math.round(performance.now() - dbStart),
    };
  } catch (err: any) {
    isReady = false;
    checks.database = {
      status: "DOWN",
      error: err?.message || "Failed to query database",
    };
  }

  // 2. Check Essential Environment Secrets
  const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET"];
  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

  if (missingEnvVars.length > 0) {
    isReady = false;
    checks.environment = {
      status: "DOWN",
      error: `Missing configuration keys: ${missingEnvVars.join(", ")}`,
    };
  } else {
    checks.environment = { status: "UP" };
  }

  const durationMs = Math.round(performance.now() - startTime);

  if (!isReady) {
    logger.error("Readiness Probe Health Check Failed", undefined, { checks, durationMs });
    return NextResponse.json(
      {
        status: "DOWN",
        timestamp: new Date().toISOString(),
        durationMs,
        checks,
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      status: "UP",
      timestamp: new Date().toISOString(),
      durationMs,
      checks,
    },
    { status: 200 }
  );
}
