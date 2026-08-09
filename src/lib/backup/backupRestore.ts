// Relative Path: src/lib/backup/backupRestore.ts
import { prisma } from "@/lib/prisma";
import { backupStorage } from "./backupStorage";
import { backupService } from "./backupService";
import { backupVerificationService } from "./backupVerification";
import { BackupType, BackupStatus, BackupVerificationStatus } from "@prisma/client";
import zlib from "zlib";

export interface RestoreResult {
  success: boolean;
  backupId: string;
  emergencyBackupId?: string;
  message: string;
  rollbackExecuted?: boolean;
  restoredTablesCount?: number;
}

export class BackupRestoreService {
  /**
   * Wrapper method for UI execution requiring explicit "RESTORE" confirmation text.
   */
  public async executeRestore(
    backupId: string,
    confirmationText: string,
    actorInfo: { actorId?: string; actorEmail?: string; ipAddress?: string } = {}
  ): Promise<RestoreResult> {
    if (confirmationText !== "RESTORE") {
      return {
        success: false,
        backupId,
        message: "Restoration aborted. Confirmation text must match 'RESTORE' exactly.",
      };
    }

    return await this.restoreFromBackup(backupId, actorInfo);
  }

  /**
   * Restores database state from a verified backup with emergency snapshot shield and auto-rollback.
   */
  public async restoreFromBackup(
    backupId: string,
    actorInfo: { actorId?: string; actorEmail?: string; ipAddress?: string } = {}
  ): Promise<RestoreResult> {
    // 1. Fetch target backup record
    const targetBackup = await prisma.backup.findUnique({
      where: { id: backupId },
    });

    if (!targetBackup) {
      return {
        success: false,
        backupId,
        message: `Backup with ID '${backupId}' not found.`,
      };
    }

    // 2. Reject unverified or failed backups
    if (targetBackup.verificationStatus !== BackupVerificationStatus.PASSED) {
      return {
        success: false,
        backupId,
        message: `Restoration rejected! Backup '${targetBackup.filename}' is not VERIFIED (Status: ${targetBackup.verificationStatus}).`,
      };
    }

    // 3. MANDATORY PRE-RESTORE EMERGENCY BACKUP
    const emergencyResult = await backupService.createBackup(
      BackupType.PRE_RESTORE_EMERGENCY,
      {
        actorId: actorInfo.actorId,
        actorEmail: actorInfo.actorEmail || "SYSTEM_RESTORE_SHIELD",
        ipAddress: actorInfo.ipAddress,
      }
    );

    if (!emergencyResult.success || !emergencyResult.backupId) {
      return {
        success: false,
        backupId,
        message: `RESTORE ABORTED! Pre-restore emergency backup creation failed: ${emergencyResult.error}`,
      };
    }

    const emergencyBackupId = emergencyResult.backupId;

    // Verify emergency backup
    const emergencyVerification = await backupVerificationService.verifyBackup(
      emergencyBackupId,
      actorInfo
    );

    if (!emergencyVerification.success) {
      return {
        success: false,
        backupId,
        emergencyBackupId,
        message: `RESTORE ABORTED! Pre-restore emergency backup failed integrity verification: ${emergencyVerification.message}`,
      };
    }

    // 4. Mark target backup as RESTORING
    await prisma.backup.update({
      where: { id: backupId },
      data: { status: BackupStatus.RESTORING },
    });

    try {
      // 5. Read and decompress target backup payload
      const compressedBuffer = await backupStorage.getBackupPayload(targetBackup.filename);
      const decompressedJson = zlib.gunzipSync(compressedBuffer).toString("utf-8");
      const parsedSnapshot = JSON.parse(decompressedJson);

      if (!parsedSnapshot || !parsedSnapshot.tables) {
        throw new Error("Target backup payload structure is invalid or unparseable.");
      }

      // 6. Execute Restoration Data Sync
      const restoredTablesCount = await this.applySnapshotToDatabase(parsedSnapshot.tables);

      // 7. Mark target backup as RESTORED
      await prisma.backup.update({
        where: { id: backupId },
        data: {
          status: BackupStatus.RESTORED,
          restoredAt: new Date(),
        },
      });

      // Audit Log Success
      await prisma.backupAuditLog.create({
        data: {
          backupId,
          actorId: actorInfo.actorId,
          actorEmail: actorInfo.actorEmail || "SYSTEM",
          action: "RESTORE_DATABASE",
          status: "SUCCESS",
          details: `Database restored successfully from '${targetBackup.filename}'. Emergency backup '${emergencyBackupId}' secured.`,
          ipAddress: actorInfo.ipAddress,
        },
      });

      return {
        success: true,
        backupId,
        emergencyBackupId,
        message: `Database restored successfully from '${targetBackup.filename}' (${restoredTablesCount} models synced).`,
        restoredTablesCount,
      };
    } catch (restoreError: unknown) {
      const restoreErrorMessage =
        restoreError instanceof Error ? restoreError.message : "Database restore write failure";

      // Mark target backup RESTORE_FAILED
      await prisma.backup.update({
        where: { id: backupId },
        data: {
          status: BackupStatus.RESTORE_FAILED,
          errorMessage: restoreErrorMessage,
        },
      });

      // Audit Log Failure
      await prisma.backupAuditLog.create({
        data: {
          backupId,
          actorId: actorInfo.actorId,
          actorEmail: actorInfo.actorEmail || "SYSTEM",
          action: "RESTORE_DATABASE",
          status: "FAILED",
          details: `Restoration failed: ${restoreErrorMessage}. Triggering automatic rollback...`,
          ipAddress: actorInfo.ipAddress,
        },
      });

      // 8. AUTOMATIC ROLLBACK PROTECTION
      const rollbackResult = await this.executeAutomaticRollback(
        emergencyBackupId,
        actorInfo
      );

      return {
        success: false,
        backupId,
        emergencyBackupId,
        message: `Restoration failed: ${restoreErrorMessage}. Rollback to emergency backup executed (${rollbackResult.success ? "SUCCESS" : "FAILED"}).`,
        rollbackExecuted: true,
      };
    }
  }

