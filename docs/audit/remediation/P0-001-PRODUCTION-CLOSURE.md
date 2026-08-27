# GSA-P0-001 Human-Operated Production Closure Procedure

## Purpose and authority boundary

This document preserves the human-operated production credential and session-containment runbook and records its completed outcome after the GSA-P0-001 source remediation. This documentation update is not authorization to access production, change credentials, alter environment variables, restart services, or deploy.

Never place an old or replacement password, JWT signing secret, session token, encryption key, or other credential in this document, source control, a ticket, chat, email, terminal command, shell history, screenshot, recording, application log, or deployment log.

Current status:

- SOURCE REMEDIATION: **RESOLVED**
- CURRENT-WORKTREE DOCUMENTATION CREDENTIAL EXPOSURE: **REMEDIATED**
- GIT-HISTORY CREDENTIAL EXPOSURE: **CONFIRMED**
- PRODUCTION PASSWORD ROTATION: **COMPLETED**
- PRODUCTION JWT_SECRET ROTATION: **COMPLETED**
- PRE-ROTATION ADMIN SESSION INVALIDATION: **VERIFIED**
- GSA-P0-001 FINAL STATUS: **CLOSED**

## Current implementation evidence

The procedure below is based on the current repository implementation:

- `src/app/api/user/profile/route.ts` verifies the current password, requires a new password of at least eight characters, hashes it with bcrypt cost 10, and updates the stored password.
- `src/app/profile/page.tsx` exposes that supported self-service flow through Account Settings.
- `src/app/api/auth/forgot-password/route.ts` and `src/app/api/auth/reset-password/route.ts` deliberately prevent the public reset flow from changing an `ADMIN` password.
- `src/app/api/auth/login/route.ts` issues a signed JWT lasting seven days and writes a new `activeSessionId` at login.
- `src/app/api/auth/logout/route.ts` only expires the `cse_session` cookie in the current browser.
- `src/app/api/user/profile/route.ts` does not change `activeSessionId` or revoke JWTs when the password changes.
- `src/app/api/auth/me/route.ts` checks `activeSessionId`, but only when the database value is present.
- `src/lib/serverAuth.ts`, `src/proxy.ts`, and `src/app/admin/layout.tsx` verify the JWT and user/role state without enforcing the database `activeSessionId` match.
- `src/lib/auth.ts` applies `USER_SESSION_INVALID_BEFORE` only when the JWT role is `USER`; it does not invalidate `ADMIN` sessions.
- `src/app/api/admin/users/action/route.ts` can clear `activeSessionId` during an administrator-initiated password reset, but current authorization paths do not make that a reliable administrator JWT revocation mechanism.
- `src/lib/auth.ts` and `src/lib/partnerAuth.ts` both use `JWT_SECRET`, so changing it invalidates main user/administrator JWTs and partner JWTs.
- `src/lib/crypto/encryption.ts` can fall back to `JWT_SECRET` when neither `ENCRYPTION_KEY_V1` nor `ENCRYPTION_KEY` supplies the encryption key. This must be ruled out before changing `JWT_SECRET`.

## Critical distinction: password rotation versus session invalidation

Password rotation changes the stored bcrypt password hash and prevents future authentication with the old password after the update succeeds.

Password rotation does **not** reliably revoke JWTs that were issued before the password changed. Those JWTs do not contain or re-check the password hash. Existing administrator JWTs can remain valid until expiration unless the JWT signing key is changed.

Logging out is not a global cutoff. The current logout endpoint clears only the `cse_session` cookie in the browser that performs logout. It does not invalidate cookies held by other browsers or devices.

Clearing or changing `activeSessionId` must not be treated as assured administrator-session revocation in the current implementation. `USER_SESSION_INVALID_BEFORE` must also not be treated as administrator protection because the code applies it only to `USER` JWTs.

Production closure therefore requires two separately verified outcomes:

1. Rotate the affected administrator password.
2. Invalidate previously issued administrator JWTs through a controlled signing-key rotation after satisfying the encryption-key prerequisite.

## Phase 1: authorize and prepare

1. Assign an incident owner, production operator, security reviewer, and an independent verifier. Use two-person control for all credential and signing-key changes.
2. Confirm the exact production environment and affected administrator account through an approved out-of-band channel. Record only a masked account identifier in the incident record.
3. Use an approved password manager to generate and store a unique, high-entropy replacement password. The application enforces a minimum of eight characters in the preferred self-service path; the organizational password policy should exceed that minimum.
4. Do not copy the replacement into source files, seed configuration, documentation, environment examples, terminal commands, scripts, deployment notes, or chat. Do not use `BOOTSTRAP_ADMIN_PASSWORD` or rerun the seed to rotate an existing account; the remediated seed intentionally does not change an existing account's password.
5. Use a trusted, patched operator device and a clean browser session. Disable screen sharing, recording, browser extensions that capture form contents, and diagnostic/network capture that could retain credentials.
6. Confirm that a separate recovery administrator or approved break-glass path is available before changing the affected account. Do not proceed if rotation could remove the only working administrative access.

## Phase 2: rotate the administrator password

Preferred supported method when the current password is available:

1. Sign in to the affected administrator account from the trusted browser.
2. Open `/profile`, select Account Settings, and use the Change Password fields.
3. Enter the current password and the replacement from the approved password manager; submit once.
4. Require the application to return a successful profile update. Do not capture the request body, response cookies, or entered values.
5. Treat this step only as password rotation. Do not mark session containment complete.

If the current password is unavailable or the preferred flow fails:

1. Stop rather than repeatedly attempting login and triggering account lockout.
2. Do not use the public forgot/reset-password flow; current code rejects administrator accounts.
3. A separate uncompromised administrator has a sudo-protected reset control under `/admin/users`, but it is a break-glass operation and must be separately approved, performed under two-person control, and protected from screen capture or shoulder surfing.
4. The administrator reset path clears `activeSessionId`, but this does not reliably revoke existing administrator JWTs. Continue to the controlled session-invalidation phase.
5. If neither supported path is safely available, escalate to the security owner and database/application owner for a separately authorized recovery plan. Do not improvise a direct database edit, seed execution, or source-code credential.

## Phase 3: satisfy the encryption-key prerequisite

Before recommending or performing any `JWT_SECRET` rotation, an authorized production configuration owner must verify all of the following without revealing values:

1. Production has a dedicated, non-empty `ENCRYPTION_KEY_V1` or `ENCRYPTION_KEY` configured on every application instance and background worker that reads or writes encrypted data.
2. Production encrypted data does not rely on the `JWT_SECRET` fallback in `src/lib/crypto/encryption.ts`.
3. The dedicated encryption key will remain unchanged throughout the JWT signing-key rotation.
4. A current, tested recovery procedure exists for the production configuration and deployment, and the incident owner understands that restoring the old JWT signing key can revalidate compromised JWTs.

Record only a signed attestation such as "dedicated encryption key verified on all production runtimes." Never record the key value.

If this prerequisite cannot be proven, **do not rotate `JWT_SECRET`**. Escalate immediately to the security owner, application owner, and encrypted-data owner. Keep the new administrator password in place, log out the controlled browser, preserve evidence without credentials, and create a separately reviewed plan to establish a dedicated encryption key and a safe session-cutoff mechanism. Do not guess, overwrite encryption configuration, or restore the compromised password.

## Phase 4: invalidate existing JWT sessions

After the encryption-key prerequisite is formally satisfied:

1. Schedule a controlled maintenance/redeployment window and communicate the authentication impact. Rotating `JWT_SECRET` invalidates all existing main user/administrator JWTs and all partner JWTs, not only the affected administrator session.
2. Generate and store a new JWT signing secret using the approved secrets manager. Never expose it in a command line, source file, `.env` file committed to the repository, ticket, log, or this runbook.
3. Update the production secret through the approved deployment platform under two-person control. Ensure every web instance, worker, and region receives the same new value.
4. Restart or redeploy all relevant runtimes so no instance continues accepting JWTs signed with the prior key. Do not perform a partial rollout that leaves mixed signing keys active.
5. Confirm readiness and application health using value-free health checks. Do not print environment variables or secret-manager contents.
6. Existing sudo tickets expire after ten minutes. If `SUDO_SECRET` is independently configured, follow the incident owner's separate decision for its rotation or wait for the full ticket lifetime before declaring privileged-session containment. Never assume `JWT_SECRET` rotation changes an independent `SUDO_SECRET`.

The production actions in this phase were completed by authorized human operators. This documentation task does not perform or authorize any production action.

## Phase 5: verify containment

Use separate clean private-browser sessions and do not inspect or copy cookies or JWTs.

1. In a fresh private session, attempt one login with the old administrator password. Expected result: authentication is rejected with the generic invalid-credentials response. Do not repeat the attempt because repeated failures trigger lockout controls.
2. In a different fresh private session, authenticate with the replacement password from the password manager. Expected result: login succeeds and the account is recognized as `ADMIN`.
3. Perform only a read-only administrator verification, such as loading the admin landing page. Do not perform a financial, account, schema, or data mutation as part of credential verification.
4. From a browser session that existed before the JWT signing-key rotation, request a protected page. Expected result: the session is rejected or redirected to login. Do not inspect or export the old cookie.
5. Verify that partner and ordinary user login can establish new sessions after the controlled rotation, because their prior JWTs were also invalidated.
6. Review approved authentication and login-history telemetry for unexpected access after the cutoff time. Record timestamps and masked identifiers only; never record passwords, JWTs, or signing keys.
7. Log out the verification browsers. Remember that logout only clears each browser's local cookie; the signing-key rotation is the actual global JWT cutoff.

## Failure, rollback, and escalation

- If the old password still authenticates, stop testing, confirm the account and environment, verify that the password update succeeded, and escalate. Do not retry repeatedly and do not restore the old password.
- If the replacement password fails, stop before lockout, use the approved recovery administrator or break-glass process, and escalate. Never write the replacement into a command or source file for diagnosis.
- If a pre-rotation JWT remains accepted, verify that every production instance was restarted/redeployed with one consistent new signing key. Treat any instance still accepting the old JWT as an active incident.
- If production encryption independence from `JWT_SECRET` cannot be proven, do not rotate the JWT signing key. Escalate for an encryption-key migration/recovery plan before session cutoff.
- If health or decryption failures appear after signing-key rotation, stop affected writes and invoke the approved incident-recovery plan. Do not casually restore the old JWT secret: doing so may revalidate compromised sessions. Any rollback requires the incident owner's explicit risk decision and must preserve the new administrator password.
- Prefer a reviewed fix-forward deployment. Do not change database data, encryption keys, or Git history as an improvised rollback.

## Closure evidence to record

The human incident record should contain only:

- environment name and maintenance window;
- masked affected-account identifier;
- operator and independent verifier identities;
- password rotation: pass/fail and timestamp;
- dedicated encryption-key prerequisite: verified/not verified, without values;
- JWT signing-key rotation and full runtime restart: pass/fail and timestamp;
- old-password rejection: pass/fail;
- replacement-password authentication: pass/fail;
- pre-rotation JWT rejection: pass/fail;
- user and partner reauthentication smoke checks: pass/fail;
- unresolved risks and escalation owner.

Never record the old password, replacement password, JWT signing secret, encryption key, reset token, session cookie, or JWT.

## Final production closure record

- SOURCE REMEDIATION: **RESOLVED**
- SOURCE REMEDIATION COMMIT: `27c1f40` — `security: remove hardcoded admin bootstrap credentials`
- SOURCE REMEDIATION DEPLOYED TO PRODUCTION: **VERIFIED**
- PRODUCTION PASSWORD ROTATION: **COMPLETED**
- OLD PASSWORD REJECTION: **VERIFIED**
- NEW PASSWORD LOGIN: **VERIFIED**
- PRODUCTION JWT_SECRET ROTATION: **COMPLETED**
- ALL PRODUCTION RUNTIMES REDEPLOYED: **VERIFIED**
- PRE-ROTATION ADMIN SESSION INVALIDATION: **VERIFIED**
- PRODUCTION HEALTH AFTER ROTATION: **UP**
- ENCRYPTED PRODUCTION DATA DEPENDENCY: **NONE FOUND**
- STAGE B KEY-COMPATIBILITY CHECK: **NOT REQUIRED FOR EXISTING DATA**
- GIT-HISTORY CREDENTIAL EXPOSURE: **CONFIRMED**
- GSA-P0-001 FINAL STATUS: **CLOSED**

The production readiness endpoint reported the application, database, and environment as UP after deployment and again after `JWT_SECRET` rotation. Production `ENCRYPTION_KEY_V1` remained unchanged.

The Stage A read-only inventory returned zero values for:

- `ReferralPayout.accountNumberEncrypted`
- `Partner.accountNumberEncrypted`
- `PartnerPayoutProfile.accountNumberEncrypted`
- `PartnerPayout.accountNumberEncrypted`
- `User.banReason`

All Stage A classifications were also zero: `ENCRYPTED_PREFIX_ANY`, `ENCRYPTED_FORMAT`, `ENC_V1`, `ENC_OTHER_VERSION`, `PLAINTEXT_OR_UNKNOWN_FORMAT`, and `MALFORMED_OR_UNKNOWN`. No existing production data required Stage B key-compatibility testing.

Production does not configure `SUDO_SECRET`. Current source therefore signs and verifies Sudo tickets with the `JWT_SECRET` fallback. The completed `JWT_SECRET` rotation invalidated outstanding Sudo tickets as well as pre-rotation user, administrator, and partner JWTs.

The historical credential exposure in Git remains **CONFIRMED**. Git history was not rewritten, and this document contains neither the historical credential nor any replacement secret.
