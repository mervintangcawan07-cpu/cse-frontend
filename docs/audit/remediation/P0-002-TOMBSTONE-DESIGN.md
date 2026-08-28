# GSA-P0-002 Tombstone / Anonymization Policy and Implementation Design

## 1. Baseline

- Task: GovStudyX Phase 0 / Task 0.2D design only.
- Repository: `C:\Users\Administrator\cse-frontend`.
- Branch: `main`.
- Baseline HEAD: `b73a85bcdf428aaca6101f50767d2d320cac9be7` (`docs: record P0-002 production precheck`).
- Current HEAD during this design: `b73a85bcdf428aaca6101f50767d2d320cac9be7`.
- GSA-P0-001: **CLOSED**.
- GSA-P0-002 discovery: **COMPLETE**.
- GSA-P0-002 source containment: **DEPLOYED** at commit `3069e9f`.
- GSA-P0-002 production precheck: **COMPLETE**.
- Orphan reconciliation: **NOT REQUIRED BASED ON CURRENT PRODUCTION PRECHECK**.
- GSA-P0-002 overall status: **CONTAINED — NOT FULLY RESOLVED**.
- P0-003: **NOT STARTED**.

The production precheck observed 32 direct foreign keys to `User`, all 32 configured as `ON DELETE CASCADE`. It observed zero users matching either legacy purge predicate, zero inspected financial/audit exposure for eligible users, and zero orphans in the four checked logical-reference classes. Those counts are point-in-time evidence only. They do not remove the destructive FK configuration or prove that future eligible or orphaned rows cannot appear.

This report is a source-based design. It does not authorize or perform application changes, schema changes, migrations, SQL, production access, data mutation, user anonymization, deployment, staging, committing, or pushing.

## 2. Current lifecycle summary

The current source represents user lifecycle through overlapping fields rather than one explicit terminal state:

- Active accounts normally have `deletedAt = null`; `isBanned` is independently available for administrative bans.
- The recovery soft-delete helper sets `isBanned = true`, writes a `[SOFT_DELETED]` free-text `banReason`, clears `activeSessionId`, and sets `deletedAt` and `deletedBy`.
- One restore helper clears `isBanned`, `banReason`, `deletedAt`, and `deletedBy`. The recovery API's separate restore path clears only `isBanned` and `banReason`, leaving lifecycle fields divergent.
- Both former application-level physical User purge implementations are now fail-closed. Non-User cleanup remains separate.
- There is no user-facing Delete Account route.
- No explicit `anonymizedAt`, anonymization version, or terminal account-state field exists.

Current authentication does not make the present soft-delete fields a complete fail-closed account state:

- Login verifies email/password and email verification but does not reject `isBanned` or `deletedAt`.
- Forgot-password, reset-password, resend-verification, and verify-email do not consistently reject deleted/banned lifecycle state.
- `getAuthenticatedUser` verifies the JWT and that the User row exists, but does not reject banned/deleted state or compare the token session ID with the database session ID.
- `/api/auth/me` checks concurrent-session mismatch only when both the token and database session identifiers are non-empty. Clearing `activeSessionId` to null is therefore not, by itself, a universal JWT cutoff.
- The request proxy validates JWT signature/expiry without querying live User state. It cannot be the sole terminal-state enforcement point.

The future lifecycle must therefore be explicit and enforced by every credential issuance, credential recovery, verification, server authentication, session refresh, and protected mutation path. Cookie deletion is only client cleanup; it is not revocation.

## 3. User field classification

Classification legend:

- **A** — Direct PII
- **B** — Authentication credential/state
- **C** — Authorization/security state
- **D** — Subscription/entitlement state
- **E** — Operational/account metadata
- **F** — Historical/audit linkage
- **G** — Non-sensitive technical state
- **H** — Unknown or requires policy decision

### 3.1 Scalar fields

The current `User` model has 21 scalar fields.

| Field | Type/current constraint | Class | Design significance |
| --- | --- | --- | --- |
| `id` | `String`, primary key, `cuid()` | F | Permanent pseudonymous actor/linkage key. It must not be changed or deleted by normal lifecycle handling. |
| `name` | nullable `String` | A | Direct identity; clear at tombstoning. |
| `email` | required unique `String` | A | Direct identity and login key; replace with a non-routable collision-safe alias. |
| `password` | required `String` | B | Credential; replace with a valid hash of an unrecoverable random value. |
| `role` | `USER` or `ADMIN` | C | Privilege boundary. Normal anonymization accepts only `USER`; preserve role rather than hiding an authorization error. |
| `isPaid` | required `Boolean` | D | Live entitlement; disable at account closure/tombstoning. Historical purchase evidence remains in financial records. |
| `paidUntil` | nullable `DateTime` | D | Live entitlement horizon; clear when entitlement is terminated. |
| `planType` | nullable `String` | D | Current account entitlement label; clear. Historical transaction plan values remain unchanged. |
| `isBanned` | required `Boolean` | C | Current security/lifecycle block. Tombstone keeps it true, but this cannot be the only terminal marker. |
| `banReason` | nullable free-text `String` | H | Can contain actor identity, dates, or operational notes. Replace with a fixed non-PII machine reason. |
| `isEmailVerified` | required `Boolean` | B | Authentication state; set false. |
| `emailVerificationToken` | nullable unique `String` | B | Credential; clear. |
| `emailVerificationExpires` | nullable `DateTime` | B | Credential state; clear. |
| `passwordResetToken` | nullable unique `String` | B | Credential; clear. |
| `passwordResetExpires` | nullable `DateTime` | B | Credential state; clear. |
| `activeSessionId` | nullable `String` | B | Session-revocation input. Rotate to a fresh server-only random marker and require central equality checks. |
| `lastActiveAt` | nullable `DateTime` | E | User activity metadata; clear. |
| `createdAt` | required `DateTime` | E | Account chronology; preserve. |
| `updatedAt` | auto-updated `DateTime` | E | Operational chronology; allow the tombstone transaction to update it. |
| `deletedAt` | nullable `DateTime` | E | Reversible soft-delete timestamp. Preserve an existing value; otherwise set at closure. It is not the terminal marker. |
| `deletedBy` | nullable `String` | H | May contain a User ID, email, or free text. Replace with a non-PII categorical value during tombstoning. |

### 3.2 Relation fields

