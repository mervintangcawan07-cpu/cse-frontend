# GSA-P0-002 Read-Only Architecture and Data-Integrity Discovery

## 1. Scope and baseline

- Task: GovStudyX Phase 0 / Task 0.2A only.
- Finding: `GSA-P0-002` — permanent `User` purge can cascade-delete financial and audit-critical records.
- Repository: `C:\Users\Administrator\cse-frontend`.
- Branch: `main`.
- Baseline HEAD: `d3c2e67fb241a02b457ec6aeccbba87701cf5bc4` (`docs: close P0-001 credential incident`).
- Current HEAD during discovery: `d3c2e67fb241a02b457ec6aeccbba87701cf5bc4`.
- Baseline tracked state: clean.
- Protected pre-existing work: the untracked portfolio READMEs, audit files, re-audit directory, and `scripts/` tree reported by Git were not changed.
- Production database access: none.
- Database mutation: none.
- Application source/schema/migration changes: none.

Files inspected included `AGENTS.md`, `GEMINI.md`, the complete Prisma schema and all three migration directories, all repository matches for physical `User` deletion, both purge implementations and their callers, scheduler configuration, sudo middleware, financial/referral/partner/accounting/refund code, cleanup/test harnesses, and related package scripts.

## 2. Finding confirmation

**FINDING CONFIRMED: YES.**

Current source contains two deployed application/API paths that physically delete `User` rows. The current Prisma schema declares 32 required direct child-to-`User` relations and sets every one to `onDelete: Cascade`. The baseline migration implements the same 32 database foreign keys as `ON DELETE CASCADE`.

The direct cascades include `Transaction`, referral attribution/reward/payout records, and related referral records. Deleting a `Transaction` then cascades again into `ReferralReward` and `PartnerCommission`. `FinancialLedgerEntry` and `TaxRecord` survive a transaction deletion through `SET NULL`, but lose their transaction link. Other logical references have no foreign key and remain as dangling identifiers. This is a destructive, atomic database behavior, not merely an application display problem.

## 3. Complete hard-delete entry-point inventory

Searches covered Prisma `delete`/`deleteMany`, raw SQL deletion, helpers, routes, retention jobs, cron configuration, scripts, and transaction callbacks. Five current code locations can physically delete `User`. No raw `DELETE FROM User`, `TRUNCATE User`, account-deletion route, scheduled cron caller, or additional hard-delete helper was found. `softDeleteRecord("user", ...)` exists but has no current caller found by repository search.

| # | File and entry point | Caller / authorization | Mode, delay, and scheduling | Physical delete / production reach | ADMIN / partner-linked reach | Idempotency / dry run |
|---|---|---|---|---|---|---|
| 1 | `src/lib/recovery/softDelete.ts` — `purgeExpiredRecords(retentionDays = 30)` | `POST /api/admin/trash`, action `PURGE`; primary JWT is checked. Access permits `ADMIN` or one hardcoded email exception, which is an adjacent authorization concern and is not remediated here. No sudo requirement. | Manual API call; 30 days based on `User.deletedAt`; not scheduled. | Calls `prisma.user.deleteMany`; production-reachable through the deployed route. | No role or relationship filter: can delete an eligible `ADMIN` and a user with transactions/referrals/partner attribution. | Repeated execution becomes a count-zero no-op for rows already gone, but there is no request idempotency key or encompassing transaction. Non-User purges run sequentially, so partial completion is possible. No dry run. |
| 2 | `src/jobs/purgeExpiredRecords.ts` — `purgeExpiredRecords(batchSize = 50)` | `DELETE /api/admin/recovery`; wrapped by `requireSudo`. The DELETE handler does not independently validate the primary admin JWT; the sudo ticket is its only local wrapper check. This is documented only. | Background-style/manual API call; 30 days based on `isBanned`, a soft-delete marker in `banReason`, and `updatedAt`; not present in `vercel.json` or the scheduled background worker. | Calls `prisma.user.deleteMany` for selected IDs; production-reachable through the deployed route. | No role or relationship filter: can delete eligible `ADMIN` and partner-linked users. | Eventually repeatable, but not request-idempotent or transaction-wide. Advancing `skip` after deletion can skip remaining eligible rows in the same invocation; later invocations may catch them. No dry run. |
| 3 | `src/scripts/test-partner-portal-v3.ts` — fixture cleanup | Direct/manual script; no package script or disposable-target authorization guard was found. | Manual test; no retention delay; not scheduled. | Calls `prisma.user.delete` through the shared configured Prisma client. It can reach whichever database the environment configures, including production if an operator runs it unsafely. | Current flow creates and deletes a default `USER` fixture linked to a transaction/partner commission; it does not target an admin. | Not idempotent (`delete` throws if absent), no dry run, and cleanup is not in `finally`. It explicitly deletes related finance rows first. |
| 4 | `src/scripts/test-partner-auth-integration.ts` — fixture cleanup | `npm run test:partner-auth:integration` through `run-partner-auth-integration.mjs`. The harness requires a disposable database name prefix, destructive-test confirmation, exact database identity, an initially empty database, isolated environment, and rejects production markers/secrets. | Manual test; no retention delay; not scheduled. | Calls `prisma.user.deleteMany` only for tracked fixture IDs. Under the supported harness it is prevented from targeting production. | Current fixture creation uses default `USER` accounts; cleanup can include partner-linked fixtures but not arbitrary/admin rows. | `deleteMany` cleanup is repeat-safe for tracked IDs. The runner has a preflight-only mode, but actual cleanup is not a dry-run simulation. |
| 5 | `scripts/production-test-data-cleanup.ts` — serializable cleanup transaction | Direct, human-operated production cleanup tool. Execution requires mutually exclusive mode flags, an explicit destructive confirmation, approved manifest/hash, executor hash, local-only execution, production mode, exact database fingerprint, and exact data-state checks. This is protected pre-existing untracked user work. | Manual, manifest-scoped operation; no retention delay; not scheduled. | Calls `tx.user.deleteMany` inside a serializable transaction and is intentionally production-capable. | Execution filter requires `role: "USER"`; current guards protect admins. Approved targets can include partner/transaction/payout relationships and are explicitly cleaned in the manifest transaction. | Has counts-oriented dry-run with a read-only database session. A successful execution replay fails strict manifest/data postconditions rather than silently deleting a wider set; it is replay-safe but not a conventional idempotent no-op. |

