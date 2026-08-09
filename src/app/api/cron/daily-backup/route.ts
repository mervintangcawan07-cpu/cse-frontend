// Relative Path: src/app/api/cron/daily-backup/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { backupService } from "@/lib/backup/backupService";
import { backupVerificationService } from "@/lib/backup/backupVerification";
import { backupRetentionService } from "@/lib/backup/backupRetention";
import { BackupType } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    // 1. Verify Authorization Header against CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // In production, enforce CRON_SECRET check
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized cron execution request." },
        { status: 401 }
      );
    }

    // 2. Execute Automated Daily Backup
    const backupResult = await backupService.createBackup(BackupType.DAILY, {
      actorEmail: "VERCEL_AUTOMATED_CRON",
    });

    if (!backupResult.success || !backupResult.backupId) {
      return NextResponse.json(
        { error: "Daily cron backup failed.", details: backupResult.error },
        { status: 500 }
      );
    }

    // 3. Trigger Immediate Integrity Verification
    const verificationResult = await backupVerificationService.verifyBackup(
      backupResult.backupId,
      { actorEmail: "VERCEL_AUTOMATED_CRON" }
    );

    // 4. Run Retention Policy Rules (Keep last 7 days)
    const retentionResult = await backupRetentionService.enforceRetention(7, {
      actorEmail: "VERCEL_AUTOMATED_CRON",
    });

    return NextResponse.json({
      success: true,
      message: "Automated daily backup, verification, and retention cleanup executed.",
      backup: backupResult,
      verification: verificationResult,
      retention: retentionResult,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Cron execution failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}