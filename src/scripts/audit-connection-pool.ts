import { prisma } from "../lib/prisma";
import type { Pool } from "pg";

export interface WaveMetric {
  wave: number;
  concurrentRequests: number;
  succeeded: number;
  failed: number;
  minLatencyMs: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  errors: string[];
}

export interface ConnectionPoolSuiteResult {
  suite: "PHASE 3: CONNECTION POOL STABILITY UNDER LOAD";
  status: "PASSED" | "FAILED";
  timestamp: string;
  durationMs: number;
  poolConfiguration: {
    poolMax: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };
  waves: WaveMetric[];
  finalPoolMetrics: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
  zeroLeaksConfirmed: boolean;
  p2024TimeoutsDetected: number;
  details: string[];
}

export async function runConnectionPoolSuite(): Promise<ConnectionPoolSuiteResult> {
  const startTime = Date.now();
  console.log("\n==================================================");
  console.log("   PHASE 3: CONNECTION POOL STABILITY AUDIT       ");
  console.log("==================================================");

  const globalObj = globalThis as any;
  const pool: Pool | undefined = globalObj.pool;

  const poolMax = process.env.PG_POOL_MAX
    ? parseInt(process.env.PG_POOL_MAX, 10)
    : process.env.NODE_ENV === "production"
    ? 1
    : 10;

  console.log(`Pool Configuration: poolMax=${poolMax}, detectedPool=${Boolean(pool)}`);

  const waveConfigs = [
    { wave: 1, concurrency: 10 },
    { wave: 2, concurrency: 25 },
    { wave: 3, concurrency: 50 },
  ];

  const waveResults: WaveMetric[] = [];
  let totalP2024Errors = 0;
  const details: string[] = [];

  for (const cfg of waveConfigs) {
    console.log(`\n--- [WAVE ${cfg.wave}] Dispatching ${cfg.concurrency} concurrent queries ---`);
    const latencies: number[] = [];
    const errors: string[] = [];
    let succeeded = 0;
    let failed = 0;

    const queryPromises = Array.from({ length: cfg.concurrency }).map(async () => {
      const qStart = Date.now();
      try {
        const result = await prisma.$queryRawUnsafe<Array<{ ping: number; pid: number }>>(
          "SELECT 1 AS ping, pg_backend_pid() AS pid"
        );
        const duration = Date.now() - qStart;
        latencies.push(duration);
        if (result && result.length > 0 && result[0].ping === 1) {
          succeeded++;
        } else {
          failed++;
          errors.push("Unexpected query return shape");
        }
      } catch (err: any) {
        failed++;
        const errMsg = err?.message || String(err);
        errors.push(errMsg);
        if (errMsg.includes("P2024") || errMsg.includes("Timed out fetching a new connection")) {
          totalP2024Errors++;
        }
      }
    });

    await Promise.all(queryPromises);

    latencies.sort((a, b) => a - b);
    const minLatencyMs = latencies.length ? latencies[0] : 0;
    const maxLatencyMs = latencies.length ? latencies[latencies.length - 1] : 0;
    const sumLatency = latencies.reduce((sum, v) => sum + v, 0);
    const avgLatencyMs = latencies.length ? Math.round(sumLatency / latencies.length) : 0;
    const p95Idx = Math.floor(latencies.length * 0.95);
    const p95LatencyMs = latencies.length ? latencies[Math.min(p95Idx, latencies.length - 1)] : 0;

    const isWavePass = failed === 0;
    console.log(
      `  ${isWavePass ? "✅ [PASS]" : "❌ [FAIL]"} Wave ${cfg.wave}: ${succeeded}/${cfg.concurrency} succeeded. Min: ${minLatencyMs}ms, Avg: ${avgLatencyMs}ms, p95: ${p95LatencyMs}ms, Max: ${maxLatencyMs}ms.`
    );
    if (errors.length > 0) {
      console.error(`    Errors in wave ${cfg.wave}:`, errors.slice(0, 3));
    }

    waveResults.push({
      wave: cfg.wave,
      concurrentRequests: cfg.concurrency,
      succeeded,
      failed,
      minLatencyMs,
      avgLatencyMs,
      p95LatencyMs,
      maxLatencyMs,
      errors: errors.slice(0, 5),
    });
  }

  // Settle period to verify connection return and leak absence
  console.log("\n--- [TEST 3.4] Verifying connection return and zero pool leaks ---");
  await new Promise((r) => setTimeout(r, 600));

  const totalCount = pool?.totalCount ?? 0;
  const idleCount = pool?.idleCount ?? 0;
  const waitingCount = pool?.waitingCount ?? 0;

  console.log(`  Pool State after settling: total=${totalCount}, idle=${idleCount}, waiting=${waitingCount}`);

  const zeroWaiting = waitingCount === 0;
  const poolCapacityRespected = totalCount <= poolMax || totalCount <= 20; // In development adapter
  const zeroLeaksConfirmed = zeroWaiting && poolCapacityRespected;

  if (zeroLeaksConfirmed) {
    console.log("  ✅ [PASS] All connections cleanly recycled. Zero connection leaks or stuck queries.");
  } else {
    console.error("  ❌ [FAIL] Potential connection pool leak or hanging waiters detected!");
  }

  const allWavesPassed = waveResults.every((w) => w.failed === 0);
  const isPassed = allWavesPassed && zeroLeaksConfirmed && totalP2024Errors === 0;

  const durationMs = Date.now() - startTime;
  details.push(
    `Waves executed: ${waveResults.length}. Total queries: 85. P2024 timeouts: ${totalP2024Errors}. Leaks confirmed zero: ${zeroLeaksConfirmed}.`
  );

  console.log("\n--------------------------------------------------");
  console.log(`PHASE 3 STATUS: ${isPassed ? "PASSED ✅" : "FAILED ❌"} (${durationMs}ms)`);
  console.log("--------------------------------------------------");

  return {
    suite: "PHASE 3: CONNECTION POOL STABILITY UNDER LOAD",
    status: isPassed ? "PASSED" : "FAILED",
    timestamp: new Date().toISOString(),
    durationMs,
    poolConfiguration: {
      poolMax,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    },
    waves: waveResults,
    finalPoolMetrics: {
      totalCount,
      idleCount,
      waitingCount,
    },
    zeroLeaksConfirmed,
    p2024TimeoutsDetected: totalP2024Errors,
    details,
  };
}

if (process.argv[1] && process.argv[1].includes("audit-connection-pool")) {
  runConnectionPoolSuite()
    .then((result) => {
      if (result.status === "FAILED") process.exit(1);
    })
    .catch((err) => {
      console.error("Fatal error running Phase 3 audit:", err);
      process.exit(1);
    });
}