### Scheduling conclusion

An automatic/background purge implementation exists in source, so `AUTOMATIC PURGE EXISTS` is **YES** in that limited sense. It is **not currently scheduled** by the checked repository configuration. `vercel.json` schedules `/api/cron/background-worker`, but that route calls only expired-session/token cleanup and analytics updates. An external scheduler outside this repository was not inspected and cannot be ruled out.

### Purge-selector divergence

The two production paths do not select the same users:

- Trash purge: `deletedAt <= now - retentionDays`.
- Recovery job: banned, marker-prefixed `banReason`, and `updatedAt <= now - 30 days`.

This difference makes eligibility and operator expectations inconsistent. It must be preserved only until containment is approved; it should not be treated as a reliable retention policy.

## 4. Complete direct `User` relation inventory and FK matrix

Classification legend:

- **A** — financial/audit-critical
- **B** — legal/retention-critical
- **C** — authentication/security evidence
- **D** — exam/history/analytics
- **E** — social/content
- **F** — ephemeral/reconstructable

All 32 relations below are required. Current Prisma action is `Cascade`, and the baseline migration database action is `ON DELETE CASCADE`; there is no source/migration difference for any row.

| # | Child model | Relation field | Foreign-key field | Class | Prisma `onDelete` | Migration FK action |
|---|---|---|---|---|---|---|
| 1 | `StudyTogetherProfile` | `user` | `userId` | E | Cascade | Cascade |
| 2 | `ClassmateRelation` | `sender` | `senderId` | E | Cascade | Cascade |
| 3 | `ClassmateRelation` | `receiver` | `receiverId` | E | Cascade | Cascade |
| 4 | `DirectMessageParticipant` | `user` | `userId` | E | Cascade | Cascade |
| 5 | `DirectMessage` | `sender` | `senderId` | E | Cascade | Cascade |
| 6 | `StudyRoom` | `host` | `hostId` | E | Cascade | Cascade |
| 7 | `StudyRoomParticipant` | `user` | `userId` | E | Cascade | Cascade |
| 8 | `StudyRoomMessage` | `sender` | `senderId` | E | Cascade | Cascade |
| 9 | `StudyEvent` | `host` | `hostId` | E | Cascade | Cascade |
| 10 | `StudyEventRSVP` | `user` | `userId` | E | Cascade | Cascade |
| 11 | `StudyClub` | `owner` | `ownerId` | E | Cascade | Cascade |
| 12 | `StudyClubMember` | `user` | `userId` | E | Cascade | Cascade |
| 13 | `ExamResult` | `user` | `userId` | D | Cascade | Cascade |
| 14 | `DailyQuestionAttempt` | `user` | `userId` | D | Cascade | Cascade |
| 15 | `QuestionFlag` | `user` | `userId` | C | Cascade | Cascade |
| 16 | `UserBadge` | `user` | `userId` | D | Cascade | Cascade |
| 17 | `UserMistake` | `user` | `userId` | D | Cascade | Cascade |
| 18 | `UserStreak` | `user` | `userId` | D | Cascade | Cascade |
| 19 | `Bookmark` | `user` | `userId` | F | Cascade | Cascade |
| 20 | `ExamDraft` | `user` | `userId` | F | Cascade | Cascade |
| 21 | `Transaction` | `user` | `userId` | A/B | Cascade | Cascade |
| 22 | `StudyPost` | `author` | `authorId` | E | Cascade | Cascade |
| 23 | `StudyPostComment` | `author` | `authorId` | E | Cascade | Cascade |
| 24 | `StudyPostReaction` | `user` | `userId` | E | Cascade | Cascade |
| 25 | `ReferralCode` | `user` | `userId` | A | Cascade | Cascade |
| 26 | `ReferralAttribution` | `referredUser` | `referredUserId` | A | Cascade | Cascade |
| 27 | `ReferralAttribution` | `inviter` | `inviterId` | A | Cascade | Cascade |
| 28 | `Referral` | `inviter` | `inviterId` | A/B | Cascade | Cascade |
| 29 | `Referral` | `referredUser` | `referredUserId` | A/B | Cascade | Cascade |
| 30 | `ReferralReward` | `inviter` | `inviterId` | A/B | Cascade | Cascade |
| 31 | `ReferralReward` | `referredUser` | `referredUserId` | A/B | Cascade | Cascade |
| 32 | `ReferralPayout` | `user` | `userId` | A/B | Cascade | Cascade |

Counts used in the closure summary:

- Direct cascade relation edges at risk: **32**.
- Direct financial/audit-critical relation edges (A or A/B): **9**, across six child models.

## 5. Financial, audit, and logical-reference review

### Direct and transitive deletion effects

| Record type | Current effect of deleting a related `User` | Integrity impact |
|---|---|---|
| `Transaction` | Directly cascade-deleted. | Payment history, receipt linkage, entitlement purchase evidence, and authoritative internal transaction state are destroyed. |
| `ReferralCode` | Directly cascade-deleted. | Attribution source can disappear; its current child FKs also cascade. |
| `ReferralAttribution` | Directly cascade-deleted through either user role, and can also cascade from `ReferralCode`. | Locked attribution and fraud/risk context are destroyed. |
| `Referral` | Directly cascade-deleted through inviter or referred user, and can also cascade from `ReferralCode`. | Qualification, payment reference, reward rate, amount, risk, and holding-state evidence are destroyed. |
| `ReferralReward` | Directly cascade-deleted through either user role; also cascades from `Referral` or `Transaction`. | Immutable reward calculation and reversal state are destroyed. |
| `ReferralPayout` | Directly cascade-deleted. | Payout request, encrypted destination, processing state, and transfer reference are destroyed. |
| `PartnerCommission` | Indirectly cascade-deleted when the user's `Transaction` is deleted. | Partner earning, effective rate, holding/reversal state, and campaign attribution are destroyed. |
| `FinancialLedgerEntry` | Survives transaction deletion because `transactionId` is set null. Its `sourceEntity`/`sourceId` scalar pair is unchanged. | Ledger amount may survive, but transaction/source trace can become unresolvable, weakening balance explanation and reconciliation. |
| `TaxRecord` | Survives transaction deletion because `transactionId` is set null. `referralPayoutId` is a non-FK scalar. | Tax evidence can lose its purchase or payout trace. |
| `ReconciliationRecord` | No FK; row survives. | `sourceId` and/or `matchedTransactionId` can point to a deleted transaction or deleted reward/commission/payout record. |
| `RefundOperation` | No FK; row survives. | Durable refund lifecycle can point to a missing transaction and/or deleted actor. See section 6. |
| `FinancialIdempotencyKey` | No FK; row survives. | User actor IDs can dangle; `resourceId` can point to a surviving refund operation or a deleted payout/reward/resource, depending on operation type. The actor domain is polymorphic (`User`, `Partner`, or system-style identity), so a simple `User` FK is not currently valid for all rows. |
| `ReferralAuditLog`, `AccountingAuditLog`, `BackupAuditLog` | No `User` FK; rows survive. | Actor and target identifiers can dangle. Some logs retain role/state snapshots, but identity resolution and target traceability can be lost. |
| `PartnerAttribution` | `referredUserId` is indexed but has no `User` relation/FK; row survives. | Partner attribution becomes a durable orphan after user deletion. |
| `Partner`, `PartnerRateHistory`, `PartnerPayout`, `PartnerPayoutProfile` | Not directly related to `User`; rows survive. | User-like fields such as `createdBy`, `updatedBy`, or `processedBy` are non-FK scalars and can dangle. Partner commission can still be lost through the transaction cascade. |
| Institutional vouchers | Voucher batch/code rows survive. | `InstitutionalVoucherCode.redeemedBy` and batch `createdBy` are non-FK user identifiers and can dangle, damaging entitlement provenance. |
| Adjustments, deductions, periods, settings, applications | Rows survive. | `createdBy`, `approvedBy`, `closedBy`, `updatedBy`, and `reviewedBy` identifiers can dangle, weakening accounting authorization evidence. |
| Notifications, activity/login history, support tickets | Rows survive because `userId` is not a FK. | Security/support history remains but can no longer resolve to a user; some rows also contain independent identity snapshots that require separate retention/privacy handling. |
| Exam/history records | Directly cascade-deleted. `ExamCategoryResult` then cascades from `ExamResult`. | Historical performance and analytics are lost. |
| Social/content records | Directly cascade-deleted through author/host/member relations, with further child cascades for posts, comments, rooms, clubs, and events. | Content and conversation topology can disappear beyond the single user row. |

No durable webhook-event Prisma model was found. PayMongo webhook handling resolves and updates internal transaction/refund state, so deleting `Transaction` removes the main internal lookup target even though the external provider may retain its own record.

### Ledger, refund, payout, and tax conclusions

- Ledger balance rows are not necessarily deleted, but their transaction/source trace can be broken. A numerically balanced ledger is not sufficient if the source evidence is gone.
- Refund traceability is directly at risk because current refund preparation requires the transaction, while durable operations have no FK protection.
- Referral payout records are directly deleted; partner commission records are indirectly deleted. Partner payout rows survive but operator attribution can dangle.
- Tax and reconciliation rows can survive in a logically orphaned state.
- Payment identifiers and receipts stored only on `Transaction` disappear with the cascade.

## 6. `RefundOperation` durable orphan risk

`RefundOperation.transactionId` and `RefundOperation.actorId` are required scalar strings in Prisma, but neither is declared as a relation. Migration `20260825205842_add_refund_operation` creates the table and indexes only; it creates no foreign key to `Transaction` or `User`.

Current sequence when a purged user owns a transaction:

1. `User` deletion cascades to `Transaction`.
2. `Transaction` deletion cascades to any `ReferralReward` and `PartnerCommission`.
3. `RefundOperation` survives because the database does not know its `transactionId` or `actorId` are references.
4. A later fresh refund preflight queries `Transaction` and cannot reconstruct the authoritative purchase from the missing row.
5. An existing refund-operation replay may still locate the operation through `FinancialIdempotencyKey`, but the actor may no longer authenticate/resolve and the transaction/payment accounting trace is incomplete.

Therefore the current design can produce durable `RefundOperation` rows referencing a no-longer-existing transaction or actor.

**REFUNDOPERATION ORPHAN RISK: YES.**

## 7. Source schema versus migration state

- `prisma/schema.prisma`: 32 direct `User` FK relations; all required; all `onDelete: Cascade`.
- `0_existing_production_baseline/migration.sql`: the same 32 FK constraints; all `ON DELETE CASCADE ON UPDATE CASCADE`.
- Later migrations do not alter those FKs.
- `FinancialIdempotencyKey` and `RefundOperation` source models match their additive migration table/index definitions and intentionally/currently have no foreign keys.
- Transaction downstream actions also match: `ReferralReward.transaction` and `PartnerCommission.transaction` are Cascade; `FinancialLedgerEntry.transaction` and `TaxRecord.transaction` are SetNull.

**Source/migration drift found for the reviewed relations: NO.** This is source-only verification. The actual deployed production constraint catalog was not queried, so production drift remains **NOT VERIFIED**.

## 8. Retention/privacy architecture options

| Option | Financial integrity and auditability | Privacy impact | Migration / application complexity and rollback | Authentication and user-facing deletion | Trash/purge and historical content |
|---|---|---|---|---|---|
| **A. Hard delete `User`; SetNull protected children** | Better than cascade for surviving rows, but financial records lose a stable actor unless a separate immutable snapshot exists. Nullable transaction ownership and actor links weaken refund, payout, tax, and audit trace. | Strong direct identity removal, but every retained child must be reviewed for embedded PII. | High: required FKs become nullable, application queries/types must handle null, and historical rows need policy/backfill. Rolling back nullability after new nulls exist is risky. | Login ends because the account disappears. A future Delete Account can hard-delete, but session invalidation still needs explicit handling. | Admin purge remains destructive. Exam/social records could be deleted or retained with null authors, producing broad UI changes. |
| **B. Block hard delete with Restrict; anonymize `User`** | Strong for users with protected children; stable IDs remain. If users without protected children can still be hard-deleted, lifecycle behavior is mixed. | Good if anonymization is complete, irreversible, and independently handles PII in child content. | Medium: FK actions plus an anonymization service and route/query changes. Rollback of anonymization is intentionally impossible; code rollback is manageable. | Disable login, clear auth tokens/session state, set an unusable password hash, and anonymize identity. Delete Account becomes anonymization where restrictions apply. | Purge must branch between anonymize and hard delete, increasing policy complexity. Historical records can remain pseudonymous. |
| **C. Retain a permanent tombstone `User`; anonymize PII** | Strongest near-term fit: stable `User.id` preserves all current required relations, refund/payout/ledger ownership, and audit attribution. Add Restrict on protected paths as defense in depth. | Good if all direct and embedded PII is inventoried, erased or lawfully retained, and the tombstone contains no reusable identity. Data-retention counsel is still required. | Medium: additive lifecycle metadata, FK-action hardening, and one transactional/idempotent anonymization workflow. Existing rows are compatible. Rollback cannot restore erased PII, by design. | Account is irreversibly disabled; login/email verification/password reset/session tokens are cleared. A future Delete Account means “close and anonymize,” not physical row deletion. ADMIN accounts must be rejected from this flow. | Replace User purge with anonymization; retain non-User cleanup. Exam/social policy can preserve pseudonymous history or separately erase content without deleting the financial actor. |
| **D. Split identity/PII from a permanent financial actor** | Best structural separation: financial/audit records reference an immutable non-PII actor while identity can be deleted. | Potentially strongest and clearest retention boundary. | Very high: new models, dual identifiers, broad FK/query/API changes, backfill of every actor relation, staged rollout, and difficult rollback. | Identity deletion can be clean while financial actor persists. Auth must be fully decoupled. | Trash/account deletion targets identity only; exams/social need separate ownership strategy. This is a future architecture, not the smallest P0 remediation. |

### Recommended long-term architecture

**OPTION C: retain a permanent tombstone `User` and irreversibly anonymize PII, with `RESTRICT` protection on financial/audit relations.**

This preserves current required relation shapes and stable actor IDs while eliminating the dangerous need to physically delete `User`. The anonymization workflow should be one database transaction, idempotent, refuse `ADMIN` targets, clear authentication/recovery/session material, replace unique email with a non-routable value derived from an irreversible server-side process, store an unusable randomized password hash, and never log old or replacement identity values. Exact privacy fields and retention periods require policy/legal approval.

The repository has no current user-facing Delete Account API. A future implementation should expose account closure/anonymization, not call Prisma `User.delete`.

## 9. Immediate source-only containment recommendation

**IMMEDIATE SOURCE-ONLY CONTAINMENT POSSIBLE: YES.**

Smallest safe containment, before any schema migration:

1. Make physical `User` deletion fail closed inside both production purge implementations, so future callers cannot bypass a route-only guard.
2. In `src/lib/recovery/softDelete.ts`, preserve question, flashcard, and system-setting cleanup, but report User purge as disabled with zero mutations.
3. In `src/jobs/purgeExpiredRecords.ts` and its admin DELETE route, return an explicit disabled/not-implemented result before candidate IDs are selected or logged and before any `User` mutation.
4. Preserve current soft-delete and restore behavior until the anonymization design is approved.
5. Do not allow `ADMIN` physical deletion under any path.
6. Keep the manifest-locked production test-data cleanup as a separately authorized operator tool; do not treat it as the ordinary retention purge. The unguarded V3 partner test script should be quarantined behind the existing disposable-database style of guard in a separately approved script-safety task.

Recommended concise containment: **disable both application-level physical User purge helpers; retain soft delete/restore and safe non-User cleanup.**

No containment was implemented in this discovery task.

## 10. Proposed long-term migration design

This is conceptual only. No migration file was created.

### Rollout order

1. Deploy source-only fail-closed containment.
2. Run the separately approved counts-only production precheck in section 11.
3. Resolve any existing logical orphans before adding constraints.
4. Add lifecycle/anonymization metadata if approved (for example, an explicit irreversible anonymization timestamp/version) without altering existing identity values during the migration.
5. Change/add financial integrity constraints in a reviewed migration, using low-lock PostgreSQL techniques where supported and verifying constraints before enabling anonymization.
6. Deploy the transactional anonymization service and replace purge UI/API semantics.
7. Run the disposable-database matrix before production enablement.

### Existing direct `User` financial FKs

Each row below currently has a required column, so changing Cascade to Restrict requires no data-value backfill. Application changes are required because hard delete will fail.

| Current | Proposed | Why | Data backfill | App change | Production precheck |
|---|---|---|---|---|---|
| `Transaction.user` / Cascade | Restrict | Preserve payment, entitlement, refund, ledger, and receipt evidence. | No | Yes | Yes |
| `ReferralCode.user` / Cascade | Restrict | Prevent deletion of attribution roots. | No | Yes | Yes |
| `ReferralAttribution.referredUser` / Cascade | Restrict | Preserve locked attribution and risk evidence. | No | Yes | Yes |
| `ReferralAttribution.inviter` / Cascade | Restrict | Preserve inviter attribution. | No | Yes | Yes |
| `Referral.inviter` / Cascade | Restrict | Preserve qualification and reward history. | No | Yes | Yes |
| `Referral.referredUser` / Cascade | Restrict | Preserve qualification and payment provenance. | No | Yes | Yes |
| `ReferralReward.inviter` / Cascade | Restrict | Preserve immutable reward ledger ownership. | No | Yes | Yes |
| `ReferralReward.referredUser` / Cascade | Restrict | Preserve reward provenance. | No | Yes | Yes |
| `ReferralPayout.user` / Cascade | Restrict | Preserve payout request and settlement evidence. | No | Yes | Yes |

The remaining 23 direct User cascades are non-financial. Under the recommended tombstone architecture they are never reached by ordinary account closure. Their final Restrict/Cascade/content-erasure policy must be decided explicitly by category; they must not be changed opportunistically in the P0 financial migration.

### Transitive financial FKs

| Current | Proposed | Why | Data backfill | App change | Production precheck |
|---|---|---|---|---|---|
| `ReferralAttribution.referralCode` / Cascade | Restrict | Prevent referral-code deletion from erasing locked attribution. | No | Yes | Yes |
| `Referral.referralCode` / Cascade | Restrict | Preserve referral qualification history. | No | Yes | Yes |
| `ReferralReward.referral` / Cascade | Restrict | Preserve the financial reward ledger if a referral is targeted. | No | Yes | Yes |
| `ReferralReward.transaction` / Cascade | Restrict | Prevent transaction deletion from erasing reward evidence. | No | Yes | Yes |
| `PartnerCommission.transaction` / Cascade | Restrict | Prevent transaction deletion from erasing partner earnings. | No | Yes | Yes |
| `FinancialLedgerEntry.transaction` / SetNull | Restrict while keeping the column optional | A ledger entry may legitimately lack a transaction, but a linked transaction must not be deleted and silently detached. | No | Yes | Yes |
| `TaxRecord.transaction` / SetNull | Restrict while keeping the column optional | Preserve purchase-to-tax trace for rows that have a transaction. | No | Yes | Yes |

Partner-to-commission/payout/profile/rate-history FKs also use Cascade. They are not reached by deleting `User` except for commission through `Transaction`; hardening Partner deletion is an adjacent financial-retention task and is not silently included in this P0-002 design.

### Missing high-value FKs

| Current | Proposed | Why | Data backfill | App change | Production precheck |
|---|---|---|---|---|---|
| `RefundOperation.transactionId` / no FK | Required relation to `Transaction`, Restrict | Prevent durable refund operations from referencing deleted transactions. | No if all values resolve; otherwise manual orphan remediation is required | Yes | Yes |
| `RefundOperation.actorId` / no FK | Required relation to `User`, Restrict | Refund execution currently requires an authenticated admin actor; preserve that actor tombstone. | No if all values resolve; otherwise manual orphan remediation is required | Yes | Yes |
| `PartnerAttribution.referredUserId` / no FK | Required relation to `User`, Restrict | Preserve user-to-partner attribution and block orphaning. | No if all values resolve; otherwise manual reconciliation is required | Yes | Yes |
| `InstitutionalVoucherCode.redeemedBy` / no FK | Optional relation to `User`, Restrict when non-null | Preserve entitlement redemption provenance. | No if all non-null values resolve; otherwise manual reconciliation is required | Yes | Yes |

`FinancialIdempotencyKey.actorId` and several audit actor fields are polymorphic or allow system identities. They must not be attached blindly to `User`. The tombstone keeps real User actor IDs resolvable; a future typed-actor or permanent `FinancialActor` design is required if database enforcement is desired.

### Rollback position

- Constraint-action rollback is technically possible before new behavior depends on it, but rolling back to Cascade would restore the original catastrophic risk and should not be the operational rollback.
- Safe rollback is to keep User purge disabled while application/schema issues are corrected.
- Anonymized PII must not be recoverable from application logs or a rollback table. Operational backup retention is a separate legal/security decision.

## 11. Proposed aggregate-only production precheck — do not run in this task

The following design is counts-only. It returns metric names and integer counts, never IDs, emails, account numbers, payment identifiers, ciphertext, or plaintext. It uses an explicit repeatable-read, read-only transaction and rolls back. It must receive separate human approval, be run by a least-privileged production read-only role, and have terminal/query logging reviewed before use.

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '90s';

WITH
cutoff AS (
  SELECT CURRENT_TIMESTAMP - INTERVAL '30 days' AS cutoff_at
),
eligible_users AS (
  SELECT u.id
  FROM "User" u
  CROSS JOIN cutoff c
  WHERE u."deletedAt" <= c.cutoff_at
     OR (
       u."isBanned" = TRUE
       AND u."banReason" LIKE '[SOFT_DELETED]%'
       AND u."updatedAt" <= c.cutoff_at
     )
),
affected_transactions AS (
  SELECT t.id, t."userId"
  FROM "Transaction" t
  WHERE t."userId" IN (SELECT id FROM eligible_users)
),
affected_referral_codes AS (
  SELECT r.id
  FROM "ReferralCode" r
  WHERE r."userId" IN (SELECT id FROM eligible_users)
),
affected_referrals AS (
  SELECT DISTINCT r.id
  FROM "Referral" r
  WHERE r."inviterId" IN (SELECT id FROM eligible_users)
     OR r."referredUserId" IN (SELECT id FROM eligible_users)
     OR r."referralCodeId" IN (SELECT id FROM affected_referral_codes)
),
affected_referral_rewards AS (
  SELECT DISTINCT r.id
  FROM "ReferralReward" r
  WHERE r."inviterId" IN (SELECT id FROM eligible_users)
     OR r."referredUserId" IN (SELECT id FROM eligible_users)
     OR r."transactionId" IN (SELECT id FROM affected_transactions)
     OR r."referralId" IN (SELECT id FROM affected_referrals)
),
affected_referral_payouts AS (
  SELECT p.id
  FROM "ReferralPayout" p
  WHERE p."userId" IN (SELECT id FROM eligible_users)
),
affected_partner_commissions AS (
  SELECT p.id
  FROM "PartnerCommission" p
  WHERE p."transactionId" IN (SELECT id FROM affected_transactions)
),
affected_refund_operations AS (
  SELECT r.id
  FROM "RefundOperation" r
  WHERE r."transactionId" IN (SELECT id FROM affected_transactions)
     OR r."actorId" IN (SELECT id FROM eligible_users)
),
affected_ledger_entries AS (
  SELECT DISTINCT l.id
  FROM "FinancialLedgerEntry" l
  WHERE l."transactionId" IN (SELECT id FROM affected_transactions)
     OR (l."sourceEntity" = 'Transaction' AND l."sourceId" IN (SELECT id FROM affected_transactions))
     OR (l."sourceEntity" = 'ReferralReward' AND l."sourceId" IN (SELECT id FROM affected_referral_rewards))
     OR (l."sourceEntity" = 'PartnerCommission' AND l."sourceId" IN (SELECT id FROM affected_partner_commissions))
     OR (l."sourceEntity" = 'ReferralPayout' AND l."sourceId" IN (SELECT id FROM affected_referral_payouts))
),
affected_tax_records AS (
  SELECT DISTINCT t.id
  FROM "TaxRecord" t
  WHERE t."transactionId" IN (SELECT id FROM affected_transactions)
     OR t."referralPayoutId" IN (SELECT id FROM affected_referral_payouts)
),
affected_reconciliations AS (
  SELECT DISTINCT r.id
  FROM "ReconciliationRecord" r
  WHERE r."matchedTransactionId" IN (SELECT id FROM affected_transactions)
     OR (r."sourceType" = 'INTERNAL_TRANSACTION' AND r."sourceId" IN (SELECT id FROM affected_transactions))
),
metrics AS (
  SELECT 'eligible_users_total' AS metric, COUNT(*)::bigint AS count_value FROM eligible_users
  UNION ALL SELECT 'eligible_admin_users', COUNT(*)::bigint FROM "User" WHERE id IN (SELECT id FROM eligible_users) AND role = 'ADMIN'
  UNION ALL SELECT 'eligible_users_with_transactions', COUNT(*)::bigint FROM eligible_users e WHERE EXISTS (SELECT 1 FROM "Transaction" t WHERE t."userId" = e.id)
  UNION ALL SELECT 'eligible_users_with_referrals', COUNT(*)::bigint FROM eligible_users e WHERE EXISTS (SELECT 1 FROM "Referral" r WHERE r."inviterId" = e.id OR r."referredUserId" = e.id)
  UNION ALL SELECT 'eligible_users_with_referral_rewards', COUNT(*)::bigint FROM eligible_users e WHERE EXISTS (SELECT 1 FROM "ReferralReward" r WHERE r."inviterId" = e.id OR r."referredUserId" = e.id)
  UNION ALL SELECT 'eligible_users_with_partner_relationships', COUNT(*)::bigint FROM eligible_users e WHERE EXISTS (SELECT 1 FROM "PartnerAttribution" p WHERE p."referredUserId" = e.id) OR EXISTS (SELECT 1 FROM "Transaction" t JOIN "PartnerCommission" p ON p."transactionId" = t.id WHERE t."userId" = e.id)
  UNION ALL SELECT 'eligible_users_with_payout_relationships', COUNT(*)::bigint FROM eligible_users e WHERE EXISTS (SELECT 1 FROM "ReferralPayout" p WHERE p."userId" = e.id) OR EXISTS (SELECT 1 FROM "PartnerPayout" p WHERE p."processedBy" = e.id)
  UNION ALL SELECT 'eligible_users_with_refund_operations', COUNT(*)::bigint FROM eligible_users e WHERE EXISTS (SELECT 1 FROM "RefundOperation" r WHERE r."actorId" = e.id OR r."transactionId" IN (SELECT id FROM affected_transactions WHERE "userId" = e.id))

  UNION ALL SELECT 'direct_StudyTogetherProfile_user', COUNT(*)::bigint FROM "StudyTogetherProfile" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_ClassmateRelation_sender', COUNT(*)::bigint FROM "ClassmateRelation" WHERE "senderId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_ClassmateRelation_receiver', COUNT(*)::bigint FROM "ClassmateRelation" WHERE "receiverId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_DirectMessageParticipant_user', COUNT(*)::bigint FROM "DirectMessageParticipant" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_DirectMessage_sender', COUNT(*)::bigint FROM "DirectMessage" WHERE "senderId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_StudyRoom_host', COUNT(*)::bigint FROM "StudyRoom" WHERE "hostId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_StudyRoomParticipant_user', COUNT(*)::bigint FROM "StudyRoomParticipant" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_StudyRoomMessage_sender', COUNT(*)::bigint FROM "StudyRoomMessage" WHERE "senderId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_StudyEvent_host', COUNT(*)::bigint FROM "StudyEvent" WHERE "hostId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_StudyEventRSVP_user', COUNT(*)::bigint FROM "StudyEventRSVP" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_StudyClub_owner', COUNT(*)::bigint FROM "StudyClub" WHERE "ownerId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_StudyClubMember_user', COUNT(*)::bigint FROM "StudyClubMember" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_ExamResult_user', COUNT(*)::bigint FROM "ExamResult" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_DailyQuestionAttempt_user', COUNT(*)::bigint FROM "DailyQuestionAttempt" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_QuestionFlag_user', COUNT(*)::bigint FROM "QuestionFlag" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_UserBadge_user', COUNT(*)::bigint FROM "UserBadge" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_UserMistake_user', COUNT(*)::bigint FROM "UserMistake" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_UserStreak_user', COUNT(*)::bigint FROM "UserStreak" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_Bookmark_user', COUNT(*)::bigint FROM "Bookmark" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_ExamDraft_user', COUNT(*)::bigint FROM "ExamDraft" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_Transaction_user', COUNT(*)::bigint FROM affected_transactions
  UNION ALL SELECT 'direct_StudyPost_author', COUNT(*)::bigint FROM "StudyPost" WHERE "authorId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_StudyPostComment_author', COUNT(*)::bigint FROM "StudyPostComment" WHERE "authorId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_StudyPostReaction_user', COUNT(*)::bigint FROM "StudyPostReaction" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_ReferralCode_user', COUNT(*)::bigint FROM affected_referral_codes
  UNION ALL SELECT 'direct_ReferralAttribution_referredUser', COUNT(*)::bigint FROM "ReferralAttribution" WHERE "referredUserId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_ReferralAttribution_inviter', COUNT(*)::bigint FROM "ReferralAttribution" WHERE "inviterId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_Referral_inviter', COUNT(*)::bigint FROM "Referral" WHERE "inviterId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_Referral_referredUser', COUNT(*)::bigint FROM "Referral" WHERE "referredUserId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_ReferralReward_inviter', COUNT(*)::bigint FROM "ReferralReward" WHERE "inviterId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_ReferralReward_referredUser', COUNT(*)::bigint FROM "ReferralReward" WHERE "referredUserId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'direct_ReferralPayout_user', COUNT(*)::bigint FROM affected_referral_payouts

  UNION ALL SELECT 'affected_referrals_unique', COUNT(*)::bigint FROM affected_referrals
  UNION ALL SELECT 'affected_referral_rewards_unique', COUNT(*)::bigint FROM affected_referral_rewards
  UNION ALL SELECT 'affected_partner_commissions_unique', COUNT(*)::bigint FROM affected_partner_commissions
  UNION ALL SELECT 'affected_refund_operations_unique', COUNT(*)::bigint FROM affected_refund_operations
  UNION ALL SELECT 'affected_ledger_entries_unique', COUNT(*)::bigint FROM affected_ledger_entries
  UNION ALL SELECT 'affected_tax_records_unique', COUNT(*)::bigint FROM affected_tax_records
  UNION ALL SELECT 'affected_reconciliations_unique', COUNT(*)::bigint FROM affected_reconciliations
  UNION ALL SELECT 'logical_PartnerAttribution_referredUser', COUNT(*)::bigint FROM "PartnerAttribution" WHERE "referredUserId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'logical_RefundOperation_actor', COUNT(*)::bigint FROM "RefundOperation" WHERE "actorId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'logical_FinancialIdempotencyKey_actor', COUNT(*)::bigint FROM "FinancialIdempotencyKey" WHERE "actorId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'logical_InstitutionalVoucherCode_redeemedBy', COUNT(*)::bigint FROM "InstitutionalVoucherCode" WHERE "redeemedBy" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'logical_ReferralAuditLog_actor', COUNT(*)::bigint FROM "ReferralAuditLog" WHERE "actorId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'logical_AccountingAuditLog_actor', COUNT(*)::bigint FROM "AccountingAuditLog" WHERE "actorId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'logical_BackupAuditLog_actor', COUNT(*)::bigint FROM "BackupAuditLog" WHERE "actorId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'logical_Notification_user', COUNT(*)::bigint FROM "Notification" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'logical_ActivityLog_user', COUNT(*)::bigint FROM "ActivityLog" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'logical_LoginHistory_user', COUNT(*)::bigint FROM "LoginHistory" WHERE "userId" IN (SELECT id FROM eligible_users)
  UNION ALL SELECT 'logical_SupportTicket_user', COUNT(*)::bigint FROM "SupportTicket" WHERE "userId" IN (SELECT id FROM eligible_users)

  UNION ALL SELECT 'preexisting_orphan_RefundOperation_transaction', COUNT(*)::bigint FROM "RefundOperation" r LEFT JOIN "Transaction" t ON t.id = r."transactionId" WHERE t.id IS NULL
  UNION ALL SELECT 'preexisting_orphan_RefundOperation_actor', COUNT(*)::bigint FROM "RefundOperation" r LEFT JOIN "User" u ON u.id = r."actorId" WHERE u.id IS NULL
  UNION ALL SELECT 'preexisting_orphan_PartnerAttribution_user', COUNT(*)::bigint FROM "PartnerAttribution" p LEFT JOIN "User" u ON u.id = p."referredUserId" WHERE u.id IS NULL
  UNION ALL SELECT 'preexisting_orphan_VoucherCode_user', COUNT(*)::bigint FROM "InstitutionalVoucherCode" v LEFT JOIN "User" u ON u.id = v."redeemedBy" WHERE v."redeemedBy" IS NOT NULL AND u.id IS NULL
)
SELECT metric, count_value
FROM metrics
ORDER BY metric;

ROLLBACK;
```

This query inventories both current purge predicates as a union. Before approval, a database expert should validate it against a disposable clone of the exact production schema and confirm statement/runtime limits are appropriate. It must not be adapted to select raw rows during the production run.

## 12. Disposable-database test plan

Use a new, isolated PostgreSQL database with the exact migration chain, synthetic data only, external payment/email transports disabled or mocked, an explicit disposable-target guard, and teardown after evidence capture.

| Case | Synthetic setup / action | Required remediated result |
|---|---|---|
| Soft deletion | Active `USER`; request account closure/soft delete. | No physical delete. Login/recovery tokens are disabled, tombstone state is recorded, and unrelated rows are unchanged. |
| Purge eligibility | Users matching each current predicate independently and both together. | User hard purge remains disabled regardless of predicate; counts are deterministic and no IDs/PII are logged. |
| User with no related records | Attempt direct route/helper hard purge. | Fail closed; tombstone/anonymize if approved, never physical delete through ordinary workflow. |
| User with `Transaction` | Add transaction, balanced ledger, tax and reconciliation rows; attempt hard delete. | Database Restrict rejects deletion; all rows and links remain. Anonymization preserves `User.id`. |
| User with `ReferralReward` | Exercise inviter and referred-user roles, linked referral/code/transaction. | Hard delete rejected; referral and immutable reward evidence remain byte-for-byte except approved PII anonymization outside financial fields. |
| User with partner/commission/payout records | Add partner attribution, transaction commission, referral payout, and partner payout actor references. | Hard delete rejected; commission/payout/attribution and operator trace remain resolvable. |
| User with `RefundOperation` | Add transaction, operation, and financial idempotency row; attempt owner and actor deletion. | Both transaction and actor deletion are rejected; operation replay/history remains resolvable. |
| Admin user | Mark admin as purge-eligible and invoke every application purge entry. | Refused before mutation. No anonymization or deletion via normal user lifecycle. |
| Already anonymized user | Repeat the same anonymization request. | Idempotent no-op/replay; no new alias, password, audit event duplication, or relation change. |
| Concurrent purge/anonymization | Two simultaneous requests for one user and overlapping batch invocations. | One serialized transition; others return deterministic replay/conflict. No partial deletion and no double side effects. |
| Retention boundary | Timestamps one millisecond before, exactly at, and one millisecond after cutoff for both legacy predicates. | Eligibility definition is explicit and stable; hard deletion remains disabled. |
| Anonymization repeatability | Retry after injected failure before and after transaction commit. | Rollback leaves original state before commit; committed retry is idempotent. No mixed PII/tombstone state. |
| Ledger preservation | Capture debit/credit totals and source resolution before/after anonymization. | Totals and every financial source link are unchanged and resolvable. |
| Refund preservation | Capture operation state, idempotency mapping, transaction link, and policy lookup before/after. | All remain resolvable; no new provider call occurs during anonymization. |
| Payout preservation | Capture referral/partner payout state, reward/commission balances, and audit trail before/after. | Amounts, statuses, links, and traceability remain unchanged. |
| Historical exams/social content | Add representative exam, room, club, message, post, comment, and reaction data. | Result follows the approved privacy policy: retained rows resolve to the tombstone, or separately approved content erasure occurs without touching financial rows. |
| Non-User cleanup | Add expired question/flashcard/system-setting rows plus an eligible User. | Non-User cleanup proceeds only as approved; User mutation remains zero. |
| Constraint/orphan preflight | Insert or simulate logical orphan candidates before applying new FKs. | Migration validation fails closed until orphans are reconciled; it never deletes them automatically. |

For every case, assert record counts, FK resolution, ledger debit/credit equality, no unexpected provider calls, no PII in logs, and no writes outside the disposable database.

## 13. Risks and unknowns

- Actual production FK definitions and data were not inspected. Source/migration agreement does not prove deployed database agreement.
- An external scheduler or operator outside repository configuration could call either purge endpoint.
- The two production purge selectors disagree, and one batched implementation can skip rows within a run.
- Both production purge paths can select admins; one has an adjacent hardcoded-email authorization exception and the other relies locally on sudo-ticket validation without its own primary-session check. These are documented only and were not fixed.
- The V3 partner portal test can target the configured database without a disposable-target guard. This is documented only.
- The protected untracked production cleanup executor is intentionally capable of production deletion under strong manifest guards; its approved target policy was not changed.
- `FinancialIdempotencyKey` and audit actor fields are polymorphic/unconstrained. A direct User FK cannot be added without distinguishing user, partner, and system actors.
- Privacy/legal retention requirements for exams, social content, logs, support history, backups, payout identity, and tax evidence need explicit human/legal policy. This report does not assert a statutory retention period.
- A tombstone must not retain reversible PII in aliases, logs, metadata, backups, or child rows. The full PII inventory is a prerequisite to implementation.
- Current source contains no user-facing account-deletion route, so product/API semantics and user messaging remain to be designed.
- Migration lock time and validation cost depend on production table sizes and require counts/planner review before rollout.
- Backups can retain historical PII and must follow a separately approved expiry/access policy; this task did not modify backup behavior.
- Partner deletion has its own Cascade graph into commission/payout evidence. It is adjacent and not fixed in GSA-P0-002 discovery.

## 14. Explicit implementation approval gate

**IMPLEMENTATION HAS NOT STARTED.** No source, schema, migration, production query, database operation, anonymization, deletion, staging, commit, or push is authorized by this report.

Before implementation, a human must explicitly approve:

1. the immediate fail-closed containment files and externally visible API response;
2. Option C as the long-term lifecycle and the precise PII/retention policy;
3. the exact production counts-only precheck, operator, read-only role, and evidence handling;
4. each FK action/addition and the deployment/rollback sequence;
5. the disposable-database test plan and acceptance evidence;
6. separate handling of the adjacent authorization, scheduler, test-script, partner-deletion, and polymorphic-actor concerns.

Next action: human review and explicit approval before any P0-002 implementation.