| User relation field | Related model/role | Class | Tombstone relevance |
| --- | --- | --- | --- |
| `results` | `ExamResult[]` | H | Personal performance history; technically retainable under the tombstone, but retention needs an approved purpose. |
| `streak` | `UserStreak?` | H | Personal behavioral state; recommended deletion. |
| `bookmarks` | `Bookmark[]` | H | Private preference data; recommended deletion. |
| `examDraft` | `ExamDraft?` | H | Private unfinished answers/content; recommended deletion. |
| `transactions` | `Transaction[]` | F | Financial evidence; preserve and keep resolvable. |
| `mistakes` | `UserMistake[]` | H | Personal learning history; recommended deletion unless an approved retention purpose exists. |
| `dailyQuestionAttempts` | `DailyQuestionAttempt[]` | H | Personal learning history; recommended deletion. |
| `questionFlags` | `QuestionFlag[]` | F | Moderation/content-quality evidence; retain pseudonymously unless policy approves deletion. |
| `badges` | `UserBadge[]` | H | Product progress; recommended deletion. |
| `sentClassmateRequests` | sender side of `ClassmateRelation` | H | Social graph; recommended removal at tombstoning. |
| `receivedClassmateRequests` | receiver side of `ClassmateRelation` | H | Other users are involved; relationship removal is recommended without deleting the other User. |
| `directMessageParticipants` | `DirectMessageParticipant[]` | H | Private communication structure; policy decision required. |
| `sentDirectMessages` | `DirectMessage[]` | H | Private content; default design clears authored content but preserves a minimal structural shell. |
| `hostedRooms` | hosted `StudyRoom[]` | H | Shared object ownership; archive/close or transfer according to product policy. |
| `roomParticipants` | `StudyRoomParticipant[]` | H | Social participation; remove future access, with historical retention policy-dependent. |
| `roomMessages` | `StudyRoomMessage[]` | H | User-generated chat content; default design clears authored content. |
| `hostedEvents` | hosted `StudyEvent[]` | H | Shared object ownership; cancel/archive or transfer before terminal state. |
| `eventRSVPs` | `StudyEventRSVP[]` | H | Social participation; recommended removal for future events. |
| `ownedClubs` | owned `StudyClub[]` | H | Shared object ownership; transfer safely or archive, never leave an active club operationally dependent on a closed account. |
| `clubMemberships` | `StudyClubMember[]` | H | Social membership; remove active membership. |
| `studyProfile` | `StudyTogetherProfile?` | A | Contains display name, avatar, demographics, biography, interests, availability, and presence; delete. |
| `studyPosts` | authored `StudyPost[]` | H | Public/semi-public content; recommended pseudonymous retention, subject to human policy. |
| `studyPostComments` | authored `StudyPostComment[]` | H | Public/semi-public content; recommended pseudonymous retention, subject to human policy. |
| `studyPostReactions` | `StudyPostReaction[]` | H | Low-value behavioral data; recommended deletion. |
| `referralCode` | `ReferralCode?` | F | Attribution root; preserve its row/ID, anonymize the visible code, and disable future use. |
| `referredAttribution` | referred side of `ReferralAttribution?` | F | Financial attribution evidence; preserve. |
| `inviterAttributions` | inviter side of `ReferralAttribution[]` | F | Financial attribution evidence; preserve. |
| `invitedReferrals` | inviter side of `Referral[]` | F | Reward/payment provenance; preserve. |
| `receivedReferral` | referred side of `Referral?` | F | Reward/payment provenance; preserve. |
| `earnedRewards` | inviter side of `ReferralReward[]` | F | Immutable financial reward evidence; preserve. |
| `generatedRewards` | referred side of `ReferralReward[]` | F | Immutable financial reward evidence; preserve. |
| `payouts` | `ReferralPayout[]` | F | Settlement and payout evidence; preserve, with embedded payout PII governed separately. |

## 4. External PII inventory

This inventory is based on current schema and source usage. Unless identified as external storage, the listed models/fields are defined in `prisma/schema.prisma`; relevant writers/readers were inspected in `src/`. “Prohibited” means ordinary account tombstoning must not delete the record because it is financial/audit critical or belongs to another user/shared structure. It is not a legal retention-period claim.

