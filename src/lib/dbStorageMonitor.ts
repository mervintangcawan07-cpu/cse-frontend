// Relative Path: src/lib/dbStorageMonitor.ts
import { prisma } from "@/lib/prisma";

interface StorageMetrics {
  sizeMb: number;
  maxStorageMb: number;
  usagePercent: number;
  isNearCapacity: boolean;
  alertSent: boolean;
}

let lastAlertSentAt: number | null = null;
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24-hour email alert cooldown

/**
 * Queries PostgreSQL database storage usage, checks against capacity threshold (default 80%),
 * and triggers admin notifications when capacity is almost full.
 */
export async function checkDbStorageAndNotify(): Promise<StorageMetrics | null> {
  try {
    // 1. Query PostgreSQL database size using raw SQL
    const result = await prisma.$queryRaw<Array<{ size_bytes: bigint | number }>>`
      SELECT pg_database_size(current_database()) AS size_bytes
    `;

    if (!result || result.length === 0) return null;

    const sizeBytes = Number(result[0].size_bytes);
    const sizeMb = sizeBytes / (1024 * 1024);

    // Configurable via env variables (Default: 500MB free tier cap, 80% warning threshold)
    const maxStorageMb = Number(process.env.MAX_DB_STORAGE_MB) || 500;
    const warningThresholdPercent = Number(process.env.DB_STORAGE_ALERT_THRESHOLD) || 80;

    const usagePercent = Math.round((sizeMb / maxStorageMb) * 100);
    const isNearCapacity = usagePercent >= warningThresholdPercent;
    let alertSent = false;

    // 2. Trigger notification if usage exceeds warning threshold and cooldown has elapsed
    if (isNearCapacity) {
      const now = Date.now();
      if (!lastAlertSentAt || now - lastAlertSentAt > ALERT_COOLDOWN_MS) {
        console.warn(
          `[DATABASE STORAGE WARNING] Database usage has reached ${usagePercent}% (${sizeMb.toFixed(
            2
          )} MB / ${maxStorageMb} MB).`
        );

        // Record alert timestamp
        lastAlertSentAt = now;
        alertSent = true;

        // If email service credentials exist, send email to system admin
        const adminEmail = process.env.ADMIN_ALERT_EMAIL;
        if (adminEmail) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/admin/notify-storage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: adminEmail,
                usagePercent,
                sizeMb: sizeMb.toFixed(2),
                maxStorageMb,
              }),
            }).catch(() => null);
          } catch (emailErr) {
            console.error("Failed to send storage alert email:", emailErr);
          }
        }
      }
    }

    return {
      sizeMb: Math.round(sizeMb * 100) / 100,
      maxStorageMb,
      usagePercent,
      isNearCapacity,
      alertSent,
    };
  } catch (error) {
    console.error("[DB_STORAGE_MONITOR_ERROR]", error);
    return null;
  }
}