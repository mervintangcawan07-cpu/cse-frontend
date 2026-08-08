// Relative Path: src/lib/systemHealthMonitor.ts
import { prisma } from "@/lib/prisma";

interface FailureEvent {
  timestamp: number;
}

// In-memory rolling event trackers
const loginFailures: FailureEvent[] = [];
const paymentFailures: FailureEvent[] = [];

// Threshold Configuration Constants
const LOGIN_FAILURE_THRESHOLD = 10; // Spike: 10+ failed logins within 15 minutes
const PAYMENT_FAILURE_THRESHOLD = 3; // Increase: 3+ failed payments within 60 minutes
const DB_LATENCY_THRESHOLD_MS = 1000; // Slow DB: Query latency > 1000ms
const HEAP_MEMORY_THRESHOLD_MB = 400; // High Memory: Node Heap > 400MB
const RSS_MEMORY_THRESHOLD_MB = 750; // High Memory: Process RSS > 750MB

/**
 * Records a failed login event to the rolling failure buffer.
 */
export function recordLoginFailure(): void {
  loginFailures.push({ timestamp: Date.now() });
}

/**
 * Records a payment transaction failure to the rolling failure buffer.
 */
export function recordPaymentFailure(): void {
  paymentFailures.push({ timestamp: Date.now() });
}

/**
 * Evaluates database latency, process memory usage, and failure rates against alert thresholds.
 */
export async function checkSystemHealthAndAlert() {
  const now = Date.now();
  const fifteenMinsAgo = now - 15 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  // Prune expired events outside window
  while (loginFailures.length > 0 && loginFailures[0].timestamp < fifteenMinsAgo) {
    loginFailures.shift();
  }
  while (paymentFailures.length > 0 && paymentFailures[0].timestamp < oneHourAgo) {
    paymentFailures.shift();
  }

  // 1. Evaluate Login & Payment Failure Spikes
  const isLoginSpike = loginFailures.length >= LOGIN_FAILURE_THRESHOLD;
  const isPaymentSpike = paymentFailures.length >= PAYMENT_FAILURE_THRESHOLD;

  // 2. Measure Database Performance Latency
  const dbStart = Date.now();
  let isDbSlow = false;
  let dbLatencyMs = 0;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
    if (dbLatencyMs > DB_LATENCY_THRESHOLD_MS) {
      isDbSlow = true;
    }
  } catch (err) {
    isDbSlow = true;
    dbLatencyMs = -1;
  }

  // 3. Monitor Process Memory & Resource Usage
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / (1024 * 1024));
  const rssMb = Math.round(mem.rss / (1024 * 1024));
  const isHighMemory = heapUsedMb > HEAP_MEMORY_THRESHOLD_MB || rssMb > RSS_MEMORY_THRESHOLD_MB;

  // 4. Consolidate Active System Alerts
  const alerts: string[] = [];
  if (isLoginSpike) {
    alerts.push(`🚨 Login Failure Spike: ${loginFailures.length} failed attempts detected in the last 15 minutes.`);
  }
  if (isPaymentSpike) {
    alerts.push(`🚨 Payment Failure Increase: ${paymentFailures.length} payment errors detected in the last hour.`);
  }
  if (isDbSlow) {
    alerts.push(`🚨 Slow Database Performance: Ping latency measured at ${dbLatencyMs}ms (Threshold: ${DB_LATENCY_THRESHOLD_MS}ms).`);
  }
  if (isHighMemory) {
    alerts.push(`🚨 High Server Memory Usage: Heap ${heapUsedMb}MB / RSS ${rssMb}MB.`);
  }

  if (alerts.length > 0) {
    console.warn("[SYSTEM_HEALTH_ALERT_TRIGGERED]", alerts);
  }

  return {
    status: alerts.length > 0 ? "WARNING" : "HEALTHY",
    alerts,
    metrics: {
      recentLoginFailures15m: loginFailures.length,
      recentPaymentFailures60m: paymentFailures.length,
      dbLatencyMs,
      heapUsedMb,
      rssMb,
    },
  };
}