// Relative Path: src/lib/systemHealthMonitor.ts
import { prisma } from "@/lib/prisma";

interface FailureEvent {
  timestamp: number;
}

const loginFailures: FailureEvent[] = [];
const paymentFailures: FailureEvent[] = [];

const LOGIN_FAILURE_THRESHOLD = 10;
const PAYMENT_FAILURE_THRESHOLD = 3;
const DB_LATENCY_THRESHOLD_MS = 1000;
const HEAP_MEMORY_THRESHOLD_MB = 400;
const RSS_MEMORY_THRESHOLD_MB = 750;

export function recordLoginFailure(): void {
  loginFailures.push({ timestamp: Date.now() });
}

export function recordPaymentFailure(): void {
  paymentFailures.push({ timestamp: Date.now() });
}

export async function checkSystemHealthAndAlert() {
  const now = Date.now();
  const fifteenMinsAgo = now - 15 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  while (loginFailures.length > 0 && loginFailures[0].timestamp < fifteenMinsAgo) {
    loginFailures.shift();
  }
  while (paymentFailures.length > 0 && paymentFailures[0].timestamp < oneHourAgo) {
    paymentFailures.shift();
  }

  const isLoginSpike = loginFailures.length >= LOGIN_FAILURE_THRESHOLD;
  const isPaymentSpike = paymentFailures.length >= PAYMENT_FAILURE_THRESHOLD;

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

  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / (1024 * 1024));
  const rssMb = Math.round(mem.rss / (1024 * 1024));
  const isHighMemory = heapUsedMb > HEAP_MEMORY_THRESHOLD_MB || rssMb > RSS_MEMORY_THRESHOLD_MB;

  const alerts: string[] = [];
  if (isLoginSpike) {
    alerts.push(`🚨 Login Failure Spike: ${loginFailures.length} failed attempts in 15 mins.`);
  }
  if (isPaymentSpike) {
    alerts.push(`🚨 Payment Failure Increase: ${paymentFailures.length} payment errors in 1 hour.`);
  }
  if (isDbSlow) {
    alerts.push(`🚨 Slow Database Performance: Ping latency ${dbLatencyMs}ms.`);
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