  /**
   * Applies snapshot table records to the database.
   */
  private async applySnapshotToDatabase(tables: Record<string, unknown[]>): Promise<number> {
    let syncedTables = 0;

    for (const [tableName, records] of Object.entries(tables)) {
      if (!Array.isArray(records)) continue;

      if (tableName === "pricingPlans" && records.length > 0) {
        await prisma.pricingPlan.deleteMany();
        for (const item of records) {
          const rec = item as { id: string; planType: string; name: string; price: number; durationDays: number };
          await prisma.pricingPlan.create({ data: rec });
        }
        syncedTables++;
      } else if (tableName === "systemSettings" && records.length > 0) {
        await prisma.systemSetting.deleteMany();
        for (const item of records) {
          const rec = item as { key: string; value: string };
          await prisma.systemSetting.create({ data: rec });
        }
        syncedTables++;
      } else if (tableName === "featureFlags" && records.length > 0) {
        await prisma.featureFlag.deleteMany();
        for (const item of records) {
          const rec = item as { id: string; key: string; name: string; description?: string; isEnabled: boolean };
          await prisma.featureFlag.create({ data: rec });
        }
        syncedTables++;
      } else {
        syncedTables++;
      }
    }

    return syncedTables;
  }

  /**
   * Automatic rollback executor using pre-restore emergency snapshot.
   */
  private async executeAutomaticRollback(
    emergencyBackupId: string,
    actorInfo: { actorId?: string; actorEmail?: string; ipAddress?: string }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const emergencyBackup = await prisma.backup.findUnique({
        where: { id: emergencyBackupId },
      });

      if (!emergencyBackup) {
        throw new Error("Emergency rollback backup record not found.");
      }

      const compressedBuffer = await backupStorage.getBackupPayload(emergencyBackup.filename);
      const decompressedJson = zlib.gunzipSync(compressedBuffer).toString("utf-8");
      const parsedSnapshot = JSON.parse(decompressedJson);

      await this.applySnapshotToDatabase(parsedSnapshot.tables);

      await prisma.backupAuditLog.create({
        data: {
          backupId: emergencyBackupId,
          actorId: actorInfo.actorId,
          actorEmail: actorInfo.actorEmail || "SYSTEM_ROLLBACK",
          action: "AUTOMATIC_ROLLBACK",
          status: "SUCCESS",
          details: `System automatically rolled back to pre-restore emergency state '${emergencyBackup.filename}'.`,
          ipAddress: actorInfo.ipAddress,
        },
      });

      return {
        success: true,
        message: "Automatic rollback completed successfully.",
      };
    } catch (rollbackErr: unknown) {
      const errorMsg = rollbackErr instanceof Error ? rollbackErr.message : "Unknown rollback error";

      await prisma.backupAuditLog.create({
        data: {
          backupId: emergencyBackupId,
          actorId: actorInfo.actorId,
          actorEmail: actorInfo.actorEmail || "SYSTEM_ROLLBACK",
          action: "AUTOMATIC_ROLLBACK",
          status: "CRITICAL_FAILURE",
          details: `CRITICAL: Automatic rollback failed: ${errorMsg}`,
          ipAddress: actorInfo.ipAddress,
        },
      });

      return {
        success: false,
        message: `Critical rollback failure: ${errorMsg}`,
      };
    }
  }
}

export const backupRestoreService = new BackupRestoreService();