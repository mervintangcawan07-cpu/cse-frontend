# GSA-P0-003 — Unsafe Application Database Restore Containment

## Status

**IMPLEMENTED / LOCALLY VALIDATED — NOT YET PUSHED OR DEPLOYED**

Discovery commit:

`1736f6c docs: record P0-003 recovery discovery`

Implementation baseline:

`ac783074bf723d1a19879335184ad4a9bddf9989`

This containment is intentionally narrow and reversible.

It does not redesign the backup architecture and does not claim that the application backup subsystem is now a complete disaster-recovery system.

---

## 1. Objective

GSA-P0-003 established that the existing application restore feature can report successful restoration while synchronizing only a small subset of the captured snapshot datasets.

The immediate objective of this containment slice is therefore to:

- prevent unsafe application-level restore execution;
- prevent direct service callers from bypassing containment;
- prevent the admin interface from initiating restore;
- stop the application from advertising healthy disaster-recovery capability;
- preserve unrelated backup-management functionality;
- preserve the legacy restore implementation for later controlled redesign;
- avoid all production database, schema, migration, and provider-side operations.

---

## 2. Approved Containment Scope

### Modified production files

`src/lib/backup/backupRestore.ts`

`src/app/api/admin/backups/[id]/route.ts`

`src/app/admin/backups/page.tsx`

`src/lib/backup/backupHealth.ts`

### Added validation file

`src/scripts/test-p0-003-containment.ts`

No other production source file is part of this containment change.

---

## 3. Explicitly Unchanged / Out of Scope

The following were intentionally not modified:

`src/lib/backup/backupService.ts`

`src/lib/backup/backupStorage.ts`

`src/lib/backup/backupVerification.ts`

daily backup cron behavior

Prisma schema

Prisma migrations

refund migration

production database state

P0-002 B2 authentication migration

complete disaster-recovery architecture

external/offsite backup-provider implementation

No attempt was made to fix unrelated findings during this containment slice.

---

## 4. Restore Service Fail-Closed Guard

File:

`src/lib/backup/backupRestore.ts`

Containment introduces the fixed code:

`P0_003_RESTORE_DISABLED`

and a fixed recovery-remediation message.

A containment flag is currently set to active:

`P0_003_RESTORE_CONTAINMENT_ACTIVE = true`

Both public restore entry points fail closed:

`executeRestore(...)`

`restoreFromBackup(...)`

The `restoreFromBackup(...)` guard executes before the first:

`prisma.backup.findUnique(...)`

Therefore the contained restore path returns without:

- loading the target backup;
- creating a pre-restore emergency backup;
- changing backup status;
- reading or decompressing backup payloads;
- applying snapshot data;
- creating restore success records;
- invoking automatic rollback;
- mutating application database state.

---

## 5. Defense in Depth

Containment exists at more than one layer.

The admin HTTP route does not rely only on the restore-service guard.

File:

`src/app/api/admin/backups/[id]/route.ts`

For:

`action === "restore"`

the route directly returns:

HTTP `503 Service Unavailable`

with:

`P0_003_RESTORE_DISABLED`

The route no longer invokes:

`backupRestoreService.executeRestore(...)`

while containment is active.

Therefore a normal admin restore request is rejected at the HTTP boundary before reaching the restore service.

The restore service separately remains fail closed in case another caller is introduced or an existing caller bypasses the route.

---

## 6. Legacy Restore Logic Preserved

The containment intentionally does not delete the pre-existing restore implementation.

The following legacy logic remains present behind the fail-closed guard:

`applySnapshotToDatabase(...)`

`executeAutomaticRollback(...)`

backup verification

emergency backup creation

RESTORING / RESTORED / RESTORE_FAILED status handling

restore and rollback audit logging

This preserves implementation context for later remediation while preventing production execution of the unsafe path.

Preservation does not mean the legacy restore implementation is approved for use.

It remains unsafe until independently redesigned and validated.

---

## 7. Admin UI Containment

File:

`src/app/admin/backups/page.tsx`

The restore control is no longer executable.

Verified backup rows display:

`Restore Disabled`

instead of an enabled restore operation.

The visible description states that application-level database restore is temporarily disabled under P0-003.

