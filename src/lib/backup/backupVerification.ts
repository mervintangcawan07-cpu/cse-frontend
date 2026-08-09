// Relative Path: src/lib/backup/backupVerification.ts
import { prisma } from "@/lib/prisma";
import { backupStorage } from "./backupStorage";
import zlib from "zlib";
import { BackupVerificationStatus } from "@prisma/client";

export interface VerificationResult {
  success: boolean;
  backupId: string;
  status: BackupVerificationStatus;
  message: string;
  tableCounts?: Record<string, number>;
  totalRecords?: number;
  checksumMatched?: boolean;
}

export class BackupVerificationService {
  /**
   * Performs complete multi-tier verification on an existing backup record.
   */
  public async verifyBackup(
    backupId: string,
    actorInfo: { actorId?: string; actorEmail?: string; ipAddress?: string } = {}
  ): Promise<VerificationResult> {
    // 1. Fetch Backup tracking record
    const backup = await prisma.backup.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      return {
        success: false,
        backupId,
        status: BackupVerificationStatus.FAILED,
        message: `Backup with ID '${backupId}' not found in database.`,
      };
    }

    try {
      // 2. Read compressed payload from storage vault
      const compressedBuffer = await backupStorage.getBackupPayload(backup.filename);

      // 3. Recalculate & Compare SHA-256 Checksum
      const recalculatedChecksum = backupStorage.calculateChecksum(compressedBuffer);
      const checksumMatched = backup.checksum === recalculatedChecksum;

      if (!checksumMatched) {
        const errorMsg = `Checksum mismatch! Recorded: ${backup.checksum?.substring(0, 12)}..., Calculated: ${recalculatedChecksum.substring(0, 12)}...`;
        
        await this.recordVerificationResult(
          backupId,
          BackupVerificationStatus.FAILED,
          errorMsg,
          actorInfo
        );

        return {
          success: false,
          backupId,
          status: BackupVerificationStatus.FAILED,
          message: errorMsg,
          checksumMatched: false,
        };
      }

      // 4. Decompress Gzip Payload
      const decompressedJson = zlib.gunzipSync(compressedBuffer).toString("utf-8");

      // 5. Parse & Validate JSON Data Structure
      const parsedData = JSON.parse(decompressedJson);

      if (!parsedData || !parsedData.tables || typeof parsedData.tables !== "object") {
        const errorMsg = "Invalid backup payload format: 'tables' property missing or malformed.";
        await this.recordVerificationResult(
          backupId,
          BackupVerificationStatus.FAILED,
          errorMsg,
          actorInfo
        );

        return {
          success: false,
          backupId,
          status: BackupVerificationStatus.FAILED,
          message: errorMsg,
          checksumMatched: true,
        };
      }

      // 6. Verify Critical Table Models Exist
      const criticalTables = [
        "users",
        "questions",
        "examResults",
        "transactions",
        "pricingPlans",
        "flashcards",
      ];

      const missingTables: string[] = [];
      const tableCounts: Record<string, number> = {};
      let totalRecords = 0;

      for (const tableKey of Object.keys(parsedData.tables)) {
        const records = parsedData.tables[tableKey];
        if (Array.isArray(records)) {
          tableCounts[tableKey] = records.length;
          totalRecords += records.length;
        }
      }

      for (const criticalTable of criticalTables) {
        if (!(criticalTable in parsedData.tables)) {
          missingTables.push(criticalTable);
        }
      }

      if (missingTables.length > 0) {
        const errorMsg = `Database structure incomplete! Missing critical tables: ${missingTables.join(", ")}`;
        await this.recordVerificationResult(
          backupId,
          BackupVerificationStatus.FAILED,
          errorMsg,
          actorInfo
        );

        return {
          success: false,
          backupId,
          status: BackupVerificationStatus.FAILED,
          message: errorMsg,
          tableCounts,
          totalRecords,
          checksumMatched: true,
        };
      }

      // 7. Success Verification Report
      const successMsg = `Verification PASSED: SHA-256 matched, ${Object.keys(tableCounts).length} models verified, ${totalRecords} total records validated.`;

      await this.recordVerificationResult(
        backupId,
        BackupVerificationStatus.PASSED,
        successMsg,
        actorInfo
      );

      return {
        success: true,
        backupId,
        status: BackupVerificationStatus.PASSED,
        message: successMsg,
        tableCounts,
        totalRecords,
        checksumMatched: true,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Corrupted or unreadable backup file.";
      
      await this.recordVerificationResult(
        backupId,
        BackupVerificationStatus.FAILED,
        `Verification exception: ${errorMsg}`,
        actorInfo
      );

      return {
        success: false,
        backupId,
        status: BackupVerificationStatus.FAILED,
        message: `Verification exception: ${errorMsg}`,
      };
    }
  }

  /**
   * Updates Backup verification columns and appends a BackupAuditLog entry.
   */
  private async recordVerificationResult(
    backupId: string,
    status: BackupVerificationStatus,
    message: string,
    actorInfo: { actorId?: string; actorEmail?: string; ipAddress?: string } = {}
  ): Promise<void> {
    await prisma.backup.update({
      where: { id: backupId },
      data: {
        verificationStatus: status,
        verificationMessage: message,
        verifiedAt: new Date(),
      },
    });

    await prisma.backupAuditLog.create({
      data: {
        backupId,
        actorId: actorInfo.actorId,
        actorEmail: actorInfo.actorEmail || "SYSTEM",
        action: "VERIFY_BACKUP",
        status: status === BackupVerificationStatus.PASSED ? "SUCCESS" : "FAILED",
        details: message,
        ipAddress: actorInfo.ipAddress,
      },
    });
  }
}

export const backupVerificationService = new BackupVerificationService();