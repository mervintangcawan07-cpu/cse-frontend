# GovStudyX Codex Instructions

GovStudyX is a live production application. Authentication, administration,
payments, referrals, partners, accounting, ledgers, reconciliation, database
operations, and deployment are safety-critical.

## 1. Authority and current state

- The current repository is the source of truth. Inspect actual files and current
  behavior; do not rely on prior conversations, model memory, screenshots,
  examples, remote copies, or assumed framework conventions.
- The human may change the repository between Codex tasks using PowerShell, VS
  Code, Antigravity, Claude, or other tools. At the start of every development
  task, automatically determine the current branch, HEAD, and full working-tree
  status. Never assume remembered Git or filesystem state is still current.
- The human does not need to announce a manual branch creation or switch, ask for
  Git verification, restate this file, or repeat the no-push/no-deploy rules.
- Do not edit application source directly on `main` unless the human explicitly
  authorizes that work on `main`. If application work is requested while on
  `main` without that authorization, stop and request a branch decision.
- Protect pre-existing modified, staged, and untracked user work. Never overwrite,
  revert, delete, stage, or commit it unless explicitly authorized.

## 2. Inspection and context efficiency

- Inspect before modifying. Read each target file and the relevant imports,
  exports, references, consumers, routes, models, queries, authorization, error
  handling, and behavior that must be preserved.
- Use targeted inspection. Do not repeatedly scan the whole repository, reread
  unrelated files, or reread `GEMINI.md` when this file and focused inspection
  are sufficient.
- Recheck references before changing or removing shared components, functions,
  APIs, routes, models, schema elements, utilities, hooks, or services.
- Be efficient with commands, output, and context, but never sacrifice safety,
  correctness, required inspection, or validation merely to reduce usage.
- For work continued from another agent, model, or tool, inspect current Git state
  and relevant files, identify completed and incomplete work, protect existing
  changes, and continue from reality rather than assumptions.

## 3. Planning, approval, and scope

- Before significant changes, report the proposed files, intended behavior,
  database/API/auth/dependency/production impact, preserved functionality, risks,
  and validation plan; then wait for explicit human approval.
- A changed requirement invalidates the prior plan when it materially changes
  scope or risk. Re-inspect, update the plan, and obtain approval again.
- Make the smallest safe change that fulfills the current task. Do not perform
  unrelated refactors, formatting, renames, redesigns, package upgrades, cleanup,
  or architectural replacement.
- Preserve existing functionality unless removal or replacement is explicitly
  requested. If a broader change is necessary, stop and explain why first.

## 4. Git, production, and recovery safety

- Before implementation, inspect branch, HEAD, status, and relevant recent
  history. Record the pre-change commit when changes are authorized.
- Never automatically use destructive or history-altering operations such as
  `git reset --hard`, `git clean -fd`, broad restore/checkout, amend, rebase,
  history rewrite, or force-push.
- Do not automatically stage, commit, push, deploy, roll back, or access production
  services. Each requires explicit authorization for that action. Authorization
  to edit code does not authorize a commit, push, deployment, database change, or
  production access.
- Never modify production data or services without explicit human approval and a
  scoped safety plan. Never infer production authorization from a development task.
- On failure, inspect status and diffs first. Do not automatically reset or roll
  back. Any recovery must protect pre-existing work and requires authorization.

## 5. Secrets and environment files

- Never expose, print, summarize, copy, log, or commit secrets, credentials,
  tokens, passwords, private keys, connection strings, or environment values.
- Environment files such as `.env` and `.env.local` may be detected or listed by
  filename, but do not read their values unless the current task specifically
  requires a particular variable and the human explicitly authorizes that access.
  Never display secret values in reports.
- Do not weaken validation, rate limiting, CSRF protection, security controls, or
  secret handling to simplify implementation.

## 6. Database and Prisma safety

- Before database-related work, inspect the Prisma schema, models, relations,
  indexes, migrations, seeds, queries, and affected services.
- Classify schema/data changes as additive, modifying, or destructive and analyze
  compatibility, rollout, and data impact.
- Never automatically delete records, models, columns, indexes, migrations, or
  seeds; drop or reset a database; run `prisma migrate reset`; perform destructive
  migration or `db push`; seed production; or alter production data/schema.
- Destructive or production database actions require explicit human authorization.
  Protect existing data, relations, uniqueness, audit history, and rollback paths.

## 7. Authentication, administration, and financial integrity

- Protect login, registration, sessions, cookies, password handling, middleware,
  protected routes, RBAC, user permissions, and administrative routes/accounts.
  Authorization must be enforced server-side. Never replace it with frontend-only
  checks or compromise, delete, demote, or lock out administrative access.
- Treat payments and all financial operations as safety-critical. Inspect payment
  creation, server-side verification, webhooks, statuses, records, entitlements,
  authentication, and authorization. Never trust frontend success alone or expose
  payment secrets.
- Preserve idempotency for every financial POST, webhook, retry, callback, credit,
  debit, settlement, or reconciliation operation. Do not remove or weaken unique
  constraints, idempotency keys, replay protection, transaction boundaries, or
  duplicate-detection behavior without explicit approval and impact analysis.
- Protect referral, partner, commission, accounting, ledger, reconciliation,
  payout, and settlement logic. Do not change financial meaning, balances,
  ownership, attribution, auditability, or historical records without explicit
  approval and focused verification.

## 8. API, dependency, configuration, UI, and performance safety

- Before changing an API, inspect request validation, response contracts,
  authentication, authorization, database queries, error handling, existing
  consumers, and frontend callers. Preserve compatibility when practical and do
  not break unrelated behavior.
- Do not install, remove, or upgrade dependencies or change configuration unless
  required by the task and explicitly approved after impact analysis. Inspect
  `package.json` and relevant installed documentation before selecting commands.
- Preserve the existing design language unless redesign is requested. When
  relevant, verify desktop, tablet, mobile, accessibility, loading, empty, error,
  and success states.
- Avoid regressions in query count, large-dataset handling, payload size,
  rendering, client/server boundaries, caching, images, and network requests.

## 9. Post-change review and validation

- Re-read every modified file. Confirm files are complete, imports/exports and
  behavior are correct, critical protections remain intact, and no accidental
  changes occurred.
- Inspect `git status`, `git diff --stat`, `git diff`, and `git diff --check` before
  completion or commit. Confirm every changed line is intentional, only task files
  changed, user work is protected, and no secrets or unexpected deletions appear.
- If a small task produces a large or surprising diff, stop and investigate file
  replacement, generation, formatting, encoding, BOM, Unicode, line endings, or
  deletion. Preserve existing encoding and line endings when practical.
- Run task-appropriate type checking, linting, tests, builds, and functional
  verification. Do not run irrelevant expensive checks for instruction-only or
  documentation-only changes when the human has waived them.
- Before committing application-code changes, `npx tsc --noEmit` and the
  production build must pass with zero errors unless the human explicitly waives
  a check after being told the risk. Run lint and relevant tests when applicable.
- If validation fails, capture the error, determine whether the task caused it,
  fix only safe in-scope causes, rerun the failed check, and report unresolved
  failures. Never ignore task-caused failures or claim success with critical
  failures outstanding.

## 10. Installed Next.js documentation

This is not necessarily the Next.js represented by model training data. Before
writing Next.js-specific code, read the relevant installed guide under
`node_modules/next/dist/docs/`. Follow the installed version's APIs, conventions,
file structure, and deprecation notices.

## 11. Stop conditions and reporting

- Stop and request human direction when approval is missing; repository state is
  unclear; required files cannot be read; requirements are ambiguous or conflict
  with current implementation; user work may be damaged; secrets may be exposed;
  security may be weakened; administrative access may be affected; or an action
  is destructive, production-impacting, or unexpectedly broad.
- Also stop for unexpected large diffs/deletions, destructive database needs,
  unresolved critical validation failures, or unsafe rollback requirements.
- Never claim a build, test, migration, feature, deployment, commit, or other
  result succeeded unless it was actually run and verified. Use VERIFIED,
  PARTIAL, FAILED, BLOCKED, or NOT VERIFIED accurately.
- Keep final reports concise: summarize changed files, preserved behavior,
  database/security/production impact, validation and functional verification,
  unresolved risks, final Git status, and commit/push/deployment status.
