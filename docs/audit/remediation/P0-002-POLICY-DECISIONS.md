# GSA-P0-002 Task 0.2D.1 Human Policy Decisions

## Status

- Task: **0.2D.1 — Human Policy Decisions**
- Decision status: **APPROVED**
- Policy version: **1**
- GSA-P0-002: **CONTAINED — NOT FULLY RESOLVED**
- Implementation authorized by this document: **NO**
- Schema change authorized by this document: **NO**
- Migration authorized by this document: **NO**
- Production database access authorized: **NO**
- P0-003 started: **NO**

## Approval

The human owner approved adoption of all recommended Task 0.2D.1 policy decisions derived from:

`docs/audit/remediation/P0-002-TOMBSTONE-DESIGN.md`

Approval statement:

**APPROVED — adopt all recommended Task 0.2D.1 policy decisions.**

These decisions define Policy Version 1 for the future GovStudyX User tombstone/anonymization lifecycle.

They do not authorize implementation by themselves.

## Approved Policy Version 1

| Decision | Approved policy |
| --- | --- |
| Public posts and comments | Retain pseudonymously under the constant display identity **Deleted User**. Provide a future removal/reporting path for self-disclosed PII. |
| Direct/private messages | Clear authored message content during terminal anonymization while preserving only the minimum structural records required for conversation/reply integrity. |
| Study-room chat | Clear authored message content using the same private-content principle while preserving only required structural integrity. |
| Exam results/history | Delete User-linked individual row-level exam history at terminal anonymization. Retain only genuinely de-identified aggregate analytics where separately produced. |
| Exam drafts | Delete. |
| Bookmarks | Delete. |
| Mistakes | Delete. |
| Streaks | Delete. |
| Daily question attempts | Delete. |
| Badges | Delete. |
| Study profile | Delete. |
| Avatar/profile identity | Delete. |
| Classmate/social relationships | Delete. |
| Social reactions | Delete. |
| Question flags | Retain pseudonymously for moderation integrity, subject to controlled free-text PII review. |
| Owned rooms/events | Transfer only through an explicitly authorized eligible-owner process; otherwise close/archive. |
| Owned clubs | Transfer only to an eligible consenting owner through deterministic authorization; otherwise archive. |
| Active memberships/RSVPs/participation | Remove active/future participation. |
| Notifications | Delete User-targeted notifications. |
| Support tickets | Replace copied email with the tombstone alias immediately. Retain restricted only for an approved operational period, with eventual redaction/deletion governed separately. |
| Login history | Preserve necessary security event/time state pseudonymously. Remove or approved-transform copied email, IP address, and user agent where safe. |
| Activity logs | Preserve material action/time and tombstone User ID pseudonymously. Remove IP and scrub embedded metadata under field-specific policy. |
| Transactions | Preserve. |
| Referral attribution/history | Preserve. |
| Referral rewards | Preserve. |
| Referral payouts | Preserve. |
| Partner commission financial linkage | Preserve. |
| Tax records | Preserve. |
| Financial ledger | Preserve monetary and source integrity. |
| Reconciliation records | Preserve. |
| Refund operations | Preserve. |
| Financial idempotency records | Preserve. |
| Voucher redemption history | Preserve. |
| Financial/audit actor identity | Preserve stable tombstone User ID where applicable. Remove unnecessary copied identity/IP/free-text PII only through reviewed field-specific redaction. |
| Payment-provider identifiers | Preserve under restricted access while operationally required for refunds, reconciliation, settlement, dispute, or audit workflows. |
| Payout identity | Preserve encrypted/restricted until a separately approved retention/redaction rule permits safe removal. |
| Financial free-text | Preserve restricted until model-specific redaction rules are approved. Do not use generic bulk string replacement. |
| Anonymized email | Generate one random persisted alias with at least 128 bits of cryptographic randomness under `.invalid`, for example `deleted-<random>@users.invalid`. Never derive it from the original email, User ID, name, timestamp, or referral code. |
| Password | Replace with a valid hash of an unrecoverable cryptographically random value that is never stored or returned. |
| Session state | Rotate the active session marker and require centralized live-account and session-marker validation. |
| Restore window | Preserve the current **30-day** soft-delete waiting-period concept. |
| Restore before terminal anonymization | Allowed only during the approved waiting period and while `anonymizedAt` is null. |
| Restore after terminal anonymization | Permanently prohibited. |
| Admin User lifecycle | Normal User anonymization must reject `ADMIN`. Admin lifecycle requires a separately approved break-glass process. |
| Partner lifecycle | Partner identities must not use the User tombstone service. They require a separate partner-retention/lifecycle design. |
| Backup retention | Existing backups are not rewritten by P0-002 anonymization. Backup retention, expiry, restore controls, and re-anonymization after restore are separate remediation/policy work. |

## Terminal User Identity Policy

The future terminal User record must:

- preserve the original `User.id`;
- contain no original name or email;
- use the approved random non-routable email alias;
- contain no reusable authentication credential;
- have all reset and verification credentials cleared;
- have live entitlement disabled;
- be permanently non-restorable;
- remain resolvable by protected financial and audit records;
- display publicly only as **Deleted User** where retained shared content requires an author label.

Internal alias email and User ID must not be exposed as the public Deleted User identity.

## Approved Lifecycle

```text
ACTIVE
  |
  | account closure request + approved reauthentication
  v
SOFT_DELETED
  |
  | 30-day waiting period
  |
  +---- approved restore before terminal transition ----> ACTIVE
  |
  | terminal anonymization
  v
ANONYMIZED / TOMBSTONED
  |
  +---- permanent; restoration prohibited
```

The 30-day duration is an approved GovStudyX product-policy default for this remediation. It is not stated as a statutory or legal retention requirement.

## Approved Minimal Lifecycle Schema Direction

Policy Version 1 approves the design direction for these future additive User lifecycle fields:

- `anonymizedAt DateTime?`
- `anonymizationVersion Int?`

The approved initial anonymization policy version is:

`1`

This document approves the policy direction only.

It does **not** authorize editing `prisma/schema.prisma`, generating a migration, applying a migration, or modifying production.

## Financial Integrity Rule

Terminal anonymization must never:

- physically delete the User;
- delete protected financial records;
- change historical monetary values;
- recalculate settled amounts;
- alter reward rates historically earned;
- change payout amounts;
- change tax amounts;
- change ledger balances;
- change reconciliation amounts;
- remove refund/idempotency provenance;
- invoke PayMongo, banks, payout providers, or other financial external services.

Only specifically approved embedded-PII redaction may occur, and only where it does not alter financial or audit meaning.

## Privacy and Content Rule

Generic string search/replacement across free-text or JSON content is prohibited.

Any future PII redaction must be:

- field-specific;
- model-aware;
- deterministic where appropriate;
- covered by synthetic fixtures;
- verified not to change protected financial/audit meaning.

## Backup Limitation

Live-row anonymization does not remove historical PII already contained in backups, logs, provider systems, exported documents, screenshots, or previously delivered communications.

P0-002 must not silently rewrite or delete backups.

Backup remediation remains separately scoped.

This policy record does not start P0-003.

## Implementation Gate

Task 0.2D.1 freezes the human policy choices needed for Policy Version 1.

Implementation has **NOT** started.

Before application or schema implementation, the next task must define a narrowly scoped implementation plan covering:

- lifecycle schema rollout;
- centralized terminal authentication enforcement;
- atomic/idempotent anonymization service;
- approved child-record dispositions;
- financial immutable-field protections;
- FK-hardening sequencing;
- disposable-database testing;
- migration and rollback safety;
- production rollout gates.

No implementation is authorized until that next plan is reviewed and explicitly approved.

============================================================
GOVSTUDYX PHASE 0 / TASK 0.2D.1 COMPLETE
GSA-P0-002
============================================================

POLICY DECISIONS:
APPROVED

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

GSA-P0-002 STATUS:
CONTAINED — NOT FULLY RESOLVED

P0-003 STARTED:
NO

NEXT ACTION:
Design and human review of the first narrowly scoped P0-002 implementation slice before any source, schema, migration, or production change.

STOP.
