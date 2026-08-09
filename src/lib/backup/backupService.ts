// Relative Path: src/lib/backup/backupService.ts
import { prisma } from "@/lib/prisma";
import { backupStorage } from "./backupStorage";
import zlib from "zlib";
import { BackupType, BackupStatus } from "@prisma/client";

export interface BackupExecutionResult {
  success: boolean;
  backupId?: string;
  filename?: string;
  sizeBytes?: number;
  checksum?: string;
  error?: string;
}

export class BackupService {
  /**
   * BigInt JSON serializer helper
   */
  private serializeData(data: unknown): string {
    return JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    );
  }

  /**
   * Extracts and serializes a complete snapshot of all active database models.
   */
  public async dumpDatabaseSnapshot(): Promise<Record<string, unknown>> {
    const [
      users,
      classmates,
      conversations,
      directMessages,
      studyRooms,
      studyEvents,
      studyClubs,
      examResults,
      questions,
      readingMaterials,
      studyNotes,
      handbooks,
      pricingPlans,
      userStreaks,
      bookmarks,
      examDrafts,
      notifications,
      activityLogs,
      transactions,
      flashcards,
      duelMatches,
      systemSettings,
      loginHistories,
      featureFlags,
      supportTickets,
      cscSchedules,
      cscAnnouncements,
      cscDownloads,
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.classmateRelation.findMany(),
      prisma.conversation.findMany(),
      prisma.directMessage.findMany(),
      prisma.studyRoom.findMany(),
      prisma.studyEvent.findMany(),
      prisma.studyClub.findMany(),
      prisma.examResult.findMany(),
      prisma.question.findMany(),
      prisma.readingMaterial.findMany(),
      prisma.studyNote.findMany(),
      prisma.handbook.findMany(),
      prisma.pricingPlan.findMany(),
      prisma.userStreak.findMany(),
      prisma.bookmark.findMany(),
      prisma.examDraft.findMany(),
      prisma.notification.findMany(),
      prisma.activityLog.findMany(),
      prisma.transaction.findMany(),
      prisma.flashcard.findMany(),
      prisma.duelMatch.findMany(),
      prisma.systemSetting.findMany(),
      prisma.loginHistory.findMany(),
      prisma.featureFlag.findMany(),
      prisma.supportTicket.findMany(),
      prisma.cSCExamSchedule.findMany(),
      prisma.cSCAnnouncement.findMany(),
      prisma.cSCDownload.findMany(),
    ]);

    return {
      version: "1.0.0",
      engine: "PostgreSQL / Prisma ORM",
      createdAt: new Date().toISOString(),
      tables: {
        users,
        classmates,
        conversations,
        directMessages,
        studyRooms,
        studyEvents,
        studyClubs,
        examResults,
        questions,
        readingMaterials,
        studyNotes,
        handbooks,
        pricingPlans,
        userStreaks,
        bookmarks,
        examDrafts,
        notifications,
        activityLogs,
        transactions,
        flashcards,
        duelMatches,
        systemSettings,
        loginHistories,
        featureFlags,
        supportTickets,
        cscSchedules,
        cscAnnouncements,
        cscDownloads,
      },
    };
  }

  /**
   * Executes a full transactional database backup, compresses payload, computes SHA-256,
   * uploads to disaster recovery vault, and records metadata entries.
   */
  public async createBackup(
    backupType: BackupType = BackupType.MANUAL,
    actorInfo: { actorId?: string; actorEmail?: string; ipAddress?: string } = {}
  ): Promise<BackupExecutionResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `csc_backup_${backupType.toLowerCase()}_${timestamp}.json.gz`;

    // 1. Create tracking record in RUNNING state
    const backupRecord = await prisma.backup.create({
      data: {
        backupType,
        status: BackupStatus.RUNNING,
        filename,
        storageKey: `backups/${filename}`,
        storageProvider: process.env.BACKUP_STORAGE_PROVIDER || "local_vault",
        triggeredBy: actorInfo.actorEmail || "SYSTEM",
      },
    });

    try {
      // 2. Dump raw database tables
      const snapshot = await this.dumpDatabaseSnapshot();
      const rawJson = this.serializeData(snapshot);

      // 3. Compress using Gzip
      const compressedBuffer = zlib.gzipSync(Buffer.from(rawJson, "utf-8"));

      // 4. Upload to Disaster Recovery Vault & calculate SHA-256
      const storageMeta = await backupStorage.saveBackup(filename, compressedBuffer);

      // 5. Update Backup metadata in DB
      await prisma.backup.update({
        where: { id: backupRecord.id },
        data: {
          status: BackupStatus.COMPLETED,
          sizeBytes: BigInt(storageMeta.sizeBytes),
          checksum: storageMeta.checksumSha256,
          completedAt: new Date(),
        },
      });

      // 6. Record Audit Log entry
      await prisma.backupAuditLog.create({
        data: {
          backupId: backupRecord.id,
          actorId: actorInfo.actorId,
          actorEmail: actorInfo.actorEmail || "SYSTEM",
          action: "CREATE_BACKUP",
          status: "SUCCESS",
          details: `Backup '${filename}' created successfully (${(storageMeta.sizeBytes / 1024 / 1024).toFixed(2)} MB, SHA-256: ${storageMeta.checksumSha256.substring(0, 12)}...)`,
          ipAddress: actorInfo.ipAddress,
        },
      });

      return {
        success: true,
        backupId: backupRecord.id,
        filename,
        sizeBytes: storageMeta.sizeBytes,
        checksum: storageMeta.checksumSha256,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown backup failure";

      await prisma.backup.update({
        where: { id: backupRecord.id },
        data: {
          status: BackupStatus.FAILED,
          errorMessage,
        },
      });

      await prisma.backupAuditLog.create({
        data: {
          backupId: backupRecord.id,
          actorId: actorInfo.actorId,
          actorEmail: actorInfo.actorEmail || "SYSTEM",
          action: "CREATE_BACKUP",
          status: "FAILED",
          details: `Backup execution failed: ${errorMessage}`,
          ipAddress: actorInfo.ipAddress,
        },
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

export const backupService = new BackupService();