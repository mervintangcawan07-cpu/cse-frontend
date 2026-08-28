# GovStudyX Phase 0 / Task 0.2D.2 — GSA-P0-002 Narrow Implementation Plan

## 1. Baseline and scope

This is a documentation-only implementation plan. It does not authorize or perform an implementation slice.

| Item | Verified state |
|---|---|
| Repository | `C:\Users\Administrator\cse-frontend` |
| Branch | `main` |
| Baseline and current HEAD at planning time | `ac23aad11c9104cd5e57e13640146bc89d9e4f33` |
| Latest commit | `docs: approve P0-002 tombstone policy` |
| GSA-P0-001 | CLOSED |
| GSA-P0-002 | CONTAINED — NOT FULLY RESOLVED |
| P0-003 | NOT STARTED |
| P0-002 implementation | NOT STARTED |

The deployed containment remains the only production protection established by this task family: application-level physical `User` purge is disabled. The production precheck found 32 direct `User` foreign keys, all `ON DELETE CASCADE`, and point-in-time counts of zero purge-eligible users, zero inspected financial/audit exposure for eligible users, and zero checked logical-reference orphans. Those observations are not durable guarantees and must be repeated before any future production change.

This plan covers only the smallest safe path from containment to a retained terminal `User` tombstone. It does not modify source, Prisma schema, migrations, dependencies, configuration, environment variables, external providers, production services, or database state. It does not start P0-003 or resolve unrelated audit findings.

## 2. Authoritative policy inputs

The following repository documents are authoritative inputs:

- `AGENTS.md`
- `GEMINI.md`
- `docs/audit/remediation/P0-002-DISCOVERY.md`
- `docs/audit/remediation/P0-002-CONTAINMENT.md`
- `docs/audit/remediation/P0-002-PRODUCTION-PRECHECK.md`
- `docs/audit/remediation/P0-002-TOMBSTONE-DESIGN.md`
- `docs/audit/remediation/P0-002-POLICY-DECISIONS.md`

Policy Version 1 is fixed. Implementation must not reinterpret it opportunistically:

- Public posts and comments remain, attributed through the retained tombstone and rendered as **Deleted User**.
- Authored direct-message and study-room-chat content is cleared while required structural rows remain.
- Individual exam history and private study state are deleted.
- The study profile/avatar, social relationships, reactions, future participation, and notifications are deleted.
- Question flags remain pseudonymously attributable to the tombstone.
- Owned rooms/events require approved transfer or closure/archive. Clubs require eligible consenting transfer or archive.
- Support copied email is replaced with the tombstone alias and retained under restricted access. Login history keeps security/time facts but removes or transforms email, IP, and user agent. Activity logs retain material action/time/tombstone identity while IP and metadata are scrubbed.
- Financial, referral, reward, payout, ledger, tax, reconciliation, refund, idempotency, and voucher history remains. Generic financial free-text redaction is prohibited.
- Terminal identity uses one persisted random alias with at least 128 bits of entropy under `.invalid`, plus a random unusable password hash. Credential-recovery state is cleared, and `activeSessionId` is rotated to a fresh high-entropy server-only revocation marker that is never issued in a JWT.
- Account closure waits 30 days. Restore is allowed only before the terminal transition and is permanently prohibited afterward.
- Normal service rejects `ADMIN`. `Partner` is a separate lifecycle and must never be processed by this service.
- Backups are not rewritten by P0-002. `User.anonymizedAt DateTime?` and `User.anonymizationVersion Int?` are the approved lifecycle fields; the first supported version is `1`.

## 3. Current implementation surface

### User and relations

`prisma/schema.prisma` currently has no terminal lifecycle fields. `User` contains identity, credentials, access state, payment-entitlement fields, `deletedAt`/`deletedBy`, and relations to exam, private study, social, referral, transaction, reward, and payout data. All 32 direct database foreign keys to `User` currently cascade on physical deletion.

The nine direct financially material `User` relations are `Transaction.userId`, `ReferralCode.userId`, `ReferralAttribution.referredUserId`, `ReferralAttribution.inviterId`, `Referral.inviterId`, `Referral.referredUserId`, `ReferralReward.inviterId`, `ReferralReward.referredUserId`, and `ReferralPayout.userId`. These are why containment must remain in place even after tombstones exist.

### Authentication and account mutation

- `src/lib/auth.ts`: `signJWT` issues signed cookie payloads; `verifyJWT` validates only cryptographic/time properties and the configured invalid-before cutoff.
- `src/lib/serverAuth.ts`: `getAuthenticatedUser`, `requireAuthUser`, `requireAdminAuth`, and `requireProAuth` fetch a user but do not currently enforce `isBanned`, `deletedAt`, a terminal marker, or strict presented-session equality.
- `src/proxy.ts`: performs cookie/JWT optimistic route checks. API routes bypass its matcher. Installed Next.js 16.3.2 guidance explicitly treats Proxy as an optimistic prefilter, not the primary authorization layer; secure checks belong close to the data/action in a centralized server data-access layer.
- `src/app/api/auth/login/route.ts` `POST`: checks password and email verification, updates `activeSessionId`/`lastActiveAt`, and issues the JWT, but does not reject banned or soft-deleted users.
- `src/app/api/auth/me/route.ts` `GET`: compares session IDs only when both values are truthy, so setting `activeSessionId` to `null` does not reliably revoke an already issued token.
- `src/app/api/auth/forgot-password/route.ts`, `reset-password/route.ts`, `verify-email/route.ts`, and `resend-verification/route.ts`: do not consistently exclude soft-deleted or terminal users.
- `src/app/api/user/profile/route.ts` `PUT`: uses cryptographic JWT verification without current database lifecycle/session validation.
- `src/app/api/auth/register/route.ts` and `signup/route.ts`: are separate registration paths with different verification/referral behavior. Both must treat the random `.invalid` alias as permanently occupied and must never reactivate a tombstone.
- `src/app/api/auth/logout/route.ts`: expires the cookie but does not update database session state.
- `src/app/api/admin/users/action/route.ts`: BAN and RESET clear session state, but UNBAN/RESET require terminal-state guards so they cannot reactivate or recredential a tombstone.
- `src/lib/auth/sudoMode.ts` `verifyAdminCredentials`: checks the admin password/role but not current account liveness. This is a P0-002-required subset of a broader authorization finding; normal `ADMIN` anonymization remains rejected.

### Recovery and restore

- `src/lib/recovery/softDelete.ts` `softDeleteRecord` marks a `User` banned, records soft-delete metadata, and clears `activeSessionId`.
- The same file's `restoreRecord` clears `isBanned`, `banReason`, `deletedAt`, and `deletedBy`, but does not enforce the 30-day window or terminal prohibition.
- `getTrashBinItems` treats all matching users as restorable and may fall back to `updatedAt`.
- `src/app/api/admin/recovery/route.ts` has a second restore implementation that clears only `isBanned` and `banReason`, uses `updatedAt` as deletion time, and leaves `deletedAt`/`deletedBy` unchanged.
- `src/app/api/admin/trash/route.ts` calls the shared restore helper.
- `src/jobs/purgeExpiredRecords.ts` and the user branch of `src/lib/recovery/softDelete.ts` fail closed for physical `User` purge. This containment must remain.
- `src/lib/db/softDelete.ts` is a metadata helper with a separate `restoreRecord` name; it must not become a third account restore authority.

### Referral codes

`src/lib/referral/codeGenerator.ts` can derive a short visible prefix from the user's name/email. `ReferralService.getOrCreateReferralCode` can create or reactivate a code; `validateReferralCode` and `recordAttributionOnSignup` consume it. The original normalized code can also be copied into `ReferralAuditLog.reason` and `ReferralAuditLog.metadata`. Signup/register cookies, `/api/referral/validate-code`, `/api/referral/me`, payment checkout, admin referral reports, searches, and analytics use the code or its record. Replacing only `ReferralCode.code` would therefore create false confidence and could impair reconciliation.

### Child, ownership, audit, and recovery behavior

The schema includes `ExamResult` with cascading `ExamCategoryResult`; private `ExamDraft`, `Bookmark`, `UserMistake`, `UserStreak`, `DailyQuestionAttempt`, and `UserBadge`; `StudyTogetherProfile`; classmate, message, room, event, club, and public-post records; `QuestionFlag`; and logical user references in `Notification`, `ActivityLog`, `LoginHistory`, and `SupportTicket`.

Room leave currently transfers host role to the earliest remaining participant or ends an empty room. Club transfer requires an existing member and is transactional. No equivalent deterministic event-host transfer operation exists. These product actions cannot be blindly invoked by the anonymization transaction because consent, eligibility, time, and race conditions must be resolved before terminal transition.

