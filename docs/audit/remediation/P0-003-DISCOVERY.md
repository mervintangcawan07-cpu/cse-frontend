# GSA-P0-003 — Application Backup / Restore Recovery Integrity Discovery

## Status

**CONFIRMED — CRITICAL RECOVERY MISREPRESENTATION**

Discovery completed against source baseline:

`ac783074bf723d1a19879335184ad4a9bddf9989`

Discovery was read-only.

No production database writes, schema changes, Prisma migrations, backup restore operations, or provider-side mutations were performed during discovery.

---

## 1. Finding Summary

The GovStudyX application-level backup subsystem does not currently establish a reliable full-database disaster-recovery capability.

The current implementation can report successful database restoration even though only a small subset of snapshot datasets are actually written back to the database.

Accordingly, application-level restore must not be treated as a valid full database recovery mechanism until the subsystem is redesigned and independently validated.

### Discovery disposition

- Full backup capability: **NOT ESTABLISHED**
- Full database restore: **NO**
- Point-in-time consistency: **NOT ESTABLISHED**
- Independent/offsite durability: **NOT ESTABLISHED**
- Restore verification: **DOES NOT PROVE RESTORABILITY**
- Automatic rollback reliability: **NOT ESTABLISHED**
- Restore success reporting: **FALSE / MISLEADING**
- Backup health `HEALTHY`: **NOT A RELIABLE DISASTER-RECOVERY INDICATOR**

---

## 2. Restore Engine — Partial Writes Reported as Full Synchronization

File:

`src/lib/backup/backupRestore.ts`

The restore helper `applySnapshotToDatabase()` iterates through snapshot datasets.

However, actual database restoration is implemented only for:

1. `pricingPlans`
2. `systemSettings`
3. `featureFlags`

For unsupported arrays, the implementation reaches the fallback branch and increments `syncedTables` without performing any database write.

This means a snapshot containing many datasets can report that many models were synchronized even though only up to three datasets were actually modified.

### Security / recovery impact

The `restoredTablesCount` value does not represent the number of datasets restored.

It therefore cannot be used as evidence that the database was restored to the snapshot state.

---

## 3. Empty-State Restoration Is Incorrect

The three implemented restore branches execute only when:

`records.length > 0`

If a backup snapshot contains an empty dataset while the current production database contains rows, the restore helper does not clear those current rows.

Instead, the fallback path increments the synchronization counter.

Therefore even the three supported datasets do not implement exact-state restoration for empty snapshots.

---

## 4. False RESTORED / SUCCESS State

File:

`src/lib/backup/backupRestore.ts`

After `applySnapshotToDatabase()` returns, the restore workflow:

- changes the backup status to `RESTORED`;
- sets `restoredAt`;
- creates a `RESTORE_DATABASE` audit event with `SUCCESS`;
- returns `success: true`;
- reports that the database was restored successfully;
- reports the defective `restoredTablesCount`.

Because the synchronization counter can include datasets that were never written, these success states and messages can falsely represent an incomplete restore as successful.

---

## 5. Automatic Rollback Uses the Same Defective Restore Primitive

File:

`src/lib/backup/backupRestore.ts`

The automatic rollback path loads the pre-restore emergency snapshot and calls the same:

`applySnapshotToDatabase()`

Therefore automatic rollback inherits the same incomplete synchronization behavior.

It can subsequently record:

- `AUTOMATIC_ROLLBACK`;
- audit status `SUCCESS`;
- `"Automatic rollback completed successfully."`

without establishing that the full pre-restore database state was restored.

The current emergency rollback mechanism must therefore not be relied upon as a complete recovery shield.

---

## 6. Production-Reachable Admin Restore API

File:

`src/app/api/admin/backups/[id]/route.ts`

The admin backup action route exposes:

`action === "restore"`

and delegates directly to:

`backupRestoreService.executeRestore(...)`

The route considers the operation successful when the restore service reports success.