| Model or storage | PII-bearing fields or content | PII type | Reference form | Delete in tombstone transaction? | Can anonymize? | Retention policy required? | Anonymization/retention design |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `StudyTogetherProfile` | `displayName`, `avatar`, `ageRange`, `gender`, `bio`, goals, interests, preferences, availability, language, status text | Identity, demographic, profile, behavioral | Required `User` FK | Yes | Yes | No identified protected purpose | Delete the profile. No financial/audit purpose was found. |
| `ClassmateRelation` | Social graph between two User IDs | Relationship/behavioral | Two required User FKs | Yes, relationship rows | Yes, by deletion | Product policy | Remove relationships involving the tombstone; do not alter the other User. |
| `DirectMessageParticipant` / `DirectMessage` | Conversation membership and private `content`; reply graph | Private communication, relationship | Required User FKs | Policy-dependent | Yes, clear/delete content | Yes | Default: clear authored content to a fixed placeholder and retain only the minimum message/conversation structure needed by the other participant; remove active participation/access. |
| `StudyRoom`, `StudyRoomMessage`, participants | User-authored room name/description/topic/image/meta and chat `content` | User-generated content, images, relationship | Required User FKs | Mixed | Yes, model-aware | Yes | Clear authored chat; close/archive rooms or transfer ownership. Images/meta/free text require explicit erasure review. |
| `StudyEvent`, RSVP | Event title/description, participation | User-generated content, behavioral | Required User FKs | Mixed | Yes | Yes | Cancel/archive or transfer hosted events; remove future RSVP state. Historical shared records are policy-dependent. |
| `StudyClub`, membership | Club name/description and social membership | User-generated content, relationship | Required User FKs | Mixed | Yes | Yes | Transfer ownership under an approved deterministic rule or archive; remove active membership. |
| `StudyPost`, comments, reactions | Public/semi-public titles, content, spoiler content, comments, behavioral reactions | User-generated content, behavioral | Required User FKs | Mixed | Yes, pseudonymize/delete | Yes | Default: retain posts/comments pseudonymously under “Deleted User”; delete reactions. Free text may still contain self-disclosed PII and needs a removal/reporting path. |
| `ExamResult`, category results | Scores, answers/details JSON, timestamps | Educational/behavioral history | Required User FK | Policy-dependent | Yes, delete or retain pseudonymously | Yes | Can remain pseudonymously linked, but recommended default is deletion of User-linked performance unless a documented analytics/education purpose is approved. |
| `DailyQuestionAttempt`, `UserMistake`, `UserStreak`, `UserBadge`, `Bookmark`, `ExamDraft` | Behavioral history, answers, preferences, draft JSON | Educational/behavioral/preference | Required User FKs | Yes by default | Yes, by deletion | Product/privacy policy | Delete private product-state rows; use only separately de-identified aggregates for analytics. |
| `QuestionFlag` | Reason and free-text notes | User-generated moderation content | Required User FK | No by default | Yes, redact/pseudonymize | Yes | Retain pseudonymously for moderation integrity; review notes for unnecessary PII under a policy. |
| `Notification` | Target User ID, titles/messages that may reproduce support/social content | Communication, behavioral | Logical nullable `userId` | Yes for target user | Yes, by deletion | Low unless a material event is copied | Delete user-targeted notifications. Broadcast notifications remain. |
| `SupportTicket` | `userEmail`, subject, message, admin notes | Contact identity, private communication | Logical `userId` plus copied email | Not automatically | Partly; alias/redact/delete | Yes | Replace copied email with the alias. Text may contain PII; retain restricted only for the approved support period, then delete or redact under policy. |
| `LoginHistory` | copied `email`, IP address, user agent, reason | Contact identity, network/device, security | Logical nullable `userId` plus copied email | Not automatically | Yes | Yes | Replace email with alias; clear or approved-transform IP/user agent; preserve status/time only for an approved security period. No current creation path was found in the inspected source, but existing rows and admin reads exist. |
| `ActivityLog` | User ID, free-text JSON metadata, IP address | Pseudonymous actor, network, behavioral | Logical nullable `userId` | No for audit-relevant events | Yes, fieldwise | Yes | Preserve action/time and pseudonymous User ID; clear IP and fieldwise-scrub metadata. Delete low-value activity after approved retention. |
| `Transaction` | User ID, checkout/payment identifiers, receipt URL | Pseudonymous actor, financial/provider identifiers | Required User FK | Prohibited | Only approved embedded-field redaction | Yes | Preserve row, monetary values, status, plan, and linkage. Provider identifiers/receipt URLs require restricted retention policy, not automatic deletion. |
| PayMongo request/webhook data | User ID and provider metadata exist in request/provider payloads; no durable webhook-event Prisma model was found | Financial/provider metadata | External provider/log boundary | Outside transaction | Provider-dependent | Yes | Do not assume provider erasure. Establish provider/log retention separately; never call the provider during anonymization. |
| `ReferralCode` | Visible code may be derived from name/email | Derived identity/attribution | Required User FK | Prohibited | Yes, visible code only | Yes for attribution record | Preserve ID and relations; set inactive and replace visible code with a random non-PII unique code. |
| `ReferralAttribution` | IP address, user agent, inviter/referred identities | Network/device, relationship, financial attribution | Two required User FKs | Prohibited | Yes, embedded network fields | Yes | Preserve attribution IDs/links; clear or approved-transform IP/user agent after the fraud/audit retention decision. |
| `Referral`, `ReferralReward` | User IDs, payment/reward/risk fields, free-text risk/reversal notes | Financial relationship, risk notes | Required User FKs | Prohibited | Partly, free text only | Yes | Preserve financial state and links. Scrub free-text only through an approved, field-specific redaction policy. |
| `ReferralPayout` | encrypted account number, account name, bank, notes, processor ID, transfer reference | Financial identity, bank/payout, actor | Required User FK; logical processor | Prohibited | Policy-dependent | Yes | Preserve payout and monetary/status history. Embedded payout identity is a human retention decision; keep encrypted/restricted until approved redaction is safe. |
| `ReferralAuditLog` | actor ID/role, target IDs, old/new state, reason, JSON metadata, IP | Audit actor, network, embedded free text | Logical scalars | Prohibited for material events | Yes, embedded fields only | Yes | Preserve event/action/amount/targets; keep User ID pseudonymous; clear IP and redact embedded identity without changing financial meaning. |
| `PartnerAttribution` | referred User ID and campaign source | Pseudonymous relationship/marketing attribution | Logical User scalar, Partner FK | Prohibited | Pseudonymous retention | Yes | Preserve and later add validated User FK protection. |
| `PartnerCommission` | transaction/partner attribution, amounts/status | Financial relationship | Indirect through Transaction | Prohibited | No User PII redaction identified | Yes for financial record | Preserve unchanged. |
| `PartnerPayout` | partner payout identity plus `processedBy` User-like scalar | Partner financial identity, actor | Logical processor scalar | Prohibited | Policy-dependent | Yes | Preserve settlement. Keep processor tombstone ID resolvable where it is a User. Partner PII follows partner policy, not User tombstoning. |
| `FinancialLedgerEntry` | User-like `createdBy`, free-text description, source IDs | Audit actor, financial narrative | Logical scalars; optional Transaction FK | Prohibited | Partly, free text only | Yes | Monetary, entry, source, and balance fields remain immutable. Redact free text only if approved and without breaking explanation. |
| `TaxRecord` | transaction/payout references and tax values | Financial/tax linkage | Optional Transaction FK plus logical payout IDs | Prohibited | No direct User PII identified | Yes for tax record | Preserve monetary/status/linkage. No direct User PII field was found. |
| `ReconciliationRecord` | User-like `reconciledBy`, source IDs, free-text discrepancy notes | Audit actor, financial narrative | Logical scalars | Prohibited | Partly, free text only | Yes | Preserve status/amount/source linkage; redact notes only under controlled policy. |
| `AccountingAuditLog` | actor ID/role, target IDs, old/new state, reason, metadata, IP | Audit actor, network, embedded free text | Logical scalars | Prohibited for material events | Yes, embedded fields only | Yes | Preserve event/action/amount/targets; clear IP and redact embedded PII without altering accounting meaning. |
| `RefundOperation` | transaction/actor IDs, payment/refund identifiers, free-text reason/errors | Financial/provider identifiers, audit actor, free text | Logical required scalars, no FK | Prohibited | Partly, free text only | Yes | Preserve operation, idempotency, amount, state, and provider trace. Redact only confirmed PII in free text under a reviewed policy. |
| `FinancialIdempotencyKey` | actor/resource identifiers and request hash | Pseudonymous actor, security/replay metadata | Polymorphic logical actor scalar | Prohibited | No ordinary redaction | Yes for replay record | Preserve for replay protection. Do not attach a blind User FK because actor domains include User, Partner, and system identities. |
| `InstitutionalVoucherCode` | redeemed User ID and entitlement dates | Pseudonymous beneficiary/entitlement | Logical nullable User scalar | Prohibited | Pseudonymous retention | Yes | Preserve redemption provenance and later add validated optional User FK protection. |
| Voucher batches | institution/contact names and email, creator ID | Contact identity, institutional metadata, actor | Logical creator scalar | Prohibited for issued batches | Policy-dependent | Yes | These may describe institution contacts rather than the tombstoned User. Apply separate institutional retention policy. |
| `PartnerApplication` | applicant/organization names, email, phone, social URL, free-text pitch | Contact, organization, social identity | No User relation | No automatic change | Yes under applicant process | Yes | It cannot be safely attributed to a User by schema. Handle through the partner-applicant retention process. |
| `BackupAuditLog` | actor ID, copied actor email, details, IP | Audit actor, contact, network, free text | Logical scalars | Prohibited for material events | Yes in live row when attributable | Yes | Replace copied email only in live rows when safely attributable; clear IP per policy; preserve the event. Historical backup copies are separate. |
| `BackupPayload` and backup vault objects | Raw snapshots include `prisma.user.findMany()` and other PII-bearing tables, including credential fields | Full copied database PII/credentials | Serialized database snapshot | Never in live transaction | Not by live-row transaction | Yes, separate backup policy | Live anonymization does not rewrite existing backups. Backup access, expiry, restore handling, and re-anonymization after restore require separate remediation. |
| Email delivery/provider records | Addresses, template parameters, message/provider IDs may exist outside Prisma | Contact/communication/provider metadata | External system | Outside transaction | Provider-dependent | Yes | No durable delivery-record Prisma model was found. Provider-side retention and suppression must be separately verified; the alias must never be mailed. |
| Application/admin logs | Emails, IDs, IPs, free text, and former identity values may be logged by current routes/services | Contact, network, actor, operational content | Log storage, not FK | Outside transaction | Log-system dependent | Yes | Future implementation must prohibit old/new identity values in logs and define log retention/redaction separately. |

Unknown free-text/JSON fields must never be bulk-rewritten with unreviewed string replacement. Redaction must be model-aware, preserve financial meaning, and be tested against synthetic fixtures.

## 5. Recommended tombstone state

The recommended terminal state is a permanent `User` row with an explicit `anonymizedAt` marker and anonymization version. The row remains the stable actor for financial, refund, referral, payout, voucher, ledger, reconciliation, and audit history, but cannot authenticate, receive email, hold entitlement, be restored, or appear as an active social identity.

Required terminal invariants:

1. `User.id` is unchanged and the row is never physically deleted by ordinary lifecycle code.
2. `anonymizedAt` is non-null and `anonymizationVersion` identifies the completed policy version.
3. Direct PII and credentials on `User` are removed or replaced irreversibly.
4. Email is a non-routable random unique alias; the original email is not stored in an alias map, audit event, log, metadata, or recovery table.
5. All credential issuance and authenticated request paths reject `anonymizedAt != null` before acting.
6. The active session marker is rotated, existing cookies are expired in the response, and every server-side authenticated path enforces live state plus session-marker equality.
7. Role is `USER`; any `ADMIN` target fails before mutation.
8. Live entitlement is disabled, while financial source rows remain unchanged.
9. Restore is permanently rejected.
10. Financial and audit references remain resolvable to the tombstone ID.
11. Social/exam/private-content disposition follows the approved policy version atomically.
12. Exactly one non-PII completion audit event exists for the version; retries do not duplicate it.

