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
  // Always required basic runtime configuration
  const basicEnvVars = ["DATABASE_URL", "JWT_SECRET"];
  const missingEnvVars = basicEnvVars.filter((key) => !process.env[key]?.trim());

  // Explicit runtime classification: Vercel Preview/Development vs Actual Production
  const vercelEnv = process.env.VERCEL_ENV;
  const isActualProduction = vercelEnv
    ? vercelEnv === "production"
    : process.env.NODE_ENV === "production";

  if (isActualProduction) {
    const productionOnlyEnvVars = [
      "PAYMONGO_SECRET_KEY",
      "PAYMONGO_WEBHOOK_SECRET",
      "CRON_SECRET",
    ];
    for (const key of productionOnlyEnvVars) {
      if (!process.env[key]?.trim()) {
        missingEnvVars.push(key);
      }
    }

    // Encryption requirement: ENCRYPTION_KEY_V1 OR ENCRYPTION_KEY (at least one must be present)
    const hasEncryptionKey = Boolean(
      process.env.ENCRYPTION_KEY_V1?.trim() || process.env.ENCRYPTION_KEY?.trim()
    );

    if (!hasEncryptionKey) {
      missingEnvVars.push("ENCRYPTION_KEY_V1 or ENCRYPTION_KEY");
    }
  }

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
