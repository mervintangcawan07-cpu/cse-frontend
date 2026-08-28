import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const restorePath = "src/lib/backup/backupRestore.ts";
const routePath = "src/app/api/admin/backups/[id]/route.ts";
const pagePath = "src/app/admin/backups/page.tsx";
const healthPath = "src/lib/backup/backupHealth.ts";

const restore = fs.readFileSync(restorePath, "utf8");
const route = fs.readFileSync(routePath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
const health = fs.readFileSync(healthPath, "utf8");

const DISABLED_MESSAGE =
  "Application-level database restore is temporarily disabled while P0-003 recovery integrity remediation is in progress.";

test("restore service defines fixed P0-003 containment contract", () => {
  assert.match(
    restore,
    /P0_003_RESTORE_DISABLED_CODE\s*=\s*"P0_003_RESTORE_DISABLED"/
  );

  assert.ok(restore.includes(DISABLED_MESSAGE));
  assert.match(
    restore,
    /P0_003_RESTORE_CONTAINMENT_ACTIVE\s*=\s*true/
  );
});

test("executeRestore fails closed before legacy restore execution", () => {
  const methodStart = restore.indexOf("public async executeRestore(");
  const containment = restore.indexOf(
    "if (P0_003_RESTORE_CONTAINMENT_ACTIVE)",
    methodStart
  );
  const legacyConfirmation = restore.indexOf(
    'if (confirmationText !== "RESTORE")',
    methodStart
  );
  const legacyCall = restore.indexOf(
    "return await this.restoreFromBackup(backupId, actorInfo)",
    methodStart
  );

  assert.ok(methodStart >= 0);
  assert.ok(containment > methodStart);
  assert.ok(legacyConfirmation > containment);
  assert.ok(legacyCall > containment);
});

test("restoreFromBackup fails closed before first database read", () => {
  const methodStart = restore.indexOf("public async restoreFromBackup(");
  const containment = restore.indexOf(
    "if (P0_003_RESTORE_CONTAINMENT_ACTIVE)",
    methodStart
  );
  const firstDatabaseRead = restore.indexOf(
    "prisma.backup.findUnique",
    methodStart
  );

  assert.ok(methodStart >= 0);
  assert.ok(containment > methodStart);
  assert.ok(firstDatabaseRead > containment);
});

test("legacy restore implementation remains preserved for later remediation", () => {
  assert.ok(
    restore.includes(
      "private async applySnapshotToDatabase("
    )
  );

  assert.ok(
    restore.includes(
      "private async executeAutomaticRollback("
    )
  );

  assert.ok(
    restore.includes(
      "await this.applySnapshotToDatabase(parsedSnapshot.tables)"
    )
  );
});

test("admin restore API rejects restore with HTTP 503", () => {
  assert.ok(route.includes('if (action === "restore")'));
  assert.ok(route.includes("P0_003_RESTORE_DISABLED_CODE"));
  assert.ok(route.includes("P0_003_RESTORE_DISABLED_MESSAGE"));
  assert.match(route, /\{\s*status:\s*503\s*\}/);

  assert.equal(
    route.includes("backupRestoreService.executeRestore("),
    false,
    "HTTP route must not invoke restore service while containment is active"
  );
});

test("verify and protect API actions remain available", () => {
  assert.ok(route.includes('if (action === "verify")'));
  assert.ok(route.includes('if (action === "protect")'));
  assert.ok(route.includes("backupVerificationService.verifyBackup"));
  assert.ok(route.includes("prisma.backup.update"));
});

test("backup delete API remains available", () => {
  assert.ok(route.includes("export async function DELETE("));
  assert.ok(route.includes("backupStorage.deleteBackup"));
  assert.ok(route.includes("prisma.backup.delete"));
});

test("admin backup UI exposes disabled restore control", () => {
  assert.ok(
    page.includes(
      'title="Restore temporarily disabled under P0-003 recovery containment"'
    )
  );

  assert.ok(page.includes("Restore Disabled"));
});

test("admin UI no longer claims exact-state or emergency-shield restore", () => {
  assert.equal(
    page.includes(
      "You are about to restore the database to the exact state saved in backup file:"
    ),
    false
  );

  assert.equal(
    page.includes("<strong>Emergency Shield Enabled:</strong>"),
    false
  );

  assert.ok(
    page.includes(
      "Backup verification confirms payload integrity only; it does not currently establish complete database restorability."
    )
  );
});

test("existing backup management actions remain present in UI", () => {
  assert.ok(page.includes("handleCreateBackup"));
  assert.ok(page.includes("handleVerify"));
  assert.ok(page.includes("handleProtectToggle"));
  assert.ok(page.includes("handleDelete"));
  assert.ok(page.includes("Create Backup Now"));
  assert.ok(page.includes("Verify"));
});

test("backup health fails closed while P0-003 is active", () => {
  assert.ok(
    health.includes(
      'status = "CRITICAL";'
    )
  );

  assert.ok(
    health.includes(
      "Backup integrity verification does not currently establish full database restorability."
    )
  );

  const containmentComment = health.indexOf("// P0-003 containment:");
  const forcedCritical = health.indexOf(
    'status = "CRITICAL";',
    containmentComment
  );
  const returnStatement = health.indexOf("return {", containmentComment);

  assert.ok(containmentComment >= 0);
  assert.ok(forcedCritical > containmentComment);
  assert.ok(returnStatement > forcedCritical);
});

test("P0-003 containment code does not claim verification equals restorability", () => {
  assert.equal(
    health.includes(
      "Backup integrity verification establishes full database restorability"
    ),
    false
  );
});
