// Relative Path: src/lib/backup/backupRetention.ts
import { prisma } from "@/lib/prisma";
import { backupStorage } from "./backupStorage";
import { BackupType, BackupStatus, BackupVerificationStatus } from "@prisma/client";

export interface RetentionCleanupResult {
  success: boolean;
  deletedCount: number;
  freedBytes: number;
  preservedCount: number;
  errors: string[];
}

export class BackupRetentionService {
  /**
   * Enforces backup retention policies and safely purges obsolete backup records.
   * NEVER deletes protected backups, emergency backups, or the sole remaining verified backup.
   */
  public async enforceRetention(
    maxDailyRetention: number = 7,
    actorInfo: { actorId?: string; actorEmail?: string; ipAddress?: string } = {}
  ): Promise<RetentionCleanupResult> {
    const errors: string[] = [];
    let deletedCount = 0;
    let freedBytes = 0;

    // 1. Query all completed backups ordered newest to oldest
    const allBackups = await prisma.backup.findMany({
      where: {
        status: { in: [BackupStatus.COMPLETED, BackupStatus.RESTORED, BackupStatus.VERIFIED] },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Identify all verified backups to ensure at least 1 is ALWAYS preserved
    const verifiedBackups = allBackups.filter(
      (b) => b.verificationStatus === BackupVerificationStatus.PASSED
    );

    const safeToKeepVerifiedId = verifiedBackups.length > 0 ? verifiedBackups[0].id : null;

    // 3. Filter candidates eligible for cleanup
    const candidates = allBackups.slice(maxDailyRetention);

    for (const backup of candidates) {
      // Hard preservation rules
      if (backup.protected) continue;
      if (backup.backupType === BackupType.PRE_RESTORE_EMERGENCY) continue;
      if (backup.id === safeToKeepVerifiedId) continue;

      try {
        // Delete storage payload file
        await backupStorage.deleteBackup(backup.filename);
        
        // Delete database record
        await prisma.backup.delete({ where: { id: backup.id } });

        deletedCount++;
        freedBytes += Number(backup.sizeBytes || 0);

        // Audit Log
        await prisma.backupAuditLog.create({
          data: {
            backupId: backup.id,
            actorId: actorInfo.actorId,
            actorEmail: actorInfo.actorEmail || "SYSTEM_RETENTION",
            action: "CLEANUP_BACKUP",
            status: "SUCCESS",
            details: `Obsolete backup '${backup.filename}' purged by retention policy (${(Number(backup.sizeBytes) / 1024 / 1024).toFixed(2)} MB freed).`,
            ipAddress: actorInfo.ipAddress,
          },
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Failed to purge backup file";
        errors.push(`Failed to delete '${backup.filename}': ${errMsg}`);
      }
    }

    return {
      success: errors.length === 0,
      deletedCount,
      freedBytes,
      preservedCount: allBackups.length - deletedCount,
      errors,
    };
  }
}

export const backupRetentionService = new BackupRetentionService();