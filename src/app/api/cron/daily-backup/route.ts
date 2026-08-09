// Relative Path: src/app/api/cron/daily-backup/route.ts
import { NextResponse } from "next/server";
import { backupService } from "@/lib/backup/backupService";
import { backupVerificationService } from "@/lib/backup/backupVerification";
import { backupRetentionService } from "@/lib/backup/backupRetention";
import { BackupType } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.BACKUP_CRON_SECRET || process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
    }

    const backupResult = await backupService.createBackup(BackupType.DAILY, {
      actorEmail: "AUTOMATED_CRON_JOB",
    });

    if (!backupResult.success || !backupResult.backupId) {
      return NextResponse.json(
        { error: `Automated backup failed: ${backupResult.error}` },
        { status: 500 }
      );
    }

    const verificationResult = await backupVerificationService.verifyBackup(
      backupResult.backupId,
      { actorEmail: "AUTOMATED_CRON_JOB" }
    );

    const retentionResult = await backupRetentionService.enforceRetention(7, {
      actorEmail: "AUTOMATED_CRON_JOB",
    });

    return NextResponse.json({
      success: true,
      message: "Automated daily backup, verification, and retention cleanup executed.",
      backup: backupResult,
      verification: verificationResult,
      retention: retentionResult,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Cron execution exception";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}