Misleading visible claims about:

- one-click recovery;
- exact-state restoration;
- a reliable emergency restoration shield

were removed or replaced with recovery-containment wording.

The page now clarifies that checksum/payload verification does not prove full database restorability.

---

## 8. Existing Backup Management Preserved

The containment does not intentionally disable the following existing operations:

Create Backup

Verify Backup

Protect / Unprotect Backup

Delete Backup

The corresponding UI handlers and API branches remain present.

This containment addresses unsafe restore execution only.

Backup capture and verification remain subject to the architectural limitations documented in:

`docs/audit/remediation/P0-003-DISCOVERY.md`

They must not be interpreted as proof of complete disaster recovery.

---

## 9. Backup Health Fail-Closed Behavior

File:

`src/lib/backup/backupHealth.ts`

Existing backup metrics and health calculations were preserved.

However, while P0-003 remains unresolved, disaster-recovery health is explicitly forced to:

`CRITICAL`

The health report includes an alert explaining that:

application-level restore is disabled under P0-003

and

backup integrity verification does not currently establish full database restorability.

This prevents successful checksum verification or recent backup timestamps from incorrectly causing the application to advertise disaster recovery as `HEALTHY`.

---

## 10. P0-003 Containment Test

File:

`src/scripts/test-p0-003-containment.ts`

The dedicated source-level containment test validates:

1. fixed containment code/message exist;
2. `executeRestore(...)` fails closed before legacy restore execution;
3. `restoreFromBackup(...)` fails closed before its first database read;
4. legacy restore implementation remains preserved;
5. restore API rejects with HTTP 503;
6. verify/protect API actions remain;
7. backup deletion remains;
8. admin restore control is disabled;
9. exact-state/emergency-shield claims are removed;
10. existing backup-management UI actions remain;
11. backup health fails closed;
12. containment does not equate verification with restorability.

Result:

`12 passed, 0 failed`

---

## 11. P0-002 Regression — User Purge Containment

Existing regression:

`src/scripts/test-user-purge-containment.ts`

Result:

`8 passed, 0 failed`

Validated behaviors include:

- no production application/runtime physical User delete;
- soft deletion remains;
- restore remains;
- User hard purge remains disabled;
- safe non-user trash cleanup remains;
- recovery purge remains disabled;
- APIs do not falsely report destructive User purge success.

Therefore P0-003 containment did not regress the existing P0-002 destructive-purge containment.

---

## 12. P0-002 B1 Regression

Existing suite:

`src/scripts/test-p0-002-b1.ts`

Result:

`66 passed, 0 failed`

The B1 account-liveness/session authority implementation remains intact.

The suite continued to report:

`B2_DEFERRED_VERIFY_JWT_COUNT=83`

Direct `verifyJWT` migration remains explicitly deferred to P0-002 Slice B2.

The backup admin route remains one of those deferred callers.

No B2 auth migration was performed as part of P0-003 containment.

---

## 13. TypeScript Validation

Command:

`npx tsc --noEmit`

Result:

**PASS**

No TypeScript errors were reported.

---

## 14. ESLint Validation

Changed P0-003 source and test files were validated with targeted ESLint.

Result:

**PASS**

The admin backup page contains a pre-existing:

`react-hooks/set-state-in-effect`

finding associated with its existing initial `fetchBackups()` effect.

Pre-edit inspection proved that code existed before the P0-003 change.

The containment did not modify that effect.

For containment-specific page validation, only that pre-existing rule was suppressed on the command line.

No production source suppression was added.

No unrelated React refactor was performed.

---

## 15. Diff Integrity

Command:

`git diff --check`

Result:

**PASS**

Windows Git emitted LF-to-CRLF informational warnings.

No trailing-whitespace or diff-integrity error was reported.

---

## 16. Production Build Validation

Command:

`npm run build`

Repository build script:

`prisma generate && next build`

Result:

**PASS**

Prisma Client generation completed successfully.

Next.js production build completed successfully.

No Prisma migration was executed.

No `prisma migrate deploy` command was executed.

No `prisma db push` command was executed.

A non-fatal Next.js dynamic-server diagnostic was emitted for:

`/partner-portal`

because that route uses `cookies()`.

The production build nevertheless completed and classified `/partner-portal` as dynamic.

That diagnostic predates and is unrelated to the P0-003 containment scope.

No partner-auth code was modified.

---

## 17. Migration-Hook Inspection

Read-only repository inspection covered:

`package.json`

`vercel.json`

available workflow/configuration files

The repository build configuration contains:

`"build": "prisma generate && next build"`

and:

`"postinstall": "prisma generate"`

No source-controlled build/deploy configuration was found invoking:

`prisma migrate deploy`

`prisma db push`

or another migration application command.

Therefore the local build validation did not apply the pending refund migration.

A separate production deployment gate remains:

Vercel Project Settings must still be checked for any dashboard-level custom Build Command override before pushing a deployment-triggering commit.

---

## 18. Prisma / Database Safety

No Prisma schema file was modified.

No Prisma migration file was modified.

No production database query or write was performed as part of P0-003 containment implementation or validation.

No restore operation was run.

No emergency restore snapshot was created.

No rollback operation was run.

No migration was applied.

No `prisma db push` was run.

The production state of:

`20260825205842_add_refund_operation`

remains independently unresolved and must not be inferred from this containment work.

---

## 19. Source Footprint

The containment production diff is limited to:

`src/app/admin/backups/page.tsx`

`src/app/api/admin/backups/[id]/route.ts`

`src/lib/backup/backupHealth.ts`

`src/lib/backup/backupRestore.ts`

with the validation test:

`src/scripts/test-p0-003-containment.ts`

No unrelated tracked production file was changed.

---

## 20. Validation Summary

P0-003 containment test:

**12 / 12 PASS**

P0-002 purge containment regression:

**8 / 8 PASS**

P0-002 B1 regression:

**66 / 66 PASS**

TypeScript:

**PASS**

Targeted ESLint:

**PASS**

Production build:

**PASS**

`git diff --check`:

**PASS**

Restore API:

**FAIL CLOSED — HTTP 503**

Restore service:

**FAIL CLOSED BEFORE DATABASE ACCESS**

Restore UI:

**DISABLED**

Disaster-recovery health:

**CRITICAL**

Legacy restore implementation:

**PRESERVED BUT UNREACHABLE THROUGH CONTAINED ENTRY POINTS**

Prisma/schema modifications:

**NONE**

Migration execution:

**NONE**

Production database mutation:

**NONE**

---

## 21. Containment Disposition

GSA-P0-003 is now source-contained and locally validated.

It is not yet closed.

Current disposition:

**P0-003 CONTAINMENT IMPLEMENTED / LOCALLY VALIDATED — DEPLOYMENT PENDING**

Before containment may be considered operationally complete:

1. verify Vercel Project Settings do not override the repository build command with a migration-applying command;
2. push the approved commits;
3. confirm the intended production deployment reaches READY;
4. verify `/api/health/readiness` remains UP;
5. verify the production Admin Backups page shows Restore Disabled;
6. verify a production restore request is rejected without performing database restoration;
7. confirm no migration was unexpectedly applied during deployment.

No production restore should be executed as part of smoke testing.

A restore rejection may be tested only through the contained HTTP behavior and must not bypass the containment guard.

---

## 22. Relationship to Long-Term Remediation

This containment does not close the architectural recovery finding.

Long-term P0-003 closure requires a separately authorized design that establishes:

- schema-complete backup coverage;
- transactional or otherwise proven point-in-time consistency;
- independent/offsite durable storage;
- governed backup schema/storage migrations;
- relationally correct restoration;
- empty-state correctness;
- deterministic restore reporting;
- safe rollback semantics;
- disposable restore testing;
- independent proof of restorability.

Until that work is completed:

**VERIFIED BACKUP DOES NOT MEAN FULLY RESTORABLE DATABASE.**

---

## 23. Final Safety Rule

**APPLICATION-LEVEL DATABASE RESTORE MUST REMAIN DISABLED IN PRODUCTION WHILE P0-003 IS OPEN.**

The contained implementation must not be bypassed manually, through another route, through direct service invocation, or by reverting the guard without a separately reviewed recovery-remediation phase.
