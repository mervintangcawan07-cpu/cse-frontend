# GSA-P0-002 Immediate Source-Only Containment

## Status

**CONTAINED — NOT FULLY RESOLVED**

This document records the immediate source-only containment of GSA-P0-002. It does not represent the long-term tombstone/anonymization design, foreign-key hardening, production data review, or final resolution of the finding.

## Baseline

- Branch: `main`
- Baseline HEAD: `d3c2e67fb241a02b457ec6aeccbba87701cf5bc4`
- Current HEAD after containment: `d3c2e67fb241a02b457ec6aeccbba87701cf5bc4`
- The pre-existing tracked working tree was clean.
- Pre-existing untracked user files and directories were preserved.

## Files inspected

- `AGENTS.md`
- `GEMINI.md`
- `docs/audit/remediation/P0-002-DISCOVERY.md`
- `src/lib/recovery/softDelete.ts`
- `src/jobs/purgeExpiredRecords.ts`
- `src/types/recovery.ts`
- `src/types/softDelete.ts`
- `src/app/api/admin/trash/route.ts`
- `src/app/api/admin/recovery/route.ts`
- `src/scripts/test-partner-auth-integration.ts`
- `src/scripts/test-partner-portal-v3.ts`
- `scripts/production-test-data-cleanup.ts`
- Relevant Prisma schema and generated-client usage patterns were inspected read-only.

## Files modified or created

- `src/lib/recovery/softDelete.ts`
- `src/jobs/purgeExpiredRecords.ts`
- `src/types/recovery.ts`
- `src/types/softDelete.ts`
- `src/app/api/admin/trash/route.ts`
- `src/app/api/admin/recovery/route.ts`
- `src/scripts/test-user-purge-containment.ts` (created)
- `docs/audit/remediation/P0-002-CONTAINMENT.md` (created)

No Prisma schema, migration, dependency, environment, deployment, or production configuration file was changed.

## Containment implemented

### Trash purge flow

- Physical `User` deletion was removed from `purgeExpiredRecords` in `src/lib/recovery/softDelete.ts`.
- The flow now returns an explicit zero-count `User` result marked disabled with code `USER_HARD_PURGE_DISABLED`.
- The disabled result is constructed before any `User` database mutation.
- Existing soft-delete and restore mutations remain unchanged.
- Existing physical cleanup of expired `Question`, `Flashcard`, and `SystemSetting` records remains unchanged.

The trash API continues to report success for the non-User cleanup that actually ran, while explicitly returning that User hard purge is disabled. It no longer implies that expired User records were physically purged.

### Recovery purge flow

- Prisma access and all User candidate lookup, batching, and physical deletion were removed from `src/jobs/purgeExpiredRecords.ts`.
- The recovery purge helper returns immediately with zero examined, zero purged, and an explicit disabled code/message.
- No User identifiers or personal data are logged by the contained helper.
- The recovery API returns HTTP 501 with `success: false`, the disabled status, code, message, and zero-count result. It no longer returns false purge success.

Authentication and authorization behavior of both routes was preserved; adjacent findings were not changed.

## Static physical-delete scan

The current working tree was scanned by source category for Prisma User delete/deleteMany calls and raw SQL User deletion patterns.

- Production application/runtime User physical-delete calls: **0**
- Protected test scripts still containing cleanup-only User deletion:
  - `src/scripts/test-partner-auth-integration.ts`
  - `src/scripts/test-partner-portal-v3.ts`
- Protected operator cleanup script still containing User deletion:
  - `scripts/production-test-data-cleanup.ts`

Those test/operator scripts were documented only and were not modified, as required by task scope.

## Regression verification

`src/scripts/test-user-purge-containment.ts` performs source-only checks and does not import Prisma or connect to a database. It verifies:

- no physical User deletion remains in production application/runtime source;
- User soft delete and restore remain available;
- trash purge reports User deletion disabled with zero count;
- Question, Flashcard, and SystemSetting cleanup remains present;
- recovery purge returns before Prisma access or User mutation;
- both APIs expose truthful containment responses.

Result: **PASS — 8 passed, 0 failed**.

The repository's `tsx` launcher could not initialize because the host returned an `ENOMEM` error while resolving its temporary directory. The same source-only test was then executed successfully with Node's built-in TypeScript stripping. No database was accessed.

## Required validation results

- `npx --no-install prisma validate --schema prisma/schema.prisma`: **PASS**
- `npx --no-install prisma generate`: **PASS**
- `npx --no-install tsc --noEmit --incremental false`: **PASS**
- `npm run build`: **PASS**
- Relevant containment regression test: **PASS**

The production build completed with exit code 0. A non-fatal partner-auth dynamic-rendering diagnostic was emitted during static generation; it was outside this containment scope and was not changed.

## Safety and scope confirmation

- Production database accessed: **NO**
- Database modified: **NO**
- Schema modified: **NO**
- Migration created: **NO**
- Dependencies modified: **NO**
- Production systems or configuration modified: **NO**
- Existing soft-delete behavior preserved: **YES**
- Existing restore behavior preserved: **YES**
- Safe non-User cleanup preserved: **YES**
- P0-003 started: **NO**

## Remaining work for full resolution

GSA-P0-002 remains not fully resolved. A separate, explicitly approved phase must design and validate a retention-safe tombstone/anonymization lifecycle, examine production referential dependencies with read-only prechecks, and determine any required foreign-key or schema hardening. No such work was started here.

## Next action

Human review of this containment is required before commit/deploy and before any production precheck or schema work.
