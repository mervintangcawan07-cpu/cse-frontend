# GovStudyX Codex Instructions

This is a live production application. Authentication, administration, payments,
referrals, partners, accounting, ledgers, reconciliation, database operations,
and deployment are safety-critical.

## Mandatory protections

- The current repository is the source of truth. Inspect the current files,
  references, consumers, Git state, and relevant configuration before modifying
  anything. Do not rely on prior conversations, model memory, screenshots, or
  assumed framework conventions.
- Protect all pre-existing user changes. Never overwrite, revert, delete, stage,
  or commit them unless the human explicitly authorizes it.
- Make only the smallest change required by the current task. Do not perform
  unrelated refactors, formatting, renames, redesigns, package changes, or
  architectural replacements.
- Never expose, print, copy, log, or commit secrets, credentials, tokens,
  passwords, connection strings, or environment-file contents.
- Environment files such as `.env` and `.env.local` may be detected or listed by
  filename, but do not read, print, summarize, copy, or expose their values unless
  the current task specifically requires a particular variable and the human
  explicitly authorizes that access. Never display secret values in reports.
- Never weaken authentication, server-side authorization, RBAC, session or
  cookie security, validation, rate limiting, CSRF protection, or other security
  controls. Never compromise, delete, or lock out administrative access.
- Treat payments and all financial operations as safety-critical. Preserve
  server-side verification, webhook validation, entitlement checks, auditability,
  and financial POST idempotency. Never trust frontend payment success alone.
- Protect referral, partner, commission, accounting, ledger, reconciliation, and
  settlement behavior. Do not change financial meaning, balances, ownership,
  attribution, or audit history without explicit human approval and impact review.
- Never modify production data or production services without explicit human
  approval. Never infer production authorization from a request to edit code.
- Never perform destructive database or Prisma operations without explicit human
  approval. This includes deleting data, models, columns, migrations, or seeds;
  dropping or resetting databases; `prisma migrate reset`; destructive migration,
  push, or seed operations; and production schema changes.
- Do not install, remove, or upgrade dependencies unless required by the task and
  explicitly approved after impact analysis.
- Do not automatically commit, amend, push, force-push, deploy, rewrite history,
  reset, clean, restore, or roll back. A commit, push, deployment, or rollback
  requires explicit authorization for that action.

## Workflow

1. Inspect the environment, branch, HEAD, full Git status, target files, relevant
   references, and affected critical paths.
2. Before significant changes, report the proposed files, impacts, risks,
   database/API/auth/dependency effects, preserved behavior, and validation plan;
   then wait for explicit human approval.
3. Stop and request direction when requirements are ambiguous or when an action
   is destructive, security-sensitive, production-impacting, unexpectedly broad,
   or may damage existing work.
4. Implement minimally. Preserve existing behavior unless removal or replacement
   is explicitly requested.
5. Re-read changed files and inspect `git status`, `git diff --stat`, `git diff`,
   and `git diff --check`. Investigate unexpected size, deletion, encoding,
   formatting, or line-ending changes.
6. Run task-appropriate tests and verification. Inspect `package.json` before
   selecting commands. Report commands that were not run as NOT VERIFIED.
7. Before committing, `npx tsc --noEmit` and the production build must pass with
   zero errors unless the human explicitly waives a check after being told the
   risk. Run lint and relevant tests when applicable. Never claim success for a
   command or behavior that was not actually verified.
8. Report modified, created, deleted, and renamed files; database, security, and
   production impact; validation results; unresolved failures or risks; Git
   status; and commit/deployment status. Use VERIFIED, PARTIAL, FAILED, BLOCKED,
   or NOT VERIFIED accurately.

## Next.js

This is not necessarily the Next.js represented by model training data. Before
writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`.
Follow the installed version’s APIs, conventions, file structure, and deprecation
notices.
