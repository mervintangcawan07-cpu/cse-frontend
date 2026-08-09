// Relative Path: scripts/test-backup-system.ts
import { backupService } from "../src/lib/backup/backupService";
import { backupVerificationService } from "../src/lib/backup/backupVerification";
import { backupHealthMonitor } from "../src/lib/backup/backupHealth";
import { backupRetentionService } from "../src/lib/backup/backupRetention";
import { BackupType } from "@prisma/client";

async function runDisasterRecoveryTestSuite() {
  console.log("\n=======================================================");
  console.log("🛡️ RUNNING DISASTER RECOVERY & BACKUP INTEGRATION TESTS");
  console.log("=======================================================\n");

  try {
    // Test 1: Dump Database Snapshot
    console.log("1️⃣ Testing Database Snapshot Serializer...");
    const snapshot = await backupService.dumpDatabaseSnapshot();
    const tableKeys = Object.keys(snapshot.tables as Record<string, unknown[]>);
    console.log(`   ✅ Snapshot created successfully (${tableKeys.length} models serialized).`);

    // Test 2: Create Manual Backup
    console.log("\n2️⃣ Testing Backup Engine (Gzip + SHA-256 + Storage Vault)...");
    const backupResult = await backupService.createBackup(BackupType.MANUAL, {
      actorEmail: "TEST_SUITE_RUNNER",
    });

    if (!backupResult.success || !backupResult.backupId) {
      throw new Error(`Backup creation failed: ${backupResult.error}`);
    }
    console.log(`   ✅ Backup created: ${backupResult.filename}`);
    console.log(`   📦 Size: ${(Number(backupResult.sizeBytes) / 1024 / 1024).toFixed(3)} MB`);
    console.log(`   🔑 SHA-256: ${backupResult.checksum}`);

    // Test 3: Run Integrity Verification
    console.log("\n3️⃣ Testing Cryptographic Integrity Verification...");
    const verification = await backupVerificationService.verifyBackup(
      backupResult.backupId,
      { actorEmail: "TEST_SUITE_RUNNER" }
    );

    if (!verification.success) {
      throw new Error(`Verification failed: ${verification.message}`);
    }
    console.log(`   ✅ Verification Result: ${verification.status}`);
    console.log(`   📋 Message: ${verification.message}`);

    // Test 4: Check Backup Health Monitor
    console.log("\n4️⃣ Testing Health Report Generation...");
    const health = await backupHealthMonitor.getHealthReport();
    console.log(`   ✅ System Health: ${health.status}`);
    console.log(`   📊 Total Backups in System: ${health.totalBackups}`);
    console.log(`   ✔️ Verified Count: ${health.verifiedCount}`);

    // Test 5: Retention Enforcer Test
    console.log("\n5️⃣ Testing Retention Policy Rules...");
    const retention = await backupRetentionService.enforceRetention(7, {
      actorEmail: "TEST_SUITE_RUNNER",
    });
    console.log(`   ✅ Retention Enforced (${retention.preservedCount} preserved, ${retention.deletedCount} purged).`);

    console.log("\n=======================================================");
    console.log("🎉 ALL DISASTER RECOVERY TESTS PASSED SUCCESSFULLY!");
    console.log("=======================================================\n");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Test suite exception";
    console.error(`\n❌ DISASTER RECOVERY TEST FAILED: ${msg}\n`);
    process.exit(1);
  }
}

runDisasterRecoveryTestSuite();