// Relative Path: src/lib/backup/backupHealth.ts
import { prisma } from "@/lib/prisma";
import { BackupStatus, BackupVerificationStatus } from "@prisma/client";

export type BackupHealthStatus = "HEALTHY" | "WARNING" | "CRITICAL";

export interface BackupHealthReport {
  status: BackupHealthStatus;
  lastBackupAt: Date | null;
  lastVerifiedAt: Date | null;
  totalBackups: number;
  verifiedCount: number;
  failedCount: number;
  totalStorageBytes: number;
  alerts: string[];
}

export class BackupHealthMonitor {
  /**
   * Generates real-time disaster recovery health report.
   */
  public async getHealthReport(): Promise<BackupHealthReport> {
    const alerts: string[] = [];

    const [allBackups, lastSuccessfulBackup, lastVerifiedBackup] = await Promise.all([
      prisma.backup.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.backup.findFirst({
        where: {
          status: { in: [BackupStatus.COMPLETED, BackupStatus.RESTORED, BackupStatus.VERIFIED] },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.backup.findFirst({
        where: { verificationStatus: BackupVerificationStatus.PASSED },
        orderBy: { verifiedAt: "desc" },
      }),
    ]);

    const totalBackups = allBackups.length;
    let verifiedCount = 0;
    let failedCount = 0;
    let totalStorageBytes = 0;

    for (const b of allBackups) {
      if (b.verificationStatus === BackupVerificationStatus.PASSED) verifiedCount++;
      if (b.status === BackupStatus.FAILED || b.verificationStatus === BackupVerificationStatus.FAILED) {
        failedCount++;
      }
      totalStorageBytes += Number(b.sizeBytes || 0);
    }

    // Health Evaluation Rules
    let status: BackupHealthStatus = "HEALTHY";

    if (!lastSuccessfulBackup) {
      status = "CRITICAL";
      alerts.push("CRITICAL: No completed database backup exists in system history!");
    } else {
      const hoursSinceLastBackup =
        (Date.now() - new Date(lastSuccessfulBackup.createdAt).getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastBackup > 30) {
        status = "CRITICAL";
        alerts.push(`CRITICAL: Last successful backup occurred ${Math.floor(hoursSinceLastBackup)} hours ago (> 30 hour threshold)!`);
      } else if (hoursSinceLastBackup > 24) {
        status = "WARNING";
        alerts.push(`WARNING: Last successful backup is ${Math.floor(hoursSinceLastBackup)} hours old.`);
      }
    }

    if (!lastVerifiedBackup) {
      if (status !== "CRITICAL") status = "WARNING";
      alerts.push("WARNING: No backup has successfully passed integrity verification!");
    }

    if (failedCount >= 3) {
      status = "CRITICAL";
      alerts.push(`CRITICAL: High failure rate detected (${failedCount} failed backup/verification attempts)!`);
    }

    return {
      status,
      lastBackupAt: lastSuccessfulBackup?.createdAt || null,
      lastVerifiedAt: lastVerifiedBackup?.verifiedAt || null,
      totalBackups,
      verifiedCount,
      failedCount,
      totalStorageBytes,
      alerts,
    };
  }
}

export const backupHealthMonitor = new BackupHealthMonitor();