The display layer should render tombstoned identities as a constant such as **Deleted User**. It must not expose the alias email or use the internal User ID as a public display name.

## 6. Exact field-by-field and related-data disposition

### 6.1 User scalar fields

| Field | Disposition | Required result |
| --- | --- | --- |
| `id` | **PRESERVE** | Unchanged permanent pseudonymous key. |
| `name` | **CLEAR** | Set null. |
| `email` | **ANONYMIZE** | Replace with one random, persisted, non-routable unique alias under `.invalid`. |
| `password` | **DISABLE** | Replace with a valid bcrypt hash of a cryptographically random per-operation value that is never stored or returned. |
| `role` | **PRESERVE** | Must already be `USER`; reject `ADMIN`. |
| `isPaid` | **DISABLE** | Set false. |
| `paidUntil` | **CLEAR** | Set null. |
| `planType` | **CLEAR** | Set null. |
| `isBanned` | **DISABLE** | Set true as defense in depth. |
| `banReason` | **ANONYMIZE** | Replace with fixed value `ACCOUNT_ANONYMIZED`; no actor, email, timestamp, or old reason. |
| `isEmailVerified` | **DISABLE** | Set false. |
| `emailVerificationToken` | **CLEAR** | Set null. |
| `emailVerificationExpires` | **CLEAR** | Set null. |
| `passwordResetToken` | **CLEAR** | Set null. |
| `passwordResetExpires` | **CLEAR** | Set null. |
| `activeSessionId` | **DISABLE** | Replace with a fresh high-entropy revocation marker that is never issued in a new JWT. |
| `lastActiveAt` | **CLEAR** | Set null. |
| `createdAt` | **PRESERVE** | Keep original timestamp. |
| `updatedAt` | **PRESERVE** | Allow normal automatic update to record the terminal transition. |
| `deletedAt` | **PRESERVE** | Preserve an earlier soft-delete timestamp; if absent, set the closure timestamp. |
| `deletedBy` | **ANONYMIZE** | Replace with fixed categorical `ACCOUNT_ANONYMIZATION`; do not store an email or name. |
| proposed `anonymizedAt` | **PRESERVE** | Set once to the committed terminal transition time. Never clear. |
| proposed `anonymizationVersion` | **PRESERVE** | Set once to the approved policy version, initially `1`. |

### 6.2 Product and historical data

| Data | Disposition | Rationale |
| --- | --- | --- |
| Study profile and avatar | **DELETE** | Direct profile/demographic PII without identified financial purpose. |
| Referral code | **ANONYMIZE** and **DISABLE** | Preserve the ReferralCode row and linkage; replace visible code with a random unique tombstone code and set inactive. |
| Bookmarks and exam draft | **DELETE** | Private low-value preference/draft state. |
| Mistakes, streak, daily attempts, badges | **DELETE** by recommended default | Personal progress state; retain only separately de-identified aggregates if approved. |
| Exam results/category history | **REQUIRES POLICY DECISION** | Technically safe to retain pseudonymously; recommended default is deletion of User-linked rows absent an approved purpose. |
| Question flags | **RETAIN PSEUDONYMOUSLY** | Moderation evidence; notes remain subject to PII review. |
| Classmate relations and reactions | **DELETE** | Remove social graph/behavior without harming protected evidence. |
| Social posts/comments | **RETAIN PSEUDONYMOUSLY** by recommended default | Preserve shared discussion continuity under constant “Deleted User”; human approval is required. |
| Direct messages and room messages | **CLEAR** content by recommended default | Preserve minimal conversation/reply structure for other participants while removing authored private content. Human approval is required. |
| Hosted rooms/events | **REQUIRES POLICY DECISION** | Default: close/archive future activity and retain minimal history pseudonymously; transfer only through an explicit product rule. |
| Owned clubs | **REQUIRES POLICY DECISION** | Default: transfer to an eligible consenting member using deterministic authorization, otherwise archive. |
| Memberships/RSVPs/participants | **DELETE** for future/active participation | Historical shared participation is retained only if the approved social policy requires it. |
| Notifications | **DELETE** | User-targeted operational messages have no identified retention requirement. |
| Support history | **REQUIRES POLICY DECISION** | Replace copied email immediately; retain text restricted for an approved period, then redact/delete. |
| Login history | **REQUIRES POLICY DECISION** | Default: alias copied email, clear IP/user-agent, retain status/time pseudonymously for an approved security period. |
| Activity logs | **RETAIN PSEUDONYMOUSLY** for material events | Preserve action/time/User ID; clear IP and scrub metadata. Low-value events may expire under policy. |
| Payment, referral, reward, payout, tax, ledger, refund, reconciliation, voucher history | **PRESERVE** | Required for financial integrity, replay safety, provenance, settlement, and audit. Embedded PII is separately controlled. |
| Audit actor references | **RETAIN PSEUDONYMOUSLY** | Preserve stable actor/target IDs; copied email/IP/free-text PII must follow field-specific redaction policy. |

“DELETE” above means a future explicitly approved application transaction deleting only the listed child/product records. It never means deleting the `User` row or a protected financial/audit row.

## 7. Anonymized email design

All candidates use a domain under `.invalid`, which is intended for names that must not resolve or receive mail. The service must also suppress all email workflows for terminal users; the domain alone is not an authorization control.

| Option | Advantages | Risks |
| --- | --- | --- |
| `deleted+<userId>@invalid` | Simple, deterministic, naturally idempotent, no original email required | Exposes the stable internal User ID, permits correlation across leaks/screens, and publicly embeds a durable pseudonymous identifier. |
| Hash-based alias | Deterministic and compact | A plain hash of email is dictionary-testable and requires the old email on first derivation. HMAC of User ID avoids that but creates a permanent secret dependency and stable cross-system correlation. Truncation adds collision analysis. |
| Random alias persisted once | Does not reveal old email or User ID; no permanent derivation secret; negligible collision probability with sufficient entropy | Requires transactional first-write semantics and unique-collision retry. Idempotency depends on detecting the completed tombstone and preserving the first alias. |

**Recommendation: random alias persisted once.** Generate at least 128 bits of cryptographic randomness, encode it in a conservative lowercase form, and construct an address such as `deleted-<random>@users.invalid`. Do not include the original email, User ID, name, timestamp, referral code, or reversible ciphertext. Generate and store it only inside the first successful anonymization transaction. On replay, return terminal success without replacing it.

The database unique constraint remains the final collision guard. On the extraordinarily unlikely unique conflict, roll back and retry with new randomness; never fall back to an identifier-derived alias. The alias must not be returned to the user or included in logs/audit metadata.

## 8. Authentication and session revocation design

### 8.1 Fail-closed terminal checks

Create one server-side account-liveness policy and apply it consistently. A User is authenticatable only when all are true:

- `anonymizedAt` is null;
- the account is not soft-deleted (`deletedAt` is null and no approved soft-delete state is active);
- `isBanned` is false;
- the presented session ID exists and exactly matches `activeSessionId` for authenticated-session paths;
- all normal JWT signature, expiry, role, and route authorization checks pass.

The check must be enforced in login, JWT-backed server authentication, `/api/auth/me`, password/profile changes, email verification, resend verification, forgot/reset password, subscription/voucher mutations, social mutations, and every protected API. `verifyJWT` or the proxy alone cannot establish live account state because they do not query the User row.

Credential recovery endpoints should keep enumeration-resistant responses, but must not create/send tokens for soft-deleted or tombstoned users. Reset/verification token redemption queries must require live state in the same database operation that consumes the token.

### 8.2 Terminal credential state

- Replace the password with a valid bcrypt hash of a random secret generated for this transition and immediately discarded. Never use a shared tombstone password or a malformed sentinel that could cause comparison errors.
- Clear password-reset and email-verification tokens and expirations.
- Set `isEmailVerified = false`.
- Rotate `activeSessionId` to a fresh, server-only random revocation marker. Do not set only null while current conditional mismatch behavior exists.
- Clear `lastActiveAt`.
- Set `isBanned = true`, fixed `banReason`, and `anonymizedAt` in the same transaction.
- Expire the current `cse_session` response cookie after commit. This is cleanup, not the security boundary.
- Never issue a new JWT for the alias email or revocation marker.

Existing JWTs can contain the former email until they expire on the client. The server must reject them immediately through live-state and session-marker checks. No sensitive server-rendered or API behavior may rely on the proxy's signature-only acceptance as final authorization.

## 9. Admin and privileged-account protections

The current `User.role` enum contains only `USER` and `ADMIN`. Accounting authority is exercised through Admin/User actor IDs rather than an `ACCOUNTING` User role. Partner identities use a separate `Partner` model and partner JWT role, so User tombstoning must not be reused for Partner deletion.

Normal anonymization protections:

1. Resolve the target from the authenticated subject for self-service; do not accept an arbitrary target ID from the browser.
2. Lock/select the target row inside the transaction.
3. Require `role = USER` both after locking and in the conditional terminal update.
4. Reject `ADMIN` without modifying any field or child row.
5. Serialize role changes and anonymization against the same User row. The final update must fail if role or lifecycle state changed after the initial read.
6. Never demote an Admin to User as a shortcut to anonymization.
7. Do not allow batch jobs, Trash actions, or ordinary support tooling to bypass the same service.

Admin accounts require a separately approved break-glass lifecycle with two-person control, continuity of administrative access, audit/evidence handling, and session/signing-key impact analysis. Partner identities require a separate partner-retention design because they own commission, payout, rate, authentication, and contractual data.

## 10. Financial and audit preservation policy

| Model | User reference resolvable | Monetary values immutable | Status immutable during tombstoning | External identifiers | Embedded PII requiring policy | Later FK hardening |
| --- | --- | --- | --- | --- | --- | --- |
| `Transaction` | YES | YES | YES | Retain restricted: checkout/payment IDs and receipt URL, subject to provider policy | Receipt URL may be sensitive/capability-like | YES: User relation Restrict |
| `ReferralCode` | YES | N/A | Set `isActive=false`; otherwise preserve | Visible code may be replaced because ID linkage is authoritative | Code may derive from name/email | YES: User relation and child paths Restrict |
| `ReferralAttribution` | YES for inviter/referred User | N/A | YES | N/A | IP address and user agent | YES: both User relations and code relation Restrict |
| `Referral` | YES for both roles | YES | YES | Qualifying payment ID retained restricted | Risk notes/free text may contain PII | YES: both User relations and code relation Restrict |
| `ReferralReward` | YES for both roles | YES | YES | Transaction/referral IDs retained | Reversal reason may contain PII | YES: User, Referral, and Transaction relations Restrict |
| `ReferralPayout` | YES | YES | YES | Transfer reference retained restricted | Encrypted account number, account name, bank, notes | YES: User relation Restrict |
| `PartnerCommission` | Indirect User via Transaction must resolve | YES | YES | Transaction/Partner IDs retained | Reversal reason/campaign free text | YES: Transaction relation Restrict; Partner deletion is adjacent scope |
| `PartnerPayout` | Processor User ID should remain interpretable | YES | YES | Transfer reference retained restricted | Partner account identity, notes, processor scalar | Separate typed actor/FK design; Partner retention is adjacent |
| `FinancialLedgerEntry` | Source and creator must remain interpretable | YES | YES | Source IDs retained | `description`, `createdBy` | YES: linked Transaction should Restrict; actor typing separate |
| `TaxRecord` | Indirect sources must resolve | YES | YES | Transaction/payout source IDs retained | No direct User PII found | YES: linked Transaction should Restrict; payout scalars need design |
| `ReconciliationRecord` | Sources/actor must remain interpretable | YES | YES | Source/matched IDs retained | `reconciledBy`, discrepancy notes | Logical constraints/typed actors require separate design |
| `RefundOperation` | YES for Transaction and actor where actor is User | YES | YES | Payment/refund/idempotency identifiers retained | Reason and error free text may contain PII | YES after domain/orphan validation |
| `FinancialIdempotencyKey` | Actor/resource must remain resolvable by domain | N/A | Immutable replay record | Request hash/resource/key retained | Actor may be User, Partner, or system | NO blind User FK; typed-actor design required |
| `InstitutionalVoucherCode` | YES when redeemed | Entitlement dates/status preserved | YES | Voucher code retained restricted | Redeemed User ID | YES: optional User Restrict FK after validation |
| Financial/referral/accounting audit logs | YES pseudonymously | YES where present | YES | Target/source IDs retained | IP, metadata, old/new state, reasons, copied identity | Typed actor/target design required; do not delete logs |

The tombstone transaction must not call PayMongo, a bank/payout provider, an email provider, or any other external side-effect service. It must not recalculate money, rewrite statuses, release/reverse rewards, revoke settled entitlements through financial mutations, or alter idempotency records. Live entitlement on `User` is disabled separately from immutable financial history.

## 11. Exam/history policy recommendation

Exam and learning records contain behavioral/personal history but are not financial evidence. Because the User row remains, all such rows could technically remain linked to a non-PII tombstone without breaking schema. Technical possibility is not itself a retention purpose.

Recommended default:

- Delete `ExamDraft`, bookmarks, mistakes, streak, badges, and daily question attempts in the anonymization transaction.
- Delete User-linked `ExamResult` and dependent category results unless the product/privacy owner explicitly approves pseudonymous retention for a documented analytics or educational purpose.
- If retention is approved, expose no User email/name/profile, render the actor as Deleted User where needed, restrict individual-level admin access, define an expiry, and prohibit re-identification through auxiliary data.
- Prefer separately generated de-identified aggregate statistics over retaining User-linked row-level history.
- Preserve `QuestionFlag` pseudonymously for moderation integrity, subject to free-text PII review.

This recommendation requires human approval because deletion affects user history and analytics, while retention affects privacy and re-identification risk.

## 12. Social-content policy recommendation

Four approaches were evaluated:

| Approach | Benefit | Risk/impact |
| --- | --- | --- |
| A. Delete all content | Strong minimization | Breaks shared discussions, reply graphs, rooms/clubs, and other users' context; current cascades can delete more than the target's own content. |
| B. Retain under Deleted User | Preserves shared context and structure | User-authored text can itself contain PII; indefinite retention may violate user expectations. |
| C. Erase private message content, preserve structural records | Protects private content while retaining conversation/reply integrity | Placeholder shells still reveal timestamps and relationship topology. |
| D. Policy-based mixed approach | Matches sensitivity and shared ownership | Requires explicit rules, UI states, tests, and careful transactional implementation. |

**Recommended default: D, a mixed approach.**

- Public/semi-public posts and comments: retain pseudonymously under constant Deleted User, with an erasure/reporting mechanism for PII in content.
- Private direct-message and room-chat content authored by the User: replace content with a fixed non-PII placeholder while preserving IDs, timestamps, reply references, and conversation integrity only as long as approved.
- Reactions and classmate relations: delete.
- Study profile and presence: delete.
- Active room/event ownership: close/archive or transfer through an approved rule before completion.
- Club ownership: transfer to an eligible consenting member under deterministic authorization, otherwise archive. Never auto-promote an arbitrary member.
- Memberships, invitations, and future RSVPs: remove active participation.

The report does not make the human decisions for public-content retention, private-message retention, shared-object transfer, or retention duration.

## 13. Idempotent anonymization transaction design

### 13.1 Conceptual transaction

The future service should execute one bounded database transaction at an isolation level and retry policy appropriate for serialization conflicts:

1. Accept a server-derived target User ID and an idempotency key/request identity. Complete recent reauthentication before entering the transaction.
2. Lock/select the exact User row. Do not load or log old PII outside the transaction.
3. Reject missing targets and all privileged roles. Recheck `role = USER` in the final conditional update.
4. If `anonymizedAt` is already non-null, verify terminal invariants and return a canonical replay result without changing the alias, timestamps, version, or audit event.
5. Confirm the account is eligible under the approved active/soft-delete/waiting-period policy.
6. Generate a random alias, random discarded password secret/hash, and random session-revocation marker. Treat a unique email conflict as a full rollback and retry.
7. Apply the approved field dispositions to `User`.
8. Apply approved child-data deletions/clears and model-aware PII redactions. Never update protected financial amounts, states, links, or idempotency data.
9. Disable/anonymize the ReferralCode without changing its ID or related records.
10. Create one non-PII audit event, for example action `USER_ANONYMIZATION_COMPLETED`, linked to the tombstone ID with policy version and categorical initiator only. Store no former/replacement email, name, IP, content, token, or free-text reason.
11. Verify row counts/invariants inside the transaction, then commit.
12. Only after commit, expire the request cookie and return a generic terminal result. Do not send email or invoke external providers.

The audit event may use a carefully constrained existing activity/audit facility if it can guarantee uniqueness and no PII. If no current model can guarantee one event per User/version, a later schema design must add an appropriate uniqueness mechanism before implementation rather than relying on log-message deduplication.

### 13.2 Required behavior matrix

| Scenario | Required behavior |
| --- | --- |
| First eligible request | One atomic terminal transition, one alias, one version, one audit event. |
| Repeated request | Return success/replay; do not rotate alias/hash/timestamp again or duplicate audit. |
| Concurrent requests | Row lock/serialization and conditional update allow one winner; later transaction observes terminal state and replays. |
| Failure before commit | Full rollback; old account/data remain consistently unchanged and retryable. No external side effects occurred. |
| Commit succeeds but response is lost | Retry observes `anonymizedAt` and returns replay without new mutation. |
| Active User | Under recommended lifecycle, first enter disabled soft-delete/waiting state; anonymize after the approved deadline or explicit immediate-closure policy. |
| Already soft-deleted User | Restore remains available only before deadline; after eligibility, transition atomically to tombstone. |
| Already anonymized User | Permanent non-restorable replay. |
| Admin target | Reject before any child/User mutation. |
| Role changes concurrently | Serialize on User row and require `role = USER` in terminal conditional update; abort on conflict. |
| User with transactions/refunds/payouts | Preserve every protected row/link/amount/status; only approved embedded PII redaction may occur. |
| User with social content | Apply the approved mixed policy in the same transaction; if shared-object transfer cannot be resolved, fail closed for human review. |
| Excessive per-user data/timeout | Fail without partial change. Perform counts-only preflight and use a reviewed asynchronous job design if necessary, while retaining single-transaction atomicity for the final transition. |

## 14. Proposed minimal schema fields

Recommended additive lifecycle fields on `User`:

| Field | Type | Nullability/default | Reason | Migration/backfill impact |
| --- | --- | --- | --- | --- |
| `anonymizedAt` | `DateTime?` | Nullable, no default | Unambiguous irreversible terminal marker distinct from reversible `deletedAt` and administrative `isBanned`. | Additive nullable column; existing rows remain null; no data backfill should be required. |
| `anonymizationVersion` | `Int?` | Nullable, no default | Identifies which approved field/content policy completed and supports safe future upgrade checks. | Additive nullable column; existing rows remain null; populated only by the future service. |

Do not add `closedAt`: `deletedAt` records closure/soft-delete entry and `anonymizedAt` records the irreversible terminal transition. Do not add `accountState` in the minimal first design: state can be derived without a broad enum migration:

- `anonymizedAt != null` → `ANONYMIZED/TOMBSTONED`
- otherwise approved soft-delete predicate → `SOFT_DELETED`
- otherwise → `ACTIVE` (with `isBanned` remaining an independent security restriction)

`RESTORED` is a transition back to ACTIVE, not a persistent state. If future product requirements create more terminal/suspension states, a reviewed `accountState` enum may become appropriate, but it is not required for the smallest safe P0-002 design.

No migration SQL is created or authorized here. The later migration must assess table size, lock behavior, deployed schema agreement, rollout order, and application compatibility even though the proposed fields are nullable/additive.

## 15. Future FK-hardening boundary

Source containment must remain deployed throughout design, migration, rollout, and verification. The point-in-time zero precheck is not permission to change constraints without a new reviewed migration plan.

### 15.1 Direct financial/audit User FKs — likely Restrict

The later P0-002 schema-hardening phase should prioritize these nine required direct relation edges:

1. `Transaction.userId -> User.id`
2. `ReferralCode.userId -> User.id`
3. `ReferralAttribution.referredUserId -> User.id`
4. `ReferralAttribution.inviterId -> User.id`
5. `Referral.inviterId -> User.id`
6. `Referral.referredUserId -> User.id`
7. `ReferralReward.inviterId -> User.id`
8. `ReferralReward.referredUserId -> User.id`
9. `ReferralPayout.userId -> User.id`

Recommended action: change Cascade to Restrict after application compatibility and disposable-database verification. Tombstoning retains the User, while Restrict provides defense in depth against an accidental direct delete.

### 15.2 Transitive financial paths

Separately review changing the following to Restrict so deletion of an intermediate record cannot erase or silently detach financial evidence:

- `ReferralAttribution.referralCodeId`
- `Referral.referralCodeId`
- `ReferralReward.referralId`
- `ReferralReward.transactionId`
- `PartnerCommission.transactionId`
- `FinancialLedgerEntry.transactionId` (optional relation can remain nullable, but a present link should not be silently set null by deletion)
- `TaxRecord.transactionId` (same principle)

Partner-to-commission/payout/profile/rate-history deletion is adjacent Partner-retention scope and must not be silently folded into User tombstoning.

### 15.3 Non-financial User FKs — policy-dependent

The remaining 23 direct User cascade edges cover exams, profiles, social graphs, messages, rooms, events, clubs, posts, comments, reactions, and private product state. Do not blindly change all of them. Their final action depends on the approved delete/retain/transfer policy and application behavior. A permanent tombstone prevents ordinary cascade execution, but shared-content ownership and accidental direct deletion still require explicit decisions.

### 15.4 Missing logical FKs

| Logical reference | Proposed boundary | Required prerequisite |
| --- | --- | --- |
| `RefundOperation.transactionId` | Required Transaction FK, Restrict | Re-run orphan/compatibility precheck; verify all production values and migration locking. |
| `RefundOperation.actorId` | Required User FK, Restrict only if actor domain is proven to be User/Admin User | Confirm no system/partner actor values; otherwise introduce typed actor design rather than an invalid FK. |
| `PartnerAttribution.referredUserId` | Required User FK, Restrict | Re-run orphan check and validate creation/deletion workflows. |
| `InstitutionalVoucherCode.redeemedBy` | Optional User FK, Restrict when non-null | Re-run orphan check and validate voucher lifecycle. |

`FinancialIdempotencyKey.actorId` and audit actor fields are polymorphic or system-capable. They must not receive a blind User FK. Preserve tombstone IDs and design typed actors separately.

## 16. API and product semantics

The product should call the operation **Close and anonymize account**, not promise physical deletion when financial/audit history and a permanent tombstone remain.

Future self-service semantics:

- Require an authenticated live `USER`; derive the target ID from the session.
- Require recent password confirmation or a dedicated recent-reauth proof. Do not rely only on an old seven-day cookie.
- Apply CSRF protection, rate limiting, explicit consequences, and a second confirmation step.
- Explain the waiting/restoration window, irreversible terminal point, retained financial records, and policy for public/private content in plain language before confirmation.
- Initial confirmation should disable login/sessions immediately and enter `SOFT_DELETED` under the recommended waiting-period model.
- Return a stable accepted/closure-pending response without revealing internal alias or retained identifiers.
- Repeated requests with the same terminal outcome should be idempotent.
- On completed anonymization, expire the current cookie and return a generic completion result. Restoration is permanently unavailable.
- Support/Admin UI may show lifecycle state, timestamps, version, and non-PII audit status. It must not reveal the alias as identity or retain former identity in free-text notes.
- Admins cannot use the normal endpoint. Privileged/support intervention follows a separately approved, audited process.

Anonymization must be irreversible at the application layer. The original email/name/password must not be stored in an application recovery table, reversible alias, metadata, or log. Backups remain a separately governed limitation.

## 17. Soft-delete, restore, and tombstone state machine

```text
ACTIVE
  |  close request + recent reauthentication
  v
SOFT_DELETED (login/session disabled; waiting period; no hard delete)
  |                                |
  | approved restore before        | deadline reached or approved
  | terminal transition            | immediate irreversible closure
  v                                v
RESTORED -----------------------> ANONYMIZED / TOMBSTONED
  |                                  |
  +---------- back to ACTIVE         +-- permanent; restore rejected
```

State rules:

- ACTIVE: no tombstone marker; account may be banned independently for security reasons.
- SOFT_DELETED: session and login disabled immediately; `deletedAt` records entry; restore is allowed only within the approved waiting period and only when `anonymizedAt` is null.
- RESTORED: clear all soft-delete markers consistently and issue no session automatically. User must authenticate again.
- ANONYMIZED/TOMBSTONED: `anonymizedAt` and version are set; credentials and PII are disposed; restore and reactivation always fail.

Recommended waiting-period default: retain the current 30-day concept until the human product/privacy owner approves a different duration. This is a product policy default, not a legal period.

Legacy User hard purge is replaced by an anonymization scheduler/job that selects only approved eligible rows and invokes the single service. Admin Trash should distinguish soft-deleted restorable Users from permanent tombstones. Tombstones show `canRestore = false` and expose no email/name. Future “purge” actions must process safe non-User cleanup only; they must never physically delete User.

The current two restore implementations must eventually be unified so both clear the same reversible fields and both reject `anonymizedAt != null`. That is an implementation requirement, not a change in this task.

## 18. Backup and retention limitation

Anonymizing live rows does not erase historical PII from existing database backups, storage-vault objects, provider systems, exported statements, logs, screenshots, or previously delivered email. Current backup source takes raw `User` rows and multiple PII-bearing tables into serialized snapshots, so backups can contain the former identity and credentials as they existed at backup time.

P0-002 implementation must not rewrite or silently delete backups. A separate approved backup policy/remediation must define access controls, encryption, retention, expiry, legal holds, deletion, restore authorization, and what happens when a pre-anonymization backup is restored. At minimum, restore procedures must preserve a durable list of terminal tombstone IDs/versions or reapply anonymization before restored data becomes available, without storing former PII in that list.

This report does not start or solve P0-003.

## 19. Disposable-database test matrix

Use a new isolated PostgreSQL database created from the exact migration chain, synthetic data only, external payment/email transports disabled or mocked, an explicit disposable-target guard, and teardown after evidence capture. Assert no logs contain synthetic old/new identity values beyond fixtures intentionally inspected inside the disposable environment.

| Test | Required assertion |
| --- | --- |
| Active User anonymization | Applies the approved active-to-soft-delete/terminal policy; no physical User delete. |
| Soft-deleted User anonymization | Preserves original `deletedAt`, sets terminal fields once, and cannot restore afterward. |
| Admin rejection | Zero User/child/audit mutation and deterministic forbidden result. |
| Privileged identity rejection | Partner and any future privileged domain cannot enter User service; no role demotion workaround. |
| Already anonymized replay | Same alias, timestamp, version, audit event count, and child state. |
| Concurrent anonymization | Exactly one transition; other request returns replay/conflict deterministically. |
| Concurrent role promotion | Either promotion or anonymization wins safely; anonymization never commits for an Admin. |
| Injected failure before commit | All User/child/audit changes roll back. |
| Response loss after commit | Retry returns replay with no duplicate mutation/event. |
| Email uniqueness | Existing aliases and forced unique collision are handled by rollback/retry; old email and User ID never appear in alias. |
| Password login rejection | Old password, random guesses, and alias login all fail without account-state leakage. |
| Forgot/reset rejection | No new token/email for tombstone; preexisting token is unusable. |
| Verification-token rejection | Preexisting verification token is unusable; resend produces generic response and no send. |
| Existing JWT rejection | Tokens minted before closure fail every protected server/API path immediately. |
| Session mismatch enforcement | Rotated marker is checked centrally, not only by `/api/auth/me`. |
| Entitlement disablement | `isPaid=false`, dates/type cleared; financial purchase rows remain unchanged. |
| Transaction/refund preservation | Counts, IDs, amounts, status, provider/idempotency links, and replay behavior are byte-for-byte preserved except approved PII redaction. |
| Referral/reward preservation | Attribution, referrals, reward amounts/rates/status/links remain; ReferralCode ID remains and visible code is anonymized/inactive. |
| Payout preservation | Amounts/status/links/transfer references remain; embedded identity follows fixture policy exactly. |
| Ledger equality preservation | Debit/credit totals, entry/source resolution, descriptions except approved redaction, and period links remain. |
| Tax/reconciliation preservation | Amounts/status/source resolution remain; only approved free-text PII redaction occurs. |
| Voucher preservation | Redemption and entitlement provenance still resolve to tombstone. |
| Audit-log behavior | One non-PII terminal event; material historical events remain; IP/copied identity redaction matches policy. |
| Exam-history delete policy | Draft/progress/results disposition exactly matches approved version and does not affect other users. |
| Exam-history retain policy variant | If approved, rows remain resolvable but display no identity and are access-restricted. |
| Public social-content policy | Posts/comments render as Deleted User or are deleted exactly as approved; replies and other users' content remain valid. |
| Private-message policy | Authored content is cleared/deleted exactly as approved; reply/conversation structure and other participant data remain consistent. |
| Shared room/event/club ownership | Transfer/archive is authorized and deterministic; unresolved ownership fails the whole transaction. |
| Restore after anonymization | Every restore/helper/API path rejects; terminal fields remain unchanged. |
| Large per-user dataset | Reviewed timeout/lock behavior; failure is atomic and retryable. |
| Zero physical User delete | Static and runtime checks find no application User `delete`/`deleteMany` in normal lifecycle. |
| No external provider calls | Payment, payout, email, analytics, and webhook transports receive zero calls. |
| No PII in logs | Former identity, alias, tokens, password material, message content, IP, and payout data are absent from logs/audit event. |
| Backup limitation | Live anonymization does not mutate backup objects; restore test remains blocked until the separately approved re-anonymization control exists. |

Before production rollout, also run source/type/build validation, migration validation, the full disposable matrix, counts-only preflight, query-plan/lock review, and a rollback rehearsal whose safe rollback keeps User purge disabled rather than restoring Cascade behavior.

## 20. Risks and unknowns requiring human decision

- Public posts, comments, private messages, room chat, shared clubs/events, support text, and free-form audit metadata can contain self-disclosed PII that cannot be safely found with a generic string replacement.
- Current authentication/state checks are inconsistent. Implementing the tombstone update without central live-state rejection would leave some preexisting JWT paths usable.
- Current restore paths diverge. A tombstone marker must be checked everywhere before any restore or unban.
- Random alias uniqueness and audit-event idempotency need transaction-level enforcement; current schema has no dedicated anonymization event uniqueness constraint.
- The recommended single transaction can become large for users with extensive messages/social history. Lock duration and statement limits require disposable load tests and production counts-only planning.
- Payout identity, provider identifiers, receipts, tax evidence, support history, security logs, and audit actor identity need business/privacy/legal retention decisions. This report invents no statutory duration.
- Financial free-text fields can contain PII, but unreviewed redaction could alter audit meaning. Default behavior is preserve/restrict until field-specific policy is approved.
- Internal User IDs are pseudonymous, not automatically anonymous. Access controls and correlation risk remain relevant.
- External PayMongo/email/provider records and already delivered messages are outside the database transaction.
- Existing backups contain raw snapshots. Live anonymization alone cannot satisfy backup erasure expectations.
- The production 32/32 Cascade configuration remains until a later migration is designed, approved, tested, and deployed.
- Missing logical FKs require renewed production prechecks immediately before migration; the prior zero counts are only point-in-time evidence.
- Admin and Partner lifecycles are separate privileged processes and must not be improvised through the User service.

## HUMAN DECISIONS REQUIRED

| Decision | Recommended default | Alternatives | Principal risk |
| --- | --- | --- | --- |
| Social posts/comments retention | Retain pseudonymously as Deleted User with removal/reporting path | Delete all; retain for fixed period; author-selective deletion | Retention may preserve self-disclosed PII; deletion damages shared context. |
| Direct/private message retention | Clear authored content, preserve minimal structural shell for a defined period | Delete messages; retain pseudonymously; recipient-controlled retention | Content is highly sensitive; deletion/clearing affects other participants and reply graphs. |
| Exam history retention | Delete User-linked row-level history; retain only de-identified aggregates | Retain pseudonymously for fixed purpose/period | Retention creates behavioral re-identification risk; deletion removes analytics/history. |
| Support-ticket retention | Alias copied email immediately; restricted retention for approved period, then redact/delete | Immediate deletion; permanent restricted retention | Tickets may contain PII and operational evidence in free text. |
| Login/activity-log retention | Preserve material action/status/time pseudonymously; clear IP/user-agent and scrub metadata under an approved period | Delete promptly; hash network data; retain restricted raw data temporarily | Too little retention weakens security investigation; too much retains tracking data. |
| Payout identity retention | Keep encrypted/restricted until settlement, dispute, tax, and audit policy permits redaction | Immediate redaction after settlement; separate financial identity vault | Premature redaction damages settlement/audit; indefinite retention increases exposure. |
| Payment-provider identifiers | Retain restricted while refund/reconciliation/audit workflows require them | Tokenize; expire receipt URLs; retain indefinitely | Deletion can break refunds/reconciliation; retention enables correlation or capability leakage. |
| Audit actor identity | Preserve tombstone User ID and actor role; remove copied identity/IP where safe | Permanent identity snapshot; fully anonymous actor | Full removal weakens accountability; identity snapshots undermine anonymization. |
| Backup retention | Separate fixed retention/access/expiry policy plus re-anonymization-on-restore control | Immediate backup rewrite/deletion; legal-hold exceptions | Old backups retain PII; rewriting/deleting can damage recovery and evidence. |
| Account closure waiting period | Keep current 30-day concept pending approval | Immediate irreversible closure; shorter/longer window | Longer period retains PII; immediate action increases accidental-loss/support risk. |
| Anonymized email strategy | Persist one random 128-bit alias under `.invalid` | User-ID alias; HMAC/hash alias | ID/hash strategies allow correlation; random strategy needs transactional collision handling. |
| Privileged-account lifecycle | Reject Admin; handle Admin and Partner through separate two-person break-glass policies | Allow senior-admin workflow in same service; disable-only indefinitely | A generic lifecycle can lock out administration or destroy financial/contractual accountability. |
| Room/event/club ownership | Transfer only to an eligible consenting owner; otherwise archive | Delete shared object; retain under tombstone owner; system ownership | Automatic transfer can grant unauthorized control; deletion harms other members. |
| Financial free-text redaction | Preserve restricted until model-specific redaction is approved | Clear all; generic pattern redaction | Clearing damages audit meaning; pattern replacement can miss or corrupt data. |

## Explicit implementation approval gate

**IMPLEMENTATION HAS NOT STARTED.**

Before any implementation, a human must explicitly approve:

1. the Human Decisions Required table outcomes and exact policy version;
2. the two proposed lifecycle fields and migration/rollout plan;
3. random alias format and collision/replay behavior;
4. central authentication/session-state changes and every affected caller;
5. exact child-table delete/clear/redaction operations;
6. financial/audit immutable-field allowlist and embedded-PII policy;
7. direct, transitive, non-financial, and missing-FK migration boundaries;
8. Admin and Partner break-glass exclusions;
9. disposable-database tests, load/lock limits, preflight, deployment, and rollback evidence;
10. backup/provider/log retention work as separately scoped remediation.

Source containment must remain deployed. No implementation, schema change, migration, production query, database mutation, anonymization, staging, commit, push, deployment, or P0-003 work is authorized by this design report.

============================================================
GOVSTUDYX PHASE 0 / TASK 0.2D DESIGN COMPLETE
GSA-P0-002
============================================================

BASELINE HEAD:
b73a85bcdf428aaca6101f50767d2d320cac9be7

CURRENT HEAD:
b73a85bcdf428aaca6101f50767d2d320cac9be7

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

TOMBSTONE DESIGN:
COMPLETE

USER FIELD INVENTORY:
COMPLETE

EXTERNAL PII INVENTORY:
COMPLETE

AUTH REVOCATION DESIGN:
COMPLETE

FINANCIAL PRESERVATION DESIGN:
COMPLETE

SOCIAL/EXAM POLICY:
REQUIRES HUMAN DECISIONS

MINIMAL SCHEMA CHANGE PROPOSED:
Add nullable `anonymizedAt DateTime?` and `anonymizationVersion Int?`, with no defaults or existing-row backfill.

FK HARDENING:
DESIGNED ONLY

IMPLEMENTATION STARTED:
NO

GSA-P0-002 STATUS:
CONTAINED — NOT FULLY RESOLVED

REPORT:
docs/audit/remediation/P0-002-TOMBSTONE-DESIGN.md

P0-003 STARTED:
NO

NEXT ACTION:
Human review and policy decisions before any implementation or schema change.

STOP.