Therefore the defective restore implementation is reachable through a production admin interface.

Authentication modernization for this route is separately deferred to P0-002 Slice B2 and is not part of P0-003 containment scope.

---

## 7. Admin UI Overstates Recovery Capability

File:

`src/app/admin/backups/page.tsx`

The pre-containment UI included claims such as:

- `Disaster Recovery & Backup Management`
- automated backups with emergency restoration shields;
- `One-Click Restore`;
- restoration to the `exact state` contained in the backup;
- `Emergency Shield Enabled`.

Those statements exceed the recovery guarantees provided by the implementation.

The current restore implementation cannot substantiate exact-state full-database restoration.

---

## 8. Snapshot Creation Is Hard-Coded and Partial

File:

`src/lib/backup/backupService.ts`

The application backup snapshot is manually constructed from a fixed list of application datasets.

Discovery identified 28 captured datasets.

The code describes the result as a complete snapshot of active database models, but current schema/application functionality contains additional datasets that are not represented in that list.

Examples include financial/accounting/referral/partner/recovery-related structures introduced elsewhere in the application.

`RefundOperation` is present in current source/schema work but is not included in the inspected application snapshot list.

Therefore completeness of the application snapshot is not established.

---

## 9. Snapshot Is Not Transactionally Point-in-Time Consistent

File:

`src/lib/backup/backupService.ts`

Backup datasets are collected through multiple independent Prisma `findMany()` operations executed together.

Discovery did not identify a database snapshot transaction providing one consistent database point in time across all captured datasets.

Concurrent writes can therefore result in a backup containing records observed at different logical moments.

The current application snapshot must not be described as a guaranteed point-in-time database backup.

---

## 10. Backup Storage Is Not Independent Disaster-Recovery Storage

File:

`src/lib/backup/backupStorage.ts`

In Vercel/production environments, local backup storage uses a temporary runtime directory.

The storage helper then attempts to persist a base64 backup payload into a PostgreSQL `BackupPayload` table.

The persistent recovery payload is therefore stored inside the same PostgreSQL database the feature is intended to protect.

If that database is unavailable or lost, the application-level recovery payload can be lost with it.

This does not establish independent/offsite disaster-recovery durability.

---

## 11. Persistent Backup Save Failure Can Be Swallowed

File:

`src/lib/backup/backupStorage.ts`

Failure while persisting the backup payload into PostgreSQL is caught and logged by the storage layer.

The helper can continue without propagating the persistence failure to the backup service.

File:

`src/lib/backup/backupService.ts`

The backup service can then mark the backup `COMPLETED` and report success.

Accordingly, a completed application backup record does not prove durable persistence outside ephemeral runtime storage.

---

## 12. Runtime BackupPayload Table Creation Bypasses Migration Governance

File:

`src/lib/backup/backupStorage.ts`

Discovery identified runtime use of raw SQL equivalent to:

`CREATE TABLE IF NOT EXISTS "BackupPayload" (...)`

Application runtime schema creation bypasses normal Prisma migration governance.

This behavior is not modified during P0-003 containment but must be addressed in later backup architecture remediation.

---

## 13. Verification Checks Integrity, Not Restorability

File:

`src/lib/backup/backupVerification.ts`

Current verification performs checks including:

- payload availability;
- SHA-256 checksum;
- gzip decompression;
- JSON parsing;
- presence of snapshot table structure;
- presence of a small set of critical dataset keys;
- array and record counts.

These checks can establish payload integrity and limited structure.

They do not establish:

- coverage of the full current database schema;
- relational consistency;
- point-in-time consistency;
- successful restoration;
- full application recovery;
- external/offsite durability.

Therefore:

**VERIFIED does not mean RESTORABLE.**

---

## 14. Backup Health Can Advertise False Recovery Health

File:

`src/lib/backup/backupHealth.ts`

Pre-containment health reporting begins from `HEALTHY` and evaluates backup records using statuses such as:

- `COMPLETED`
- `RESTORED`
- `VERIFIED`

and verification status:

- `PASSED`

Because those states do not establish full restorability, the resulting `HEALTHY` disaster-recovery status can be misleading.

Backup-health reporting must fail closed while P0-003 remains unresolved.

---

## 15. Daily Backup Automation Inherits the Same Semantics

The application contains a scheduled daily backup route.

Automated creation and integrity verification do not correct the architectural limitations above.

A regularly created and checksum-verified partial snapshot is still not proven to be a complete recoverable database backup.

The cron itself is not modified as part of the initial P0-003 containment slice unless later implementation analysis establishes a separate safety requirement.

---

## 16. Immediate Containment Decision

P0-003 requires immediate fail-closed containment before redesign.

Approved narrow containment boundary:

### Modify

- `src/lib/backup/backupRestore.ts`
- `src/app/api/admin/backups/[id]/route.ts`
- `src/app/admin/backups/page.tsx`
- `src/lib/backup/backupHealth.ts`

### Add

- `src/scripts/test-p0-003-containment.ts`

### Explicitly out of scope for containment

- `src/lib/backup/backupService.ts`
- `src/lib/backup/backupStorage.ts`
- `src/lib/backup/backupVerification.ts`
- daily backup cron behavior
- Prisma schema
- Prisma migrations
- production database operations
- refund migration deployment
- P0-002 B2 authentication migration
- complete disaster-recovery redesign
- external/offsite backup-provider implementation

---

## 17. Required Containment Behavior

Until P0-003 is fully remediated:

1. Application-level restore must fail closed before database mutation.
2. Direct service callers must not be able to bypass containment.
3. Admin restore API must reject restore requests.
4. Admin UI must not expose an executable restore operation.
5. UI must not claim exact-state restoration or a reliable emergency restore shield.
6. Backup health must not advertise `HEALTHY` disaster recovery.
7. Existing backup creation, verification, protection, and deletion functionality should remain intact unless independently found unsafe.
8. Existing legacy restore implementation should remain preserved behind the containment guard for later controlled redesign.
9. Production restore must not be used as a validation technique.

---

## 18. Production Safety Rule

**DO NOT USE APPLICATION-LEVEL DATABASE RESTORE IN PRODUCTION WHILE GSA-P0-003 REMAINS OPEN.**

Production recovery, if required before P0-003 is fully resolved, must use a separately established and independently validated recovery mechanism rather than the current application restore feature.

---

## 19. Relationship to P0-002

P0-002 remains:

**CONTAINED — NOT FULLY RESOLVED**

P0-002 Slice B1 has already established centralized account/session-liveness foundations.

P0-003 containment is required before P0-002 proceeds into production schema migration or irreversible terminal anonymization work.

No P0-002 schema deployment is authorized by this discovery record.

---

## 20. Refund Migration Safety

The source repository contains the refund migration:

`prisma/migrations/20260825205842_add_refund_operation/migration.sql`

P0-003 discovery does not establish whether that migration is applied in production.

No migration is authorized here.

Before any future schema-sensitive production deployment requiring migration execution, separately reconcile:

- production `_prisma_migrations`;
- actual production database objects;
- source migration history;
- migration hashes/state.

Do not:

- edit or delete historical migration files;
- reorder migrations;
- fake-resolve migration state;
- use `prisma db push` as a substitute.

---

## 21. Discovery Conclusion

GSA-P0-003 is confirmed.

The application currently has backup capture and integrity-verification functionality, but it does not currently provide a demonstrated complete disaster-recovery system.

The production-reachable restore path can misrepresent incomplete synchronization as successful restoration.

Immediate fail-closed containment is required.

Long-term closure requires a separately designed, tested, independently durable, schema-complete and demonstrably restorable recovery architecture.

**GSA-P0-003 status after discovery: CONFIRMED — CONTAINMENT REQUIRED.**