`src/lib/backup/backupRestore.ts` reports every recognized snapshot table as counted, but `applySnapshotToDatabase` only writes `pricingPlans`, `systemSettings`, and `featureFlags`; other tables are counted without restoration. Its automatic rollback uses the same partial function. Therefore it is not verified recovery for user-data migrations or anonymization.

### Existing physical-delete and migration surface

No runtime application path currently physically deletes a `User`. Direct calls remain only in protected test/cleanup scripts: `scripts/production-test-data-cleanup.ts`, `src/scripts/test-partner-portal-v3.ts`, and `src/scripts/test-partner-auth-integration.ts`. Static containment tests must continue distinguishing these guarded scripts from runtime source.

`prisma/migrations/20260825205842_add_refund_operation/migration.sql` creates `RefundOperation` and its status enum/indexes. It is intentionally unapplied in production. Prisma `migrate deploy` applies every pending migration, so a later P0-002 migration cannot be deployed safely while this history remains unresolved.

## 4. Proposed implementation slices

Each slice requires separate human approval and its own baseline/diff/validation report.

| Order | Slice | Scope | Production gate |
|---|---|---|---|
| 1 | **B1 — central account-liveness and session-enforcement foundation** | Source-only canonical live-session contract using existing fields; strict session equality; migrate the existing `serverAuth` path and primary auth/account entry points; tests. No tombstone field or anonymization. | Reversible source deployment; no DB access required. |
| 2 | A — lifecycle schema foundation | Add nullable `anonymizedAt` and `anonymizationVersion`, no backfill; generate client; validate only on disposable databases initially. | Blocked from production by refund-history reconciliation and recovery gate. |
| 3 | B2 — complete terminal-state enforcement | Add terminal checks to the canonical contract and migrate every remaining direct `verifyJWT` protected caller. Keep Proxy optimistic only. | No anonymization exposure until caller inventory is zero and replay tests pass. |
| 4 | C — restore lifecycle normalization | One restore service and one deadline source; block terminal restore; consolidate Trash/Recovery behavior. | Requires schema-compatible application and lifecycle tests. |
| 5 | D0 — preflight and disposition planning service | Counts only, ownership blockers, limits, immutable financial snapshot, no user mutation. | May be exercised with synthetic data only. |
| 6 | E1 — safe child-disposition primitives | Transaction-scoped, tested delete/clear/pseudonymize operations with no identity commit and no external effects. | Disposable database only. |
| 7 | F — referral-code tombstoning | **REQUIRES SEPARATE HUMAN CLARIFICATION BEFORE SLICE F.** The design proposed replacing the visible code, while source inspection found historical copies/dependencies; neither replacement nor retention of the original string is authorized by this plan. | Policy/design reconciliation, reconciliation analysis, and admin-reader tests required. |
| 8 | G — financial integrity guardrails | Before/after immutable snapshots and deny-list assertions around terminal service. | Zero provider calls and exact equality required. |
| 9 | E2 — ownership/structural resolution | Resolve room/event/club transfer or archive before terminal execution; remove memberships/RSVPs. | Consent and deterministic resolution required. |
| 10 | D1 — core anonymization service | Atomic, idempotent terminal transaction, initially unreachable/disabled. | Recovery gate, load bounds, and all prior slices required. |
| 11 | I — account-closure API/product surface | 30-day request/status/restore/complete flow, recent reauthentication, cookie expiration. | Feature flag off until readiness approval. |
| 12 | H — FK hardening | Separately reviewed financial/transitive/non-financial/logical FK migrations. | Later release; never bundled with initial anonymization. |

No slice may re-enable physical `User` deletion. D0/E1/G can be developed in parallel only after their shared contracts are approved, but they must integrate and validate sequentially.

## 5. Exact file/function change map

This map is anticipated future work, not authority to edit the files.

| Class | Slice | Exact file | Current function/model | Proposed future change | Risk/tests | DB? |
|---|---|---|---|---|---|---|
| REQUIRED | B1/B2 | `src/lib/serverAuth.ts` | `getAuthenticatedUser`, `requireAuthUser`, `requireAdminAuth`, `requireProAuth` | Become the canonical database-backed session/liveness authority; exact session match; lifecycle/role result codes. | Critical; unit, route, replay, role tests. | Reads only |
| REQUIRED | B1 | `src/lib/accountLifecycle.ts` (new) | None | Pure predicates/result types for active, banned, waiting, terminal, session mismatch, and role eligibility. B1 uses existing fields; B2 adds terminal field. | Critical; exhaustive matrix. | No |
| NOT REQUIRED | B1 | `src/lib/auth.ts` | `signJWT`, `verifyJWT` | Keep cryptographic verification separate; do not add Prisma access because Proxy needs an optimistic verifier. Types may be extended only if later proven necessary. | JWT regression tests. | No |
| REQUIRED | B1/B2 | `src/app/api/auth/login/route.ts` | `POST` | Reject banned/deleted/terminal users before password/session mutation; issue one current session ID. | Login and timing/error tests. | Reads/writes session |
| REQUIRED | B1/B2 | `src/app/api/auth/me/route.ts` | `GET` | Use canonical strict liveness/session contract; no both-truthy shortcut. | Null/mismatch/replay matrix. | Reads |
| REQUIRED | B1/B2 | `src/app/api/auth/forgot-password/route.ts`; `reset-password/route.ts`; `verify-email/route.ts`; `resend-verification/route.ts` | `POST`/`GET` | Reject waiting/terminal states as policy requires; never recreate credentials for tombstones; keep non-enumerating public responses. | Token replay and enumeration tests. | Reads/writes tokens |
| REQUIRED | B1/B2 | `src/app/api/user/profile/route.ts` | `PUT` | Replace crypto-only auth with canonical live session. | Mutation-after-delete test. | Reads/writes user |
| LIKELY | B1 | `src/app/api/auth/logout/route.ts` | `POST` | Expire cookie; optionally clear matching current session only, without clearing another concurrent session. | Session ownership tests. | Conditional write |
| REQUIRED | B2/C | `src/app/api/admin/users/action/route.ts` | `POST` | Prevent UNBAN/RESET on terminal users; use canonical admin liveness plus sudo. | Admin/tombstone matrix. | Writes |
| REQUIRED | B2 | `src/lib/auth/sudoMode.ts`; `src/middleware/requireSudo.ts` | `verifyAdminCredentials`, sudo wrapper | Confirm live, nonterminal ADMIN at issuance/action time. Label as P0-002-required subset of broader auth finding. | Sudo replay tests. | Reads |
| REQUIRED | B2 | Exact caller inventory in Section 7 | exported route handlers/layout/action functions | Replace direct `verifyJWT` authorization with canonical database-backed checks. | Static zero-caller gate plus route tests. | Reads |
| REQUIRED | A | `prisma/schema.prisma` | `User` | Add nullable `anonymizedAt` and `anonymizationVersion`; add appropriate lookup index only if query evidence supports it. No backfill. | Prisma validation and disposable migration. | Schema |
| REQUIRED | A | `prisma/migrations/<approved_timestamp>_add_user_anonymization_lifecycle/migration.sql` (new) | None | Add only approved nullable fields/index. Do not include refund/FK/data transformation SQL. | Manual SQL review and production-parity rehearsal. | Schema |
| REQUIRED | C | `src/lib/recovery/softDelete.ts` | `softDeleteRecord`, `restoreRecord`, `getTrashBinItems` | Canonical deadline/state transition; terminal restore denied; consistent reversible-field clearing. | Boundary/time/concurrency tests. | Reads/writes |
| REQUIRED | C | `src/app/api/admin/recovery/route.ts`; `src/app/api/admin/trash/route.ts` | `GET`, `POST`, `DELETE` | Remove duplicate user restore mutation; delegate to canonical service; report `canRestore` from authoritative fields. | Route and sudo tests. | Reads/writes |
| LIKELY | C | `src/lib/db/softDelete.ts` | metadata helpers | Rename or constrain generic helper usage to avoid becoming an account restore authority; no behavior expansion. | Static import tests. | No |
| REQUIRED | D0/D1 | `src/lib/recovery/userAnonymization.ts` (new) | None | Counts-only preflight and terminal transaction contract described in Sections 9 and 14. | Full matrix/load/concurrency tests. | Yes |
| LIKELY | E | `src/lib/recovery/userDisposition.ts` (new) | None | Centralize reviewed child operations; accept transaction client only. | Per-model count/rollback tests. | Yes |
| REQUIRED | E | `prisma/schema.prisma` model semantics plus readers in exam/social/support/admin APIs | Models listed in Section 10 | No schema mutation in E unless separately approved; implement exact disposition and Deleted User rendering. | Per-domain regression tests. | Data |
| POLICY-DEPENDENT | F | `src/lib/referral/referralService.ts` | `getOrCreateReferralCode`, `validateReferralCode`, `recordAttributionOnSignup`, dashboard methods | After separate clarification, implement only the reconciled visible-code disposition; future use must be disabled without changing historical financial attribution. | Link/admin/audit/reconciliation tests. | Reads/writes |
| POLICY-DEPENDENT | F | `src/lib/referral/codeGenerator.ts` | generator/normalizer | Add a terminal-code helper only if separate clarification approves replacement; do not assume retention or replacement now. | Format/collision/historical-copy tests. | No |
| POLICY-DEPENDENT | F | `src/app/api/referral/me/route.ts`; `src/app/api/referral/validate-code/route.ts`; `src/app/api/auth/signup/route.ts`; `src/app/api/auth/register/route.ts`; `src/app/api/paymongo/checkout/route.ts` | exported handlers | After clarification, suppress terminal use and apply the approved code-display behavior without changing historical attribution. | Referral/payment mock tests. | Reads |
| REQUIRED | G | `src/lib/recovery/userFinancialSnapshot.ts` (new or test-local) | None | Select, normalize, hash/compare immutable financial fields before and after. Never print protected values. | Exact equality, rollback, concurrency tests. | Reads |
| REQUIRED | G | `src/scripts/test-user-anonymization-integration.ts` (new) | None | Synthetic disposable matrix including financial invariants and blocked network. | Integration suite. | Disposable only |
| LIKELY | G | `src/scripts/run-user-anonymization-integration.mjs` and `prisma.user-anonymization.config.ts` (new) | None | Fail-closed disposable launcher/config modeled on, but stricter than, the partner harness. | Guard self-tests and teardown proof. | Disposable only |
| LIKELY | G | `package.json` | scripts | Add local validation script only; no dependency changes. | Script smoke test. | No |
| REQUIRED | E2 | `src/app/api/social/rooms/[roomId]/leave/route.ts`; `src/app/api/social/rooms/[roomId]/route.ts` | leave/PATCH/DELETE | Reuse reviewed transfer-or-close primitives; no nondeterministic choice inside terminal transaction. | Host race tests. | Writes |
| REQUIRED | E2 | `src/app/api/social/clubs/[clubId]/transfer/route.ts`; `src/app/api/social/clubs/[clubId]/route.ts` | transfer/DELETE | Enforce eligible consenting owner and archive fallback. | Consent/membership race tests. | Writes |
| REQUIRED | E2 | `src/app/api/social/events/route.ts` and future exact event-management route | `GET`/`POST`; no current transfer | Add approved transfer/archive contract before exposure. | Scheduled-event tests. | Writes |
| REQUIRED | I | Future `src/app/api/account/closure/route.ts` and account settings UI files selected during slice inspection | None | Recent reauth, request/status/cancel/complete operations and explicit wording. | API/UI/accessibility tests. | Yes |
| REQUIRED | H | `prisma/schema.prisma`; separate future migration directories | FK declarations | Review direct financial, transitive, non-financial, and logical references independently. | Orphan/lock/migration/rollback rehearsal. | Schema |
| NOT REQUIRED | All | `src/jobs/purgeExpiredRecords.ts` | `purgeExpiredRecords` | Keep physical `User` purge disabled; only tests/messages may be strengthened. | Containment static test. | No User writes |
| NOT REQUIRED | P0-002 | `src/lib/backup/backupRestore.ts` | restore/rollback functions | Do not modify under P0-002; P0-003 or separate recovery work owns it. | Recovery gate evidence only. | No |

## 6. Lifecycle schema plan

Slice A is additive only:

```prisma
anonymizedAt          DateTime?
anonymizationVersion Int?
```

There is no backfill. Existing users remain `null/null`. Valid state invariants are:

- Active or waiting user: `anonymizedAt == null` and `anonymizationVersion == null`.
- Terminal Version 1 tombstone: `anonymizedAt != null` and `anonymizationVersion == 1`.
- Any half-populated or unsupported version is invalid and fails closed for authentication, restore, and anonymization.

The first migration contains only nullable column additions and an index only if the scheduler/preflight query needs it. A database CHECK constraint tying the two fields may be proposed in the Slice A plan after verifying Prisma/PostgreSQL compatibility; it is not silently added. No data update, FK change, default, role change, or physical-delete behavior belongs in Slice A.

Source compatibility order is intentional: B1 first enforces existing banned/deleted/session state without referencing the future columns. After the additive migration and regenerated Prisma client, B2 adds terminal-field selection and enforcement before any tombstone can exist.

Development uses `prisma format`, `prisma validate`, `prisma generate`, and migration commands only against the guarded disposable target. Production migration is blocked by Sections 16 and 17.

## 7. Central auth/session enforcement plan

### Canonical contract

B1 introduces a server-only result such as:

```ts
type LiveUserSessionResult =
  | { ok: true; session: VerifiedJwt; user: SafeAuthenticatedUser }
  | { ok: false; code: "NO_TOKEN" | "INVALID_TOKEN" | "USER_NOT_FOUND" |
      "BANNED" | "CLOSURE_PENDING" | "ANONYMIZED" | "SESSION_REVOKED" |
      "ROLE_FORBIDDEN" };
```

The secure check must:

1. Parse and cryptographically verify the presented cookie/header token.
2. Require a string user ID and a nonempty string session ID in the token.
3. Fetch only required fields from `User`.
4. Require `activeSessionId` to be nonnull and exactly equal to the presented session ID. A null database value is revoked, never a wildcard.
5. Reject `isBanned`, `deletedAt != null`, invalid lifecycle combinations, and, after Slice A, `anonymizedAt != null`.
6. Apply the route's server-side role/entitlement rule after liveness.
7. Return a minimal safe DTO and a generic client error; never return tombstone email, password/tokens, ban reason, or financial fields unnecessarily.

Proxy remains a fast optimistic redirect layer. It must not query the database or be treated as security enforcement. Route Handlers, server actions, data access, WebSocket/token minting, payment initiation, and admin actions must invoke the secure contract near the operation.

### B1 boundary

B1 changes only the canonical foundation, current `serverAuth` consumers, login/me/profile/credential recovery, and focused tests using existing fields. It does not reference `anonymizedAt`, alter schema, migrate every route, expose account closure, or anonymize data. B2, after Slice A, adds terminal checks and completes caller migration.

### Exact direct-`verifyJWT` migration inventory

The following current production callers require review/migration in B1 or B2. `src/lib/auth.ts` remains the crypto primitive and is not itself a route caller.

```text
src/app/admin/layout.tsx
src/app/api/admin/backups/[id]/route.ts
src/app/api/admin/backups/route.ts
src/app/api/admin/db-storage/route.ts
src/app/api/admin/elimination-drills/route.ts
src/app/api/admin/feature-flags/route.ts
src/app/api/admin/flags/route.ts
src/app/api/admin/flashcards/bulk/route.ts
src/app/api/admin/flashcards/route.ts
src/app/api/admin/login-history/route.ts
src/app/api/admin/logs/route.ts
src/app/api/admin/notifications/route.ts
src/app/api/admin/pricing/route.ts
src/app/api/admin/questions/[id]/route.ts
src/app/api/admin/questions/ai-generate/route.ts
src/app/api/admin/questions/bulk-delete/route.ts
src/app/api/admin/questions/export/route.ts
src/app/api/admin/questions/import/route.ts
src/app/api/admin/reading/[id]/route.ts
src/app/api/admin/reading/route.ts
src/app/api/admin/recovery/route.ts
src/app/api/admin/support-tickets/route.ts
src/app/api/admin/trash/route.ts
src/app/api/admin/users/action/route.ts
src/app/api/ai/explain-mistake/route.ts
src/app/api/analytics/dashboard/route.ts
src/app/api/auth/me/route.ts
src/app/api/bookmarks/route.ts
src/app/api/csc/sync/route.ts
src/app/api/duels/[id]/route.ts
src/app/api/duels/challenge/respond/route.ts
src/app/api/duels/challenge/route.ts
src/app/api/duels/matchmake/route.ts
src/app/api/exam/draft/route.ts
src/app/api/exam/history/route.ts
src/app/api/exam/start/route.ts
src/app/api/exam/submit/route.ts
src/app/api/flashcards/route.ts
src/app/api/mock-exam/history/[id]/route.ts
src/app/api/mock-exam/history/route.ts
src/app/api/notifications/read-all/route.ts
src/app/api/notifications/route.ts
src/app/api/paymongo/checkout/route.ts
src/app/api/paymongo/verify/route.ts
src/app/api/questions/[id]/route.ts
src/app/api/questions/daily/route.ts
src/app/api/questions/flag/route.ts
src/app/api/questions/route.ts
src/app/api/social/classmates/respond/route.ts
src/app/api/social/classmates/route.ts
src/app/api/social/clubs/[clubId]/invite/route.ts
src/app/api/social/clubs/[clubId]/members/route.ts
src/app/api/social/clubs/[clubId]/route.ts
src/app/api/social/clubs/[clubId]/transfer/route.ts
src/app/api/social/clubs/join/route.ts
src/app/api/social/clubs/route.ts
src/app/api/social/counts/route.ts
src/app/api/social/events/route.ts
src/app/api/social/events/rsvp/route.ts
src/app/api/social/messages/[conversationId]/route.ts
src/app/api/social/messages/conversations/route.ts
src/app/api/social/posts/[id]/comments/route.ts
src/app/api/social/posts/[id]/reactions/route.ts
src/app/api/social/posts/[id]/route.ts
src/app/api/social/posts/route.ts
src/app/api/social/presence/route.ts
src/app/api/social/profile/[userId]/route.ts
src/app/api/social/profile/route.ts
src/app/api/social/rooms/[roomId]/chat/route.ts
src/app/api/social/rooms/[roomId]/invite/route.ts
src/app/api/social/rooms/[roomId]/leave/route.ts
src/app/api/social/rooms/[roomId]/participants/route.ts
src/app/api/social/rooms/[roomId]/route.ts
src/app/api/social/rooms/[roomId]/topic/route.ts
src/app/api/social/rooms/[roomId]/voice-token/route.ts
src/app/api/social/rooms/[roomId]/whiteboard/route.ts
src/app/api/social/rooms/join/route.ts
src/app/api/social/rooms/route.ts
src/app/api/support/route.ts
src/app/api/user/analytics/detailed/route.ts
src/app/api/user/badges/route.ts
src/app/api/user/mistakes/route.ts
src/app/api/user/profile/route.ts
src/app/api/user/readiness-card/route.ts
src/proxy.ts (optimistic verification remains; it must not be counted as secure enforcement)
src/routes/admin/criticalActions.ts
```

Existing `serverAuth` consumers in accounting, admin analytics/questions/stats/users, referrals, reading materials, reviewer, and voucher redemption inherit B1 behavior but still require regression tests. A final static search must show no protected data/action route relying on crypto-only `verifyJWT`; approved exceptions are `src/lib/auth.ts` and optimistic `src/proxy.ts` only.

## 8. Restore normalization plan

One canonical account restore operation must replace direct route mutations:

```ts
restoreUserDuringWaitingPeriod({ userId, actorAdminId, now })
  -> { state: "RESTORED", userId, restoredAt }
```

Within one transaction it locks/re-reads the target and requires:

- `role == USER`; `ADMIN` uses no normal closure lifecycle.
- `deletedAt != null` and `anonymizedAt == null`.
- `now < deletedAt + 30 days`; equality at the deadline is expired.
- the record is actually in the recognized closure-wait state, not merely an unrelated ban.

It clears exactly the reversible closure fields (`deletedAt`, `deletedBy`, the closure-specific ban marker, and the closure-specific ban state). It does not restore or change payment entitlement, email verification, password, tokens, role, or financial records. It does not automatically sign in the user or issue a session. A separately banned user remains banned; therefore closure state must not be encoded only in free-text `banReason` long term. If an additional closure-request state field is later required, it needs a separate additive policy/schema approval rather than overloading `anonymizedAt`.

`getTrashBinItems`, Recovery GET, and Trash GET derive deadlines from `deletedAt`, never `updatedAt`, and return `canRestore: false` for expired, invalid, or terminal records. Recovery POST and Trash POST delegate to the same service. Concurrent restore versus terminal completion uses a row lock/serializable transaction: exactly one transition wins; restore can never clear `anonymizedAt` or `anonymizationVersion`.

## 9. Core anonymization-service plan

### Contract and trust boundary

The single server-side service is not a generic admin utility:

```ts
type AnonymizeUserCommand = {
  targetUserId: string;          // derived from live self-session or trusted scheduler selection
  expectedVersion: 1;
  requestId: string;             // server/request id for safe audit correlation
  trigger: "SELF_AFTER_WAIT" | "SYSTEM_AFTER_WAIT";
  now: Date;
};

type AnonymizeUserResult =
  | { state: "ANONYMIZED"; userId: string; anonymizedAt: Date; version: 1 }
  | { state: "ALREADY_ANONYMIZED"; userId: string; anonymizedAt: Date; version: 1 }
  | { state: "NOT_ELIGIBLE" | "MANUAL_REVIEW_REQUIRED"; code: string };
```

Self-service must ignore any client-supplied target ID and use the authenticated user's ID. A scheduler may supply only an ID selected by a trusted server query. Normal service always rejects `ADMIN`; `Partner` is not a `User` command target. The operation performs no email, PayMongo, bank/payout, LiveKit, Redis, webhook, or other network side effect.

### Exact terminal User state

The committed Version 1 `User` row must have exactly this lifecycle disposition. **Deleted User is display-layer text only and must not be stored in `User.name`.**

| User field | Required terminal value |
|---|---|
| `id` | Preserve the original stable ID. |
| `name` | `null`. |
| `email` | Persist the approved random alias containing at least 128 bits of cryptographic randomness under `.invalid`; never derive it from former identity or identifiers. |
| `password` | A valid hash of an unrecoverable cryptographically random value that is never stored, returned, or logged. |
| `role` | Preserve `USER`; normal service rejects any other role. |
| `isPaid` | `false`. |
| `paidUntil` | `null`. |
| `planType` | `null`. |
| `isBanned` | `true`. |
| `banReason` | Fixed non-PII terminal value `ACCOUNT_ANONYMIZED`. |
| `isEmailVerified` | `false`. |
| `emailVerificationToken`, `emailVerificationExpires` | `null`. |
| `passwordResetToken`, `passwordResetExpires` | `null`. |
| `activeSessionId` | A fresh high-entropy server-only revocation marker. It must differ from every previously issued session ID and must never be returned, logged, or issued in a JWT. It is not `null` for the terminal Version 1 transition. |
| `lastActiveAt` | `null`. |
| `createdAt` | Preserve. |
| `updatedAt` | Allow the terminal update to change it normally. |
| `deletedAt` | Preserve the existing soft-delete timestamp. |
| `deletedBy` | Replace with fixed non-PII categorical value `ACCOUNT_ANONYMIZATION`. |
| `anonymizedAt` | Set once at the terminal transition and never clear/change. |
| `anonymizationVersion` | `1`. |

A null `activeSessionId` remains a valid revoked state for existing BAN/soft-delete behavior. It is not the terminal Version 1 value. B1's strict equality rule rejects both null and mismatched database session state.

### Transaction protocol

1. Run the counts-only D0 preflight and ownership resolution checks. It never changes data.
2. Generate a cryptographically random 16-byte-or-greater alias local part, append the approved `.invalid` domain, generate a random unusable password input/hash, and generate a separate fresh high-entropy session-revocation marker outside the database transaction. Never return or log any of them, and never issue the revocation marker in a JWT.
3. Begin a bounded interactive Prisma transaction at `Serializable`; set reviewed local lock/statement limits when the adapter supports them.
4. Lock the `User` row with parameterized SQL (`SELECT ... FOR UPDATE`) and re-read all eligibility fields through the transaction client.
5. If already Version 1 terminal, return the stored idempotent result without touching children. If lifecycle fields are inconsistent or version unsupported, fail closed.
6. Require a non-ADMIN, soft-deleted user whose 30-day deadline has passed, no unresolved ownership blockers, and row counts at or below reviewed bounds.
7. Snapshot protected financial fields inside the same consistent transaction view.
8. Execute only the approved child dispositions in Section 10.
9. Apply no referral-code mutation unless the separate human clarification required by Section 11 has reconciled the design and historical dependencies. D1 is blocked until Slice F has an approved exact disposition.
10. Update the retained `User` last to the exact terminal state table above: clear `name`; persist the random alias and unusable password hash; disable live entitlement; set the fixed ban/deletion categories; clear verification/reset state; rotate `activeSessionId` to the never-issued revocation marker; preserve `id`, `role = USER`, `createdAt`, and the existing `deletedAt`; set `anonymizedAt` once and version `1` atomically.
11. Re-read/compare financial invariants before commit. Any mismatch throws and rolls back everything.

Alias unique collision (`P2002`) aborts the transaction, generates a new alias, and retries a small fixed number (for example three) outside the failed transaction. Exhaustion fails closed. Serialization conflicts receive a bounded retry with jitter. Transaction failure leaves the account wholly pre-terminal. Response loss after commit is safe because retry returns `ALREADY_ANONYMIZED` from the persisted marker. Two concurrent requests serialize on the same user row; only one performs mutation.

No staged workflow may erase PII before the final transaction. If scale later requires staged preparation, it may only calculate/store non-PII plans and ownership approvals. The irreversible identity and child-data changes remain one atomic terminal transition.

## 10. Child-data disposition plan

### Safe automatic operations inside the terminal transaction

| Domain/model | Version 1 operation |
|---|---|
| `ExamResult` (and cascading `ExamCategoryResult`) | Delete all rows for `userId`. |
| `ExamDraft`, `Bookmark`, `UserMistake`, `UserStreak`, `DailyQuestionAttempt`, `UserBadge` | Delete all rows for `userId`. |
| `StudyTogetherProfile` | Delete, including avatar and personal profile fields. |
| `ClassmateRelation` | Delete where sender or receiver is the user. |
| `StudyPostReaction` | Delete for the user. |
| `StudyRoomParticipant`, `StudyEventRSVP`, `StudyClubMember` | Delete only after ownership has been resolved; remove current/future participation. |
| `Notification` | Delete logical rows where `userId` matches. |
| `DirectMessage.content` | Replace authored content with one fixed non-PII tombstone marker; retain message ID, conversation, sender tombstone ID, state, reply structure, and timestamps. Do not rewrite other authors' messages. |
| `StudyRoomMessage.content` | Replace authored content with a fixed non-PII marker; retain structural fields. |
| `StudyPost`, `StudyPostComment` | Retain content and author FK; readers render the terminal author as Deleted User. Do not generically edit retained content. |
| `QuestionFlag` | Retain row/content linked to tombstone; admin readers render pseudonymous identity. |
| `SupportTicket.userEmail` | Replace exact matching copied account email with the same persisted `.invalid` alias. Retain ticket text/status/admin notes under existing restricted access; no generic free-text redaction. |
| `LoginHistory` | For rows linked by `userId` and exact pre-terminal email matches, preserve status/reason/time and tombstone ID; replace email with alias and null IP/user agent. Do not broadly update unrelated same-string rows without proven linkage. |
| `ActivityLog` | Preserve material action/time and tombstone `userId`; null IP and replace metadata with a fixed scrubbed marker/null according to a reviewed action allowlist. Do not parse or partially redact arbitrary metadata. |
| User credentials/session/profile identity | Clear verification/reset token fields and expiries, `name`, and `lastActiveAt`; set `isEmailVerified=false`; rotate `activeSessionId` to a fresh never-issued high-entropy server-only revocation marker; apply the exact terminal User state in Section 9 last. |

Every `deleteMany`/`updateMany` uses a reviewed exact `userId`/author/sender predicate and the transaction client. Expected affected counts are compared with D0 counts; an unexplained difference aborts.

### Ownership/structural operations requiring special handling

- **Rooms:** before terminal execution, transfer each hosted active/scheduled room to a specifically approved eligible live participant, or mark it ended/cancelled and remove participation. Do not choose “first participant” inside anonymization. Clear authored chat regardless of ownership outcome.
- **Events:** because no current transfer endpoint exists, implement an explicit approved-host transfer or cancellation/archive operation. Upcoming public events cannot retain the tombstone as an operational host.
- **Clubs:** transfer only to an eligible live member who has explicitly consented, using atomic owner/member role updates; otherwise archive/close. Public existence without an operational owner is not allowed.
- **Conversations:** retain conversation/message structure as approved, clear only the user's authored content, and remove the user's participant row only if product behavior and participant visibility remain structurally valid. The exact participant-row action must be integration-tested; it cannot cascade/delete the conversation or other users' messages.

Unresolved ownership, missing consent, inconsistent owner/member roles, or a structure that would cascade shared data returns `MANUAL_REVIEW_REQUIRED` before any irreversible mutation.

## 11. Referral-code safety analysis

**REQUIRES SEPARATE HUMAN CLARIFICATION BEFORE SLICE F.**

The approved tombstone design proposed preserving the `ReferralCode` row/ID, replacing its visible `code` with a random non-PII unique code, and setting it inactive. Policy Version 1 approves preservation of referral attribution/history and prohibits generic financial/audit free-text redaction, but its policy record does not independently spell out the visible-code mutation. Current source inspection adds a material complication: the original normalized code may be copied into `ReferralAuditLog.reason` and `metadata`, while links, reports, searches, analytics, signup/registration, and checkout depend on the code or its record.

Therefore this implementation plan authorizes neither of these competing behaviors:

- retaining the original inactive `ReferralCode.code`; or
- replacing `ReferralCode.code` while leaving historical copies/dependencies unresolved.

Before Slice F, the human must reconcile the design and policy record and approve one exact model-aware behavior. The clarification must define the visible code, `isActive`, historical audit copies, admin search/reporting, analytics/reconciliation, referral links/cookies, collision behavior, access restrictions, and tests. Stable `ReferralCode.id` and protected referral/reward/payout history must remain intact in every option. Future validation/use must be disabled for a terminal owner, and public rendering must use Deleted User as a display-layer label without exposing email, alias, User ID, or an identity-derived code.

No referral behavior is changed now. Generic string replacement across `ReferralAuditLog` or financial/audit free text remains prohibited.

## 12. Financial immutable-field guardrails

Tests must distinguish **EXPECTED USER LIFECYCLE MUTATIONS** from **FORBIDDEN HISTORICAL FINANCIAL MUTATIONS**. The service uses an explicit allowlist for the exact terminal `User` state and approved child dispositions. Historical financial/audit fields remain deny-by-default. Tests snapshot normalized records before and after, sort by stable ID, exclude only expressly expected lifecycle/timestamp changes, and require byte-equivalent JSON/hash equality for protected history without logging values.

### Expected User lifecycle mutations

| User fields | Required assertion |
|---|---|
| `id`, `role`, `createdAt`, existing `deletedAt` | Preserved exactly; role remains `USER`. |
| `name` | Changes to `null`; Deleted User is display-layer text only. |
| `email`, `password` | Change only to the approved random `.invalid` alias and valid unrecoverable random-value hash; neither value is returned or logged. |
| `isPaid`, `paidUntil`, `planType` | Expected transition to `false`, `null`, `null`. These are live entitlement state, not immutable historical finance. |
| `isBanned`, `banReason`, `deletedBy` | Expected transition to `true`, `ACCOUNT_ANONYMIZED`, `ACCOUNT_ANONYMIZATION`. |
| `isEmailVerified`, verification/reset fields | Expected transition to `false` and all token/expiry fields `null`. |
| `activeSessionId` | Expected rotation to a fresh high-entropy server-only marker different from all previously issued session IDs; never returned, logged, or issued in a JWT. |
| `lastActiveAt` | Expected transition to `null`. |
| `updatedAt`, `anonymizedAt`, `anonymizationVersion` | `updatedAt` may advance; `anonymizedAt` is set once; version becomes `1`. |

### Forbidden historical financial mutations

| Model | Immutable fields to snapshot |
|---|---|
| `Transaction` | `id`, `userId`, `checkoutSessionId`, `paymentIntentId`, `amount`, `grossAmountCentavos`, `discountAmountCentavos`, `feeAmountCentavos`, `netSettlementCentavos`, `planType`, `status`, `receiptUrl`, `createdAt`, `updatedAt`. |
| `ReferralCode` | Preserve `id`, `userId`, `clickCount`, `createdAt`, relations, and all historical financial linkage. The allowed `code`, `isActive`, and resulting `updatedAt` disposition remains **POLICY-DEPENDENT** and blocked on the Section 11 clarification. |
| `ReferralAttribution` | Every field: IDs, participants, code ID, attribution/expiry, IP/user agent, lock, timestamps. Policy preserves referral history; no generic scrub is authorized here. |
| `Referral` | IDs, status, qualifying payment/amount, effective rate, reward amount, holding/risk fields, lifecycle timestamps. |
| `ReferralReward` | IDs, participant IDs, transaction ID, purchase amount, reward type/rate/amount/currency/status, holding/availability/reversal fields, timestamps. |
| `ReferralPayout` | IDs, user, amount/currency/method, encrypted account number, account name/bank, status, admin/processor/reference fields, timestamps. Payout identity remains restricted until separate policy. |
| `ReferralAuditLog` | All fields, including reason/metadata/IP. No generic redaction. |
| `FinancialLedgerEntry` | `id`, entry number, transaction/type/account/entry type, amount/currency, source entity/ID, description, dates, period, creator. |
| `PartnerAttribution` | All fields, especially `referredUserId`, partner/campaign, dates, lock. Partner remains a separate lifecycle. |
| `PartnerCommission` | IDs, purchase amount, model/rate/amount/currency/status, campaign/holding/availability/reversal fields, timestamps. |
| `TaxRecord` | IDs/references, taxable amount, rate, tax amount, basis, status, effective/created dates. |
| `ReconciliationRecord` | IDs/source/match, status, discrepancy amount/notes, reconciler/time, timestamps. |
| `RefundOperation` | Every field: transaction/actor/idempotency/request hashes, provider IDs, amount/reasons, status, attempt/timing/HTTP/error fields, timestamps. |
| `FinancialIdempotencyKey` | Every field: actor, operation, key, request hash, resource ID, creation time. |
| `InstitutionalVoucherBatch` | Batch identity, institution/contact, plan/duration/counts/price/status/notes/expiry/creator/timestamps. |
| `InstitutionalVoucherCode` | ID/batch/code/status/`redeemedBy`/redemption/access/timestamps. |
| `Partner`, `PartnerPayoutProfile`, `PartnerPayout` | All identity, rate, payout, credential/profile, financial, status, and timestamp fields; the User service must not touch these rows. |
| `FinancialDeduction`, `FinancialAdjustment`, accounting periods/settings | All fields; no relationship justifies mutation. |

The test also snapshots row counts and relationship IDs for transitive records. Any protected historical amount, rate, status, balance/value, provider reference, refund state, payout identity, reconciliation fact, voucher fact, or idempotency provenance change aborts the transaction and fails the suite. Expected `User` entitlement disablement is asserted separately and is not treated as historical financial mutation. Any `ReferralCode` field change outside the separately clarified Slice F allowlist also aborts. No provider API is called to “verify” these invariants.

## 13. FK-hardening plan

Slice H is a separate later project migration, not part of D1.

1. **Nine direct financial User FKs:** evaluate `RESTRICT`/`NO ACTION` for the nine relations listed in Section 3. A retained tombstone satisfies referential integrity; a physical delete should fail. Do not change all nine in one migration without lock/runtime measurements and transitive analysis.
2. **Transitive financial FKs:** review referral code → attribution/referral, referral → reward, transaction → reward/commission, and transaction → ledger/tax/refund chains. Current cascades can erase financial history if an intermediate parent is deleted even when `User` is retained. Prefer restrictive historical roots or explicit reviewed archival behavior.
3. **Non-financial direct User FKs:** retain cascade only where the owning child is explicitly disposable and shared data cannot be lost. Public posts/comments, question flags, preserved message structure, activity/security records, and owned social structures require non-cascade semantics or a guarantee that physical User deletion stays impossible.
4. **Logical references:** catalog `Notification.userId`, `ActivityLog.userId`, `LoginHistory.userId`, `SupportTicket.userId`, plus all other string IDs before adding constraints. Their Version 1 disposition differs, so no blanket FK is correct.

Specific re-analysis:

- `RefundOperation.transactionId`: likely a required FK to `Transaction` with restrictive deletion after orphan/type/lock analysis. It must preserve refund provenance.
- `RefundOperation.actorId`: likely a restrictive `User` reference only if all actors are guaranteed User IDs; confirm system/partner actor semantics first.
- `PartnerAttribution.referredUserId`: currently logical and synthetic tests use non-User-shaped values. Do not add a `User` FK until every producer, historical row, and partner lifecycle expectation is reconciled.
- `InstitutionalVoucherCode.redeemedBy`: nullable logical `User.id`; preserve voucher redemption history. Decide restrictive relation versus retained logical ID only after orphan and deletion-semantics review.

Each FK group gets its own migration, preflight orphan query, lock estimate, disposable load rehearsal, rollback plan, and production authorization. No migration SQL is designed in this task.

## 14. Large-user transaction safety

D0 performs indexed counts only and returns a signed/internal plan summary, not row content. It counts every mutation predicate: exam results and dependent categories; each private-state table; posts/comments/reactions; direct/room messages; participants/memberships/RSVPs; notifications; support/login/activity rows; referral records; and hosted rooms/events/clubs. It also detects ownership and inconsistent lifecycle/financial relations.

Initial safety envelope for disposable qualification:

- At most 40 mutating SQL statements in the terminal transaction.
- At most 10,000 total affected child rows and at most 10,000 rows in any one `updateMany`/`deleteMany`; the production cap is the lower of these values and the largest fully passing synthetic profile.
- Prisma interactive transaction `maxWait` target: 2 seconds; transaction timeout target: 10 seconds.
- PostgreSQL local `lock_timeout`: 2 seconds; local `statement_timeout`: 8 seconds, after confirming adapter/transaction behavior.
- No unbounded row reads; counts, stable IDs needed for ownership, and immutable snapshots use indexed predicates and bounded result sizes.

Synthetic profiles contain 0, 100, 1,000, 5,000, and 10,000 total affected rows, plus a 10,000-row single-table hotspot for direct messages, room messages, notifications, activity history, and exam history. Run at least ten repetitions per candidate ceiling with concurrent login/replay, restore, and duplicate-anonymization attempts. A ceiling passes only if every run commits or fails cleanly, p95 terminal time is at most 5 seconds, worst time is below 8 seconds, lock waits stay below 2 seconds, financial hashes remain exact, and no pool/timeout/deadlock error leaves partial data.

If a preflight count exceeds the approved ceiling, a count changes materially between preflight and lock/re-read, or a timeout/lock cannot be obtained, return `MANUAL_REVIEW_REQUIRED`/retryable failure before mutation. Do not batch irreversible child erasure across commits. A future large-account design may stage non-PII counts and ownership approvals only; the terminal PII transition remains atomic.

## 15. Disposable-database strategy

No development/test command may fall back to the repository's `DATABASE_URL` or load `.env` values. Future implementation should add a dedicated launcher based on the existing partner-auth harness, with stronger creation/teardown proof:

1. Require `P0_002_TEST_DATABASE_URL`, an exact confirmation phrase, a random run ID, and a database name such as `gsx_p0_002_test_<runid>`.
2. Reject Vercel/production markers, unsupported URL parameters, absent credentials, unexpected database names, any equality with a separately fingerprinted forbidden production target when such a fingerprint is safely supplied, and any pre-existing table/schema/object.
3. Start child processes from an allowlisted environment, use an empty dotenv file, set `DATABASE_URL` only to the dedicated target, remove all payment/email/payout/LiveKit/Redis/provider secrets, set `NODE_ENV=test`, and install a global network guard that throws on HTTP/fetch attempts.
4. Verify `current_database()` equals the exact run-specific name before every migration/test/destructive teardown phase. Never print the URL or credentials.
5. Apply the **exact repository migration chain from empty** using a dedicated Prisma config, then run `prisma migrate status`. This lane proves clean bootstrap, including the pending refund migration.
6. Maintain a second production-parity lane generated from separately authorized, read-only migration-history/schema evidence. Seed synthetic data only, then rehearse the exact proposed deployment order. No production data clone is permitted.
7. Seed the full lifecycle matrix: active, banned-only, waiting before/at/after deadline, Version 1 terminal, inconsistent marker, ADMIN, user with every child type, owner/host cases, financial/referral/voucher/refund cases, large profiles, alias collision, and concurrency races.
8. Snapshot schema/data, execute slice tests, rehearse application rollback with additive columns retained, and rehearse database restore/reversal only inside the disposable database. Dropping lifecycle columns is not the preferred operational rollback.
9. Export only sanitized counts/pass markers and migration hashes as evidence.
10. In `finally`, connect through a separate explicitly configured disposable admin connection, revalidate the exact database name/run ID and active-connection ownership, drop only that database, then verify it no longer exists. A teardown failure is a failed test requiring manual cleanup; never widen the target.

Every slice gets pure/unit tests first. A uses migration/schema checks; B auth/replay matrices; C deadline/restore races; D/E disposition/idempotency/rollback; F referral consumers/reconciliation; G immutable hashes/provider blocks; H orphan/lock/FK behavior; I API/UI/state-machine tests.

## 16. Unapplied refund-migration sequencing

The repository migration `20260825205842_add_refund_operation` precedes any future P0-002 migration but is intentionally absent from production. Prisma `migrate deploy` cannot select only the later lifecycle migration; it applies all pending migrations in order. Therefore:

- Do not create/deploy a production P0-002 migration until a separately authorized read-only check reconciles production `_prisma_migrations`, actual refund objects, and repository hashes.
- Disposable clean-chain tests must include the refund migration because it is part of repository HEAD.
- A separate release decision must either review and deploy the refund migration under its own authorization first, or establish another formally reviewed migration-history strategy. Do not edit/delete/reorder the refund migration, mark it applied with `migrate resolve` when it was not applied, or use `db push` to bypass history.
- Immediately before any future production `migrate deploy`, capture a read-only pending list and stop unless it contains exactly the migration set explicitly approved for that release. A lifecycle release must not “incidentally” deliver refund functionality.
- FK hardening remains later still, in separate migration directories and deployment windows.

Until this is reconciled, Slice A is disposable-only and no production schema command is authorized.

## 17. P0-003/recovery dependency gate

P0-003 remains NOT STARTED. This plan does not modify backup code.

Current backup restore and automatic rollback cannot demonstrate restoration of user or financial tables, because unhandled tables are counted but not written. Consequently:

- Source-only, reversible B1 development/validation may proceed with separate approval and no production database access.
- No P0-002 production schema migration—including the additive lifecycle migration—and no irreversible production anonymization may be authorized until either P0-003 containment is completed or a separately verified recovery capability proves full applicable schema/data restore and rollback.
- Recovery evidence must cover the migration chain, User plus child tables, financial invariants, encryption/provider-independent records, point-in-time objectives, restore verification queries, and an operator-run rehearsal in an isolated environment.
- A normal application rollback is not recovery for committed anonymization; old PII must not be reconstructed after terminal commit.

This gate is stronger than a backup record marked `PASSED`; it requires observed restoration of the affected data and schema.

## 18. Production rollout order

No step below is authorized by this report.

1. Reconfirm branch/HEAD/status and approve B1 alone.
2. Implement, validate, and optionally deploy B1 source compatibility: existing banned/deleted/session enforcement only. Preserve Proxy as optimistic and physical-delete containment.
3. Complete the P0-003/separate verified recovery gate and reconcile the refund migration/production history.
4. Implement Slice A; prove clean-chain and production-parity disposable migrations; generate compatible Prisma client.
5. Deploy application code compatible with both lifecycle fields null and populated, then deploy the additive schema in a separately reviewed window. Exact order must follow the generated-client/runtime compatibility rehearsal; no tombstone is created yet.
6. Implement/deploy B2 terminal enforcement and migrate all protected callers. Run static/replay/readiness gates.
7. Implement/deploy C restore normalization. Keep anonymization unavailable.
8. Implement D0/E1/G/E2; obtain the separate human clarification required before F, then implement only the reconciled Slice F behavior. Pass the complete disposable matrix, financial hashes, ownership workflow, referral reconciliation, and large-user thresholds. Keep D1 unreachable/feature-disabled.
9. Run a newly authorized production read-only preflight: migration history, schema, eligible counts, child/financial exposure, ownership blockers, orphans, query plans, and recovery readiness. Stop on drift.
10. Deploy D1 code disabled; verify health, auth denial, containment, and zero provider calls.
11. Implement I and enable closure request/status/restore only after focused approval. Terminal completion remains disabled until final go/no-go.
12. Enable terminal completion for a tightly controlled cohort only after current backups/recovery, monitoring, and operator stop controls pass. Verify post-commit tombstone, session replay denial, child disposition, and financial equality.
13. Expand only after reviewed evidence. Implement H later in separate FK migrations/windows.

Post-deploy readiness includes database connectivity, migration hashes, lifecycle-state counts, no invalid marker combinations, auth replay rejection, no restorable terminal accounts, containment static check, financial invariant sampling by non-sensitive hashes/counts, and external-effect counters at zero.

## 19. Rollback design

| Area | Safe rollback |
|---|---|
| B1/B2 auth | Revert only to the latest version that still rejects all existing tombstones and preserves strict session revocation. Never roll back to crypto-only protected API authorization once tombstones exist. |
| Additive schema | Leave nullable columns in place during application rollback. Dropping them is a later separately approved migration after proving no tombstones and no readers; it is not incident response. |
| Restore normalization | Disable restore UI/API if necessary, but never restore by direct field clearing. Keep terminal prohibition in every rollback build. |
| D0/D1 service | Disable invocation/feature exposure. Keep code capable of recognizing existing terminal markers. Never re-enable physical deletion. |
| Child/referral behavior | Roll application readers forward/fix forward so existing tombstones stay pseudonymous and terminal referral codes remain unusable under the separately approved Slice F disposition. Do not improvise retention/replacement or restore cleared content/private data. |
| Product/API | Turn off new closure requests and terminal completion independently; status and tombstone denial remain available. |
| FK hardening | Rehearse reverse constraint changes only on disposable data. Application containment remains regardless of FK rollback. |

If a real terminal transaction committed, it is irreversible. Rollback must not recreate the old email, password, tokens, profile, messages, or private study history from logs/backups. Recovery is for failed deployment/database integrity, not a product “undo anonymization” capability. Existing Version 1 tombstones remain honored by every compatible application version.

## 20. Validation matrix

### Per-slice local sequence

1. Reconfirm `git status --short`, branch, HEAD, and protected user work.
2. Inspect the slice diff and all callers before commands.
3. For schema slices on isolated environment only: `prisma format`, `prisma validate`, manual migration SQL review, `prisma generate`, clean-chain `prisma migrate deploy`, and `prisma migrate status` through the dedicated config.
4. Run `npx tsc --noEmit`, targeted tests, relevant regression suites, lint for changed files/full lint as appropriate, and `npm run build` before application-code commit unless explicitly waived after risk disclosure.
5. Run static physical-delete and direct-auth caller searches.
6. Reread every changed file; run `git diff --stat`, full diff, and `git diff --check`.

| Validation area | Required cases/evidence |
|---|---|
| Schema | Empty → exact chain; production-parity chain; nullable/no-backfill; generated client; migration hash and pending-set review; reversal/application-rollback rehearsal. |
| Auth/session | Missing/invalid JWT; missing session ID; DB session null; mismatch; matching; user missing; banned; waiting; terminal; inconsistent version; ADMIN/USER; old JWT after closure/restore/reset/anonymization; every protected caller. |
| Restore | Before deadline succeeds; exactly at/after deadline fails; terminal always fails; unrelated ban preserved; duplicate/concurrent restore; restore versus anonymize race. |
| Anonymization | Active/waiting not eligible; after-wait success; exact terminal User field table (including cleared name, disabled entitlement, fixed ban/deletion categories, and rotated never-issued session marker); already terminal idempotent; ADMIN rejected; concurrent duplicate; response loss retry; alias collision; transaction/lock/statement failure leaves zero partial changes. |
| Child data | Exact per-model counts and dispositions; shared users' rows untouched; posts/comments/question flags retained and pseudonymous; authored message content cleared; private state deleted; support/login/activity handling exact. |
| Ownership | Transfer with eligible consent; ineligible/terminal/nonmember rejection; archive/close fallback; concurrent membership/host change; unresolved state fails before mutation. |
| Referral | Block Slice F until separate clarification; then test the approved visible-code/active-state/historical-copy behavior, stable ID/linkage, disabled terminal use, admin reports, public suppression, and zero terminal attribution in payment mocks. |
| Financial | Assert expected `User.isPaid=false`, `paidUntil=null`, and `planType=null` separately; require exact before/after hashes, counts, IDs, amounts, rates, statuses, provider refs, idempotency, refund, voucher, ledger, tax, payout, and reconciliation history. |
| External effects | Stub/deny `fetch` and provider SDK boundaries; email/payment/payout/LiveKit/Redis/webhook counters remain zero during anonymization. |
| Load | Synthetic thresholds and concurrent races from Section 14; bounded queries/statements; no partial commit. |
| Containment | Static search shows no runtime `prisma.user.delete*`; purge routes/jobs continue returning disabled behavior. |
| Production preflight | Separately approved read-only migration/schema/count/orphan/ownership/exposure/query-plan/recovery checks; no secrets or row content printed. |
| Post-deploy | Readiness, migration hashes, state counts, replay denial, no terminal restore, financial non-sensitive hashes/counts, feature flag state, provider-effect counters. |

Production validation is never run during development and requires separate explicit authorization.

## 21. Stop conditions

Stop without mutation or rollout if:

- branch, HEAD, repository state, schema, source, migration hashes, or policy differs from the approved baseline;
- pre-existing tracked/untracked work could be overwritten or the slice diff becomes unexpectedly broad;
- any command resolves to production/shared database during disposable testing, any `.env` fallback occurs, or the disposable identity/empty-state/teardown contract fails;
- production and repository migration histories differ unexpectedly, the refund migration would be bundled, or the approved pending set is not exact;
- the recovery/P0-003 gate is not proven for a production schema/data step;
- runtime physical `User` delete is introduced or containment is weakened;
- an ADMIN or Partner can enter the User anonymization service;
- any protected route, mutation, token mint, provider action, or server data read still accepts a banned/deleted/terminal user or revoked/mismatched session;
- restore can reactivate a terminal/expired/unrelated-banned account or two restore implementations remain authoritative;
- lifecycle fields are half-populated/unsupported, alias entropy/domain is wrong, collision retry is unbounded, or secrets/PII could be logged;
- any financial/referral/payout/ledger/tax/reconciliation/refund/idempotency/voucher invariant changes unexpectedly;
- Slice F is attempted before the separate referral-code clarification reconciles visible-code behavior and historical copies/dependencies;
- an external provider/network call occurs during anonymization;
- shared social ownership/structure or consent cannot be resolved deterministically before terminal mutation;
- affected counts exceed the reviewed threshold, count drift is unexplained, indexes/query plans are unsafe, or lock/statement/transaction bounds are exceeded;
- a transaction failure leaves any partial PII erasure or terminal identity state;
- production preflight shows newly eligible exposed users, orphans, unexpected FKs/cascades, ownership blockers, invalid lifecycle states, or unsafe load;
- post-deploy readiness/replay/containment/financial checks fail;
- rollback would require reconstructing a terminal user's PII.

## 22. Risks/unknowns

- The 32-FK and zero-exposure production evidence is point-in-time and must be refreshed.
- There is no dedicated closure-request state; current `deletedAt`/ban marker semantics may be insufficient to distinguish closure from an unrelated administrative ban. Any new state requires separate schema/policy review.
- Crypto-only JWT checks are widespread. Missing one creates a tombstone-access path; static inventory plus route-level testing is mandatory.
- The serverless pool defaults to one connection. Interactive transaction and concurrent load behavior must be measured with the actual Prisma 7.9.1 PostgreSQL adapter.
- Exact row thresholds are provisional until disposable load evidence establishes a lower safe ceiling.
- Direct-message participant removal may affect conversation visibility/uniqueness and needs shared-user fixtures.
- Events have no current transfer API; room's “first participant” fallback is not consent; club transfer has consent/eligibility gaps.
- Retained public/support/financial free text may independently contain user-entered PII. Version 1 does not authorize generic redaction; this residual risk must be documented, not silently changed.
- Referral-code policy/design records are not yet reconciled with source-discovered historical copies/dependencies. Retaining the original string keeps an identity-derived prefix; replacing only the current field does not address audit copies. Slice F requires separate human clarification.
- Logical actor/user IDs may include non-User/system values, particularly refund/partner flows; FK decisions require producer analysis.
- The intentionally pending refund migration blocks a clean selective production lifecycle deployment.
- Current backup restore is not verified full recovery, so migration/anonymization production authorization is gated.
- Operational monitoring, audit retention access controls, scheduler design, and legal retention durations beyond approved Version 1 require separate review before exposure.

## 23. Implementation slice approval gates

| Slice | Entry approval/evidence | Exit evidence before next slice |
|---|---|---|
| B1 | Fresh Git/source inspection; exact files/functions; no DB/schema scope. | Strict existing-field liveness/session matrix; current `serverAuth` consumers pass; build/typecheck; diff review; no production DB. |
| A | B1 compatible; refund/recovery gates understood; disposable target approved. | Two nullable fields only; clean/parity migration evidence; generated client; no production deployment. |
| B2 | A client/schema available; exact caller inventory refreshed. | Terminal denial everywhere; only crypto/proxy `verifyJWT` exceptions; replay tests and build pass. |
| C | B2 canonical contract stable. | One restore authority; deadline and concurrency matrix; terminal restore impossible. |
| D0 | Model/query inventory refreshed; synthetic fixtures approved. | Counts/ownership/financial snapshot only; bounded/query-plan evidence; zero mutations. |
| E1/G | Exact Policy Version 1 dispositions and historical-financial immutable list approved. | Per-domain operations rollback atomically; financial hashes exact; zero network. |
| F | Separate human clarification reconciles design, policy record, and source-discovered historical copies/dependencies. | Only the approved code/inactive/history behavior is implemented; stable referral/reward/payout linkage and financial history remain exact. |
| E2 | Product transfer/archive semantics and consent approved. | Every owned structure resolved deterministically before D1. |
| D1 | All above plus recovery/P0-003 and migration-history gates. | Disabled service passes idempotency/concurrency/load/rollback matrix; no exposure. |
| I | Backend invariants proven; wording/state/API plan separately approved. | 30-day/status/restore/reauth/cookie tests; completion still controlled. |
| H | Stable tombstone operations and fresh orphan/lock evidence. | Independently deployed/rehearsed FK groups; no cascade loss; containment preserved. |

Approval for one slice does not authorize the next, a production database connection, migration deployment, feature enablement, terminal execution, stage, commit, push, or deploy.

## 24. Recommended next slice

Recommend exactly one first implementation slice:

**Slice B1 — central account-liveness and session-enforcement foundation.**

Why first: it is the smallest reversible prerequisite and improves the containment boundary using fields already present. It prevents null/mismatched session IDs and banned/soft-deleted accounts from continuing through the canonical server-auth path. It establishes the secure data-adjacent contract required by Next.js Route Handlers without coupling Prisma database reads into optimistic Proxy verification. Starting with schema would be blocked by the pending refund migration and recovery gate.

Expected files for a separately approved B1 plan:

- `src/lib/accountLifecycle.ts` (new pure existing-field predicates/result types)
- `src/lib/serverAuth.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/auth/reset-password/route.ts`
- `src/app/api/auth/verify-email/route.ts`
- `src/app/api/auth/resend-verification/route.ts`
- `src/app/api/user/profile/route.ts`
- focused new static/unit route harness files selected in the B1 inspection; `package.json` only if a test script is separately approved

Exact B1 validation: baseline/status/diff protection; pure state matrix; login rejection for banned/deleted users; strict null/missing/mismatched/matching session tests; `/me`, profile, and recovery-token replay tests; non-enumerating recovery responses; existing `serverAuth` consumer regressions; static verification of B1 scope; `npx tsc --noEmit`; relevant lint/tests; `npm run build`; complete reread and Git diff checks.

Explicit exclusions: no Prisma schema or migration, no terminal marker access, no anonymization service, no child/financial/referral mutation, no restore redesign, no UI/account-closure surface, no FK change, no P0-003, no provider call, no production/database access, and no claim that all direct `verifyJWT` routes are migrated until B2.

B1 can be reverted safely before tombstones exist, subject to normal source rollback review. It needs no production database access for implementation or validation. A later production deployment, if desired, requires separate approval but no schema migration. Physical `User` purge remains disabled throughout.

============================================================
GOVSTUDYX PHASE 0 / TASK 0.2D.2 IMPLEMENTATION PLAN COMPLETE
GSA-P0-002
============================================================

BASELINE HEAD:
ac23aad11c9104cd5e57e13640146bc89d9e4f33

CURRENT HEAD:
ac23aad11c9104cd5e57e13640146bc89d9e4f33

POLICY VERSION:
1

SOURCE MODIFIED:
NO

SCHEMA MODIFIED:
NO

MIGRATION CREATED:
NO

PRODUCTION DATABASE ACCESSED:
NO

DATABASE MODIFIED:
NO

IMPLEMENTATION STARTED:
NO

IMPLEMENTATION PLAN:
COMPLETE

SLICE PLAN:
COMPLETE

AUTH PLAN:
COMPLETE

ANONYMIZATION SERVICE PLAN:
COMPLETE

FINANCIAL GUARDRAILS:
COMPLETE

FK HARDENING:
PLANNED ONLY

DISPOSABLE DB STRATEGY:
COMPLETE

P0-003 DEPENDENCY:
DOCUMENTED

RECOMMENDED FIRST IMPLEMENTATION SLICE:
Slice B1 — central account-liveness and session-enforcement foundation

GSA-P0-002 STATUS:
CONTAINED — NOT FULLY RESOLVED

P0-003 STARTED:
NO

REPORT:
docs/audit/remediation/P0-002-IMPLEMENTATION-PLAN.md

NEXT ACTION:
Human review and explicit approval of exactly one implementation slice.

STOP.
