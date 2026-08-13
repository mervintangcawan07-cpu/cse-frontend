# 🚨 PERMANENT WEBSITE DEVELOPMENT MASTER PROMPT

# SAFE DEVELOPMENT • AUTOMATIC WORKFLOW • FILE PRESERVATION
# GIT SAFETY • DATABASE SAFETY • DIFF VERIFICATION • TESTING
# ROLLBACK • SECURITY • MINIMAL MODIFICATION

==================================================
PERMANENT AUTOMATIC DEVELOPMENT WORKFLOW
==================================================

These rules are PERMANENT and apply automatically to EVERY
development request in this repository.

The user does NOT need to repeat or reference this workflow.

The user's development request itself is considered the TASK
REQUEST.

The user must NOT be required to say:

"Use my permanent development workflow."

"Start with Phase 1."

"Follow my GEMINI.md."

"Inspect first."

The workflow must happen automatically.

Examples of development requests include:

- New features
- Bug fixes
- UI changes
- UX improvements
- Redesigns
- Refactors
- API changes
- Database changes
- Authentication changes
- Authorization changes
- Payment changes
- Security changes
- Performance improvements
- Configuration changes
- Dependency changes
- Study Together features
- Exam features
- Admin features
- User features

==================================================
AUTOMATIC TASK INTERPRETATION
==================================================

When the user provides a feature request, automatically interpret
it as:

USER REQUEST
↓
ENVIRONMENT CHECK
↓
GIT SAFETY CHECK
↓
READ-ONLY INSPECTION
↓
CURRENT CODE UNDERSTANDING
↓
DEPENDENCY / REFERENCE CHECK
↓
IMPACT ANALYSIS
↓
DATABASE SAFETY ANALYSIS
↓
IMPLEMENTATION PLAN
↓
STOP FOR USER APPROVAL
↓
IMPLEMENTATION
↓
POST-CHANGE INSPECTION
↓
DIFF VERIFICATION
↓
VALIDATION
↓
FUNCTIONAL VERIFICATION
↓
FINAL REVIEW
↓
COMMIT WHEN APPROPRIATE
↓
ROLLBACK INFORMATION
↓
FINAL REPORT

The user should only need to describe WHAT they want.

==================================================
ABSOLUTE APPROVAL RULE
==================================================

The workflow automatically performs inspection and planning.

However:

NO significant modification may occur before explicit user
approval of the implementation plan.

Approval examples:

"Yes"

"Proceed"

"Implement it"

"Go ahead"

"Approved"

"Do it"

If the user changes the requirements before approval:

STOP.

Re-evaluate the affected parts.

Update the plan.

Wait for approval again.

==================================================
MASTER DEVELOPMENT PHILOSOPHY
==================================================

The existing website is valuable existing work.

The responsibility is:

UNDERSTAND
→ PROTECT
→ PLAN
→ MODIFY SAFELY
→ VERIFY
→ TEST
→ DOCUMENT

The default assumption is:

EXISTING FUNCTIONALITY MUST REMAIN.

Never remove existing functionality unless the user explicitly
requests its removal or the implementation plan clearly
requires replacement.

==================================================
SOURCE OF TRUTH
==================================================

The actual files currently present in the repository are ALWAYS
the source of truth.

Never assume the project matches:

- Previous conversations
- Previous AI output
- Previous screenshots
- Previous code
- GitHub
- Memory
- Framework templates
- Example implementations
- Earlier versions

Before modifying an existing file:

INSPECT THE CURRENT FILE FIRST.

==================================================
ENVIRONMENT
==================================================

CURRENT DEFAULT ENVIRONMENT:

Windows
+
VS Code
+
Windows PowerShell

Unless the user explicitly says otherwise, use Windows
PowerShell-compatible commands.

FUTURE ENVIRONMENT:

GitHub Codespaces
+
VS Code
+
Codespaces/Linux terminal

When the user says they switched to Codespaces:

Immediately adapt terminal commands to the actual environment.

DO NOT weaken any safety rule when changing environments.

==================================================
ENVIRONMENT DETECTION
==================================================

At the beginning of a development task determine:

- Operating system
- Terminal
- Project directory
- Git availability
- Node version
- npm version
- Package manager
- Framework
- Database
- ORM
- Build system

Current default:

Windows PowerShell + VS Code.

==================================================
PHASE 0 — ENVIRONMENT CHECK
==================================================

Before implementation:

Determine the current environment.

When using Windows PowerShell, commands should be compatible
with PowerShell.

When using Codespaces, commands should be compatible with the
actual Codespaces terminal.

Never assume the environment.

==================================================
PHASE 1 — READ-ONLY PROJECT INSPECTION
==================================================

Immediately begin with read-only inspection.

DO NOT modify project files during this phase.

Inspect:

- Current directory
- Git repository
- package.json
- Project structure
- Relevant routes
- Relevant pages
- Relevant components
- Relevant APIs
- Services
- Utilities
- Database
- Prisma
- Authentication
- Authorization
- Payment systems
- Configuration
- Environment references
- Related features

Read GEMINI.md before performing development work.

Never modify anything during the inspection phase.

==================================================
PHASE 2 — GIT STATUS INSPECTION
==================================================

Run:

git status

Then:

git branch --show-current

Then:

git rev-parse HEAD

Then:

git log --oneline -5

Determine:

- Current branch
- Current HEAD
- Staged files
- Modified files
- Untracked files
- Pre-existing changes

Do NOT automatically modify or clean the repository.

==================================================
PRE-EXISTING CHANGE PROTECTION
==================================================

This is CRITICAL.

If files are already modified before the current task:

Treat those changes as:

PRE-EXISTING USER CHANGES

Do NOT:

- Reset them
- Restore them
- Delete them
- Overwrite them
- Stage them automatically
- Commit them automatically
- Assume they belong to the current task

Separate:

PRE-EXISTING CHANGES

from:

CURRENT TASK CHANGES

Never destroy user work.

==================================================
PHASE 3 — GIT BACKUP / RECOVERY CHECKPOINT
==================================================

IMPORTANT:

DO NOT automatically create a backup commit before every
development request.

A backup commit is NOT required for every:

- Small feature
- Bug fix
- UI adjustment
- Text change
- Styling change
- Minor component change
- Localized code modification

The purpose of a checkpoint is to provide a reliable rollback
point without unnecessarily polluting Git history.

--------------------------------------------------
CURRENT COMMIT
--------------------------------------------------

Always record:

git rev-parse HEAD

Store internally as:

PRE_UPDATE_COMMIT

This is the initial rollback reference.

--------------------------------------------------
WHEN A BACKUP COMMIT IS NOT REQUIRED
--------------------------------------------------

Do NOT create a backup commit when:

- The task is small.
- The task is localized.
- HEAD is already a reliable rollback point.
- The working tree is clean.
- The change can safely be committed as one normal task commit.
- A backup commit would unnecessarily clutter Git history.

In these cases:

Record PRE_UPDATE_COMMIT.

Continue with the normal workflow.

--------------------------------------------------
WHEN A SAFETY CHECKPOINT MAY BE APPROPRIATE
--------------------------------------------------

Consider a separate checkpoint for:

- Major architectural changes
- Large multi-file features
- Database schema changes
- Authentication changes
- Authorization/RBAC changes
- Payment changes
- Large API changes
- Large refactors
- Major UI redesigns
- Dependency upgrades
- Security-sensitive changes
- Changes affecting many critical systems

Before creating such a checkpoint:

1. Check Git status.
2. Identify pre-existing changes.
3. Ensure unrelated user work will not be included.
4. Explain why the checkpoint is recommended.
5. Request approval if staging/committing existing user work
   would be necessary.

NEVER create a checkpoint that captures unrelated user work.

--------------------------------------------------
NO ARTIFICIAL BACKUP COMMITS
--------------------------------------------------

NEVER create repetitive commits such as:

backup: before every feature

backup: temporary

backup: safety

backup: before update

unless an actual safety checkpoint is necessary.

Avoid unnecessary Git history pollution.

Preferred normal workflow:

ONE TASK
↓
IMPLEMENTATION
↓
VERIFICATION
↓
ONE FINAL TASK COMMIT

when practical.

==================================================
CURRENT PROJECT BASELINE
==================================================

Current known rollback point:

71e9f08 fix: route registration links to signup

Current branch:

main

Current known state:

Working tree clean at the time this baseline was established.

The local branch was one commit ahead of origin/main at that
time.

Do NOT:

- Amend this commit
- Rewrite this commit
- Reset this commit automatically
- Squash this commit automatically
- Force-push this commit

Treat it as a valid rollback point unless a newer approved
commit becomes the appropriate rollback point.

==================================================
DESTRUCTIVE GIT COMMANDS
==================================================

NEVER automatically execute:

git reset --hard

git clean -fd

git restore .

git checkout .

git push --force

git rebase

history rewriting commands

unless explicitly authorized.

Never automatically destroy user work.

==================================================
GITHUB / REMOTE SAFETY
==================================================

Inspect remote when relevant:

git remote -v

Never assume the remote.

Never force-push.

Never automatically push.

The user must explicitly instruct:

"push"

before executing git push.

==================================================
PHASE 4 — PROJECT STRUCTURE INSPECTION
==================================================

Inspect relevant project structure.

Identify:

- App routes
- Pages
- Components
- API routes
- Server actions
- Services
- Utilities
- Database
- Prisma
- Authentication
- Authorization
- Admin system
- User system
- Payment system
- Study Together system
- Exam system
- Question bank
- Reading modules
- Analytics
- Tests
- Configuration
- Deployment files

Do not modify files during inspection.

==================================================
PHASE 5 — AFFECTED FILE INSPECTION
==================================================

Identify every existing file that may be affected.

For every existing file that may be modified:

INSPECT THE COMPLETE CURRENT CONTENT.

Determine:

- Purpose
- Imports
- Exports
- Functions
- Components
- State
- API calls
- Database calls
- Authentication
- Authorization
- Validation
- Error handling
- Security
- Existing UI
- Existing functionality
- Dependencies
- Consumers

NEVER assume the contents.

==================================================
NO BLIND FILE REPLACEMENT
==================================================

NEVER replace an entire existing file merely because a new
version was generated.

Required sequence:

READ CURRENT FILE
↓
UNDERSTAND CURRENT FILE
↓
IDENTIFY REQUIRED CHANGE
↓
MAKE MINIMAL MODIFICATION
↓
INSPECT RESULT
↓
REVIEW DIFF

==================================================
MINIMAL MODIFICATION PRINCIPLE
==================================================

Use the smallest safe change required.

If a feature affects 10 lines:

Do not rewrite 500 lines.

If one component requires modification:

Do not rewrite unrelated components.

If one function requires modification:

Do not replace the entire file.

Preserve unrelated code.

==================================================
EXISTING FUNCTIONALITY PRESERVATION
==================================================

Before implementation identify functionality that must remain.

Examples:

- Authentication
- Authorization
- Admin controls
- User dashboard
- Premium access
- PayMongo
- Payment verification
- Mock exams
- Question bank
- Reading modules
- Analytics
- User progress
- Study Together
- Study rooms
- Group chat
- Voice rooms
- Whiteboard
- AI study assistant
- Synchronized quizzes
- API routes
- Database operations

Never remove these merely to simplify implementation.

==================================================
PHASE 6 — DEPENDENCY & REFERENCE INSPECTION
==================================================

Before changing or removing:

- Components
- Functions
- Routes
- APIs
- Database models
- Variables
- Exports
- Utilities

Search for references.

Determine:

"What else depends on this?"

Never remove something without checking its consumers.

==================================================
PHASE 7 — BEFORE-CHANGE SNAPSHOT
==================================================

Before modifying an existing file:

Record its current state.

When useful, compare:

git show HEAD:"path/to/file"

and:

git diff -- "path/to/file"

Clearly identify:

ADDED
CHANGED
REMOVED
PRESERVED

If pre-existing changes exist, separate them from current-task
changes.

==================================================
PHASE 8 — IMPACT ANALYSIS
==================================================

Determine whether the task affects:

- Frontend
- Backend
- API
- Database
- Authentication
- Authorization
- Payments
- Admin
- Users
- Navigation
- Dashboard
- Mobile
- Tablet
- Desktop
- Environment variables
- Dependencies
- Deployment
- Performance
- Security

Identify possible side effects.

==================================================
PHASE 9 — DATABASE SAFETY
==================================================

If the task affects database functionality:

STOP and inspect first.

Inspect:

- prisma/schema.prisma
- prisma.config.ts
- Prisma client implementation
- Existing migrations
- Models
- Relations
- Foreign keys
- Unique constraints
- Indexes
- Seed files
- Database queries
- API routes using affected models

==================================================
DATABASE CHANGE CLASSIFICATION
==================================================

Classify database changes as:

ADDITIVE

Examples:

- New table
- New optional field
- New index
- New relation

MODIFICATION

Examples:

- Changing existing field
- Changing relationship
- Changing constraint

DESTRUCTIVE

Examples:

- Removing field
- Removing table
- Removing data
- Dropping constraints
- Destructive migration

If destructive:

STOP.

Explain the risk.

Request explicit authorization.

==================================================
DATABASE SAFETY
==================================================

NEVER automatically execute:

npx prisma migrate reset

Database deletion

Database reset

Destructive SQL

Dropping production tables

Deleting production data

Destructive migrations

without explicit authorization.

Never assume a migration is safe.

Protect existing user data.

==================================================
DATABASE BACKUP
==================================================

Before significant database changes:

Determine whether a verified database backup/export exists.

Never claim a database is backed up unless verified.

==================================================
PAYMENT SAFETY
==================================================

For PayMongo/payment changes inspect:

- Payment creation
- Payment verification
- Webhooks
- Server-side verification
- Payment status
- User entitlement
- Premium access
- Database payment records

Never trust frontend payment success alone.

Never remove server-side verification.

==================================================
AUTHENTICATION SAFETY
==================================================

For authentication changes inspect:

- Registration
- Login
- Password handling
- Sessions
- Cookies
- Middleware
- Protected routes
- Admin routes
- User roles
- Authorization

Never expose protected functionality.

==================================================
PHASE 10 — IMPLEMENTATION PLAN
==================================================

After inspection and impact analysis, provide a concise plan.

The plan MUST include:

1. What will be changed.
2. Files to modify.
3. Files to create.
4. Files to delete, if any.
5. Files to rename, if any.
6. Database changes.
7. Dependencies.
8. Existing functionality to preserve.
9. Risks.
10. Validation steps.
11. Expected user-facing result.

Then STOP.

==================================================
APPROVAL GATE
==================================================

DO NOT modify anything after the plan until the user explicitly
approves.

Valid approval includes:

"Yes"

"Proceed"

"Implement it"

"Go ahead"

"Approved"

"Do it"

If the user changes the request:

Return to inspection/planning as necessary.

==================================================
PHASE 11 — IMPLEMENTATION
==================================================

After explicit approval:

1. Reconfirm Git status.
2. Record PRE_UPDATE_COMMIT.
3. Create a safety checkpoint only if appropriate.
4. Record BEFORE state.
5. Modify only required files.
6. Preserve unrelated functionality.
7. Never overwrite an existing file without inspection.
8. Never modify secrets.
9. Never install unnecessary dependencies.
10. Never perform destructive database operations without
    authorization.

==================================================
NEW FILE CREATION
==================================================

For every NEW file:

1. Determine exact path.
2. Create directory if necessary.
3. Create file using terminal command.
4. Then write approved code.
5. Verify file exists.
6. Inspect the resulting file.

Windows PowerShell example:

New-Item -ItemType Directory -Path ".\src\components" -Force

New-Item -ItemType File -Path ".\src\components\Example.tsx" -Force

Never create unnecessary duplicate files.

==================================================
CODESPACES FILE CREATION
==================================================

When using Codespaces, use appropriate Linux-compatible
commands such as:

mkdir -p src/components

touch src/components/Example.tsx

Adapt to the actual environment.

==================================================
EXISTING FILE MODIFICATION
==================================================

For an existing file:

INSPECT
↓
IDENTIFY EXACT AREA
↓
MODIFY MINIMALLY
↓
INSPECT RESULT
↓
COMPARE DIFF

Do not rewrite the entire file unless genuinely required.

==================================================
PHASE 12 — POST-MODIFICATION INSPECTION
==================================================

After modification inspect the actual resulting files.

Verify:

- File exists
- No truncation
- No accidental deletion
- Imports correct
- Exports correct
- Functions preserved
- Components preserved
- Routes preserved
- Validation preserved
- Error handling preserved
- Authentication preserved
- Authorization preserved
- Security preserved
- New feature exists

==================================================
PHASE 13 — BEFORE vs AFTER DIFF
==================================================

After implementation run:

git status

git diff --stat

git diff

For specific files:

git diff -- "path/to/file"

Compare:

BEFORE
vs
AFTER

Verify every changed line is intentional.

==================================================
UNEXPECTED DELETION RULE
==================================================

If a diff shows unexpected large deletion:

STOP.

Do not automatically revert.

Inspect the file.

Determine why the deletion occurred.

Report the issue.

Wait for instructions if necessary.

==================================================
DIFF SIZE WARNING
==================================================

If a small request produces a very large diff:

STOP AND INVESTIGATE.

Possible causes:

- Whole-file replacement
- Formatting conversion
- Encoding change
- Line-ending conversion
- Accidental truncation
- Wrong file modification
- Generated file replacement

Do not continue until understood.

==================================================
PHASE 14 — VALIDATION
==================================================

Inspect package.json first.

Determine the project's valid commands.

Run only validations relevant to the task.

Possible checks:

TypeScript:

npx tsc --noEmit

ESLint:

Use the project's CURRENT VALID ESLint command.

Do not assume "next lint" is valid on every Next.js version.

If the project contains a known invalid lint command:

Do not modify package.json merely to make lint pass.

Determine the correct ESLint command from the actual project
configuration.

Production build when appropriate:

npx next build

Tests when available:

Use the project's actual test command.

==================================================
VALIDATION SCOPE
==================================================

Do not unnecessarily run every possible expensive check for
every trivial change.

For small localized changes:

Run the relevant lightweight validation.

For significant changes:

Run appropriate type-check, lint, build, and tests.

For database/auth/payment/security changes:

Use stronger validation.

Always explain skipped validation.

If something was not run:

NOT VERIFIED

Never falsely claim success.

==================================================
TEST FAILURE RULE
==================================================

If validation fails:

1. Capture the exact error.
2. Determine whether it existed before the task.
3. Determine whether the task caused it.
4. Do not automatically fix unrelated issues.
5. Fix task-related issues when appropriate.
6. Re-run validation.

Do not hide errors.

==================================================
PHASE 15 — FUNCTIONAL VERIFICATION
==================================================

Verify the actual requested functionality.

When relevant verify:

- New feature
- Related feature
- Authentication
- Authorization
- API
- Database
- Payments
- Dashboard
- Navigation
- Mobile
- Tablet
- Desktop
- Error handling
- Security

Only claim functionality is verified when actually checked.

==================================================
PHASE 16 — FINAL DIFF REVIEW
==================================================

Before committing:

Run:

git status

git diff --stat

git diff

Confirm:

- Only task-related files changed
- No secrets added
- No .env files added
- No unrelated files changed
- No accidental deletions
- No temporary files
- No debugging code
- No unrelated refactoring
- No accidental configuration changes

==================================================
ENVIRONMENT FILE PROTECTION
==================================================

NEVER expose:

.env

.env.local

API keys

Database passwords

PayMongo secrets

Authentication secrets

Private tokens

If an environment file unexpectedly appears in Git changes:

STOP.

Inspect .gitignore.

Never expose secret values.

==================================================
PHASE 17 — FINAL GIT COMMIT
==================================================

Commit only changes belonging to the current task.

Use a conventional commit message.

Examples:

feat: add study together profile

feat: add study room reactions

fix: resolve exam scoring issue

fix: correct profile loading

refactor: improve question loading

db: add study profile fields

security: improve authorization

docs: update development rules

Do NOT automatically create a backup commit immediately before
every final task commit.

Normal workflow should preferably be:

TASK
→ IMPLEMENT
→ VERIFY
→ FINAL TASK COMMIT

==================================================
COMMIT REQUIREMENTS
==================================================

Before committing:

- Diff reviewed
- Task-related files confirmed
- Validation completed as appropriate
- No secrets exposed
- No unrelated changes
- User approval exists
- Commit message is accurate

Never commit unrelated work.

Never amend existing commits automatically.

Never rewrite history.

==================================================
PHASE 18 — ROLLBACK INFORMATION
==================================================

At the beginning record:

PRE_UPDATE_COMMIT

After successful commit record:

POST_UPDATE_COMMIT

If a separate safety checkpoint was created:

SAFETY_CHECKPOINT_COMMIT

Report all verified hashes.

Never claim a rollback point exists unless verified.

==================================================
ROLLBACK RULE
==================================================

If the update causes a problem:

STOP.

First inspect:

git status

git diff

Protect pre-existing user changes.

Do not immediately reset the repository.

Determine which changes belong to the current task.

==================================================
SAFE ROLLBACK
==================================================

NEVER automatically run:

git reset --hard PRE_UPDATE_COMMIT

A destructive rollback requires explicit authorization.

Before any rollback:

- Inspect status
- Identify pre-existing changes
- Protect user work
- Confirm rollback target
- Explain consequences
- Obtain authorization when destructive action is required

==================================================
NO FALSE CLAIMS
==================================================

Never claim:

"Build passed"

"Tests passed"

"Feature works"

"Database backup completed"

"GitHub backup completed"

"Rollback completed"

unless actually verified.

Use:

NOT VERIFIED

when appropriate.

==================================================
NO UNNECESSARY REFACTORING
==================================================

When the user requests:

"Add feature X"

Do NOT automatically:

- Redesign unrelated pages
- Refactor unrelated components
- Upgrade dependencies
- Change database architecture
- Rename unrelated files
- Change styling systems
- Rewrite working features

Keep scope controlled.

==================================================
FEATURE SCOPE CONTROL
==================================================

Determine:

"What is the minimum safe change required?"

Implement that first.

Optional improvements must be clearly identified.

Do not silently include optional improvements.

==================================================
SECURITY-FIRST RULE
==================================================

Never sacrifice security for convenience.

Never disable:

- Authentication
- Authorization
- Input validation
- CSRF protection where applicable
- Rate limiting where applicable
- Payment verification
- Admin protection
- Database security
- Secret protection

==================================================
PERFORMANCE SAFETY
==================================================

For performance-sensitive changes inspect:

- Database queries
- API requests
- Rendering
- Large datasets
- Question banks
- Mock exams
- Analytics
- Admin dashboards
- Study Together activity

Avoid unnecessary database queries and duplicate API requests.

==================================================
RESPONSIVE DESIGN SAFETY
==================================================

For UI changes verify appropriate behavior across:

- Desktop
- Tablet
- Mobile

Do not fix one screen size by unnecessarily breaking another.

==================================================
STUDY TOGETHER SAFETY
==================================================

Study Together features may include:

- User profiles
- Display names
- Avatars
- Bios
- Study groups
- Friend requests
- Private messaging
- Group chat
- Voice rooms
- Screen sharing
- Live whiteboard
- AI study assistant
- Synchronized quizzes
- Study room invitations
- Study room permissions
- Participant limits
- Host controls

When modifying Study Together functionality:

Inspect the existing implementation first.

Preserve:

- Existing authentication
- Existing room membership
- Existing permissions
- Existing participant handling
- Existing messaging
- Existing real-time behavior
- Existing database relationships
- Existing UI behavior

Never assume Study Together architecture.

==================================================
USER PROFILE SAFETY
==================================================

For profile-related features inspect:

- Existing user model
- Authentication identity
- Existing account information
- Profile data
- Privacy controls
- Authorization
- Database relationships
- Profile APIs
- Existing profile UI

Avoid collecting unnecessary personal information.

Only collect profile information that has a clear product purpose.

Sensitive or unnecessary information must not be collected
without a legitimate reason and explicit product requirement.

==================================================
PHASE 19 — FINAL DEVELOPMENT REPORT
==================================================

After a completed task provide:

## ENVIRONMENT

Current environment.

## GIT STATUS

Current branch and working-tree status.

## PRE-UPDATE COMMIT

Verified Git hash.

## SAFETY CHECKPOINT

State whether one was created.

## FILES MODIFIED

List exact paths.

## FILES CREATED

List exact paths.

## FILES DELETED

List exact paths, if any.

## FILES RENAMED

List exact paths, if any.

## DATABASE CHANGES

Describe exact database changes.

## DEPENDENCIES

List added/changed dependencies.

## FEATURES ADDED

List.

## FEATURES MODIFIED

List.

## FEATURES PRESERVED

List.

## DIFF REVIEW

Summarize important additions, modifications, and deletions.

## VALIDATION

List commands actually executed and their results.

## BUILD

Actual result or NOT VERIFIED.

## FUNCTIONAL VERIFICATION

Actual result.

## POST-UPDATE COMMIT

Verified hash if committed.

## ROLLBACK POINT

Verified Git hash.

## REMAINING ISSUES

List unresolved issues.

==================================================
REQUIRED RESPONSE STRUCTURE
==================================================

Every new development request begins with:

## 1. ENVIRONMENT

## 2. GIT SAFETY

## 3. READ-ONLY PROJECT INSPECTION

## 4. CURRENT IMPLEMENTATION

## 5. DEPENDENCY / REFERENCE ANALYSIS

## 6. IMPACT ANALYSIS

## 7. DATABASE SAFETY

## 8. IMPLEMENTATION PLAN

Then:

STOP AND WAIT FOR USER APPROVAL.

After approval:

## 9. IMPLEMENTATION

## 10. POST-CHANGE INSPECTION

## 11. BEFORE vs AFTER DIFF

## 12. VALIDATION

## 13. BUILD

## 14. FUNCTIONAL VERIFICATION

## 15. FINAL GIT REVIEW

## 16. COMMIT

## 17. ROLLBACK POINT

## 18. FINAL REPORT

==================================================
ABSOLUTE STOP CONDITIONS
==================================================

STOP immediately if:

- Current file cannot be inspected
- User work may be overwritten
- Database data may be destroyed
- Security may be weakened
- Payment verification may be broken
- Unexpected large deletion appears
- File appears truncated
- Required dependency is unclear
- Required architecture is unclear
- Secrets may be exposed
- Destructive command is required without authorization
- Unexpected unrelated modifications appear
- Validation failure cannot be explained
- Rollback may destroy unrelated work

Explain the issue before continuing.

==================================================
NO AUTOMATIC PUSH
==================================================

NEVER run:

git push

unless the user explicitly instructs:

"push"

or equivalent explicit authorization.

==================================================
NO HISTORY REWRITING
==================================================

Never automatically:

- Amend commits
- Rebase
- Squash
- Force push
- Rewrite history
- Reset to another commit

unless explicitly authorized.

==================================================
PERMANENT FILE-PRESERVATION RULE
==================================================

The most important rule:

NEVER MODIFY WHAT YOU HAVE NOT INSPECTED.

NEVER DELETE WHAT YOU HAVE NOT VERIFIED.

NEVER OVERWRITE USER WORK.

NEVER REPLACE AN EXISTING FILE BLINDLY.

NEVER MODIFY DATABASE DATA DESTRUCTIVELY WITHOUT AUTHORIZATION.

NEVER COMMIT UNVERIFIED CHANGES.

ALWAYS INSPECT THE BEFORE STATE.

ALWAYS INSPECT THE AFTER STATE.

ALWAYS REVIEW THE DIFF.

ALWAYS PROTECT PRE-EXISTING USER CHANGES.

ALWAYS PROVIDE A VERIFIED ROLLBACK POINT.

==================================================
PERMANENT DEVELOPMENT PIPELINE
==================================================

Every development request follows:

USER FEATURE REQUEST

↓

ENVIRONMENT CHECK

↓

GIT STATUS

↓

CURRENT HEAD

↓

READ-ONLY PROJECT INSPECTION

↓

CURRENT FILE INSPECTION

↓

REFERENCE / DEPENDENCY CHECK

↓

BEFORE SNAPSHOT

↓

IMPACT ANALYSIS

↓

DATABASE SAFETY

↓

IMPLEMENTATION PLAN

↓

STOP FOR USER APPROVAL

↓

SAFETY CHECKPOINT WHEN APPROPRIATE

↓

IMPLEMENTATION

↓

NEW FILE CREATION

↓

EXISTING FILE MODIFICATION

↓

POST-CHANGE INSPECTION

↓

GIT DIFF

↓

GIT DIFF --STAT

↓

TYPE CHECK

↓

ESLINT

↓

BUILD WHEN APPROPRIATE

↓

TEST WHEN AVAILABLE

↓

FUNCTIONAL VERIFICATION

↓

FINAL DIFF REVIEW

↓

FINAL GIT STATUS

↓

TASK COMMIT WHEN APPROPRIATE

↓

ROLLBACK INFORMATION

↓

FINAL DEVELOPMENT REPORT

==================================================
IMPORTANT AUTOMATION RULE
==================================================

The user should be able to submit ONLY the feature description.

Example:

"Add a leaderboard to the Study Together Hub."

Automatically interpret this as:

INSPECT
→ IMPACT ANALYSIS
→ PLAN
→ WAIT FOR APPROVAL
→ IMPLEMENT
→ VERIFY
→ TEST
→ BUILD WHEN APPROPRIATE
→ FINAL REVIEW
→ COMMIT WHEN APPROPRIATE

The user must NOT repeat the workflow.

The user must NOT say:

"Use my permanent workflow."

The user must NOT say:

"Start Phase 1."

The user must NOT repeat safety rules.

==================================================
FINAL GOLDEN RULE
==================================================

PROTECT THE EXISTING WEBSITE.

UNDERSTAND BEFORE MODIFYING.

INSPECT BEFORE OVERWRITING.

PRESERVE USER WORK.

MAKE THE SMALLEST SAFE CHANGE.

USE GIT STRATEGICALLY, NOT MECHANICALLY.

DO NOT CREATE UNNECESSARY BACKUP COMMITS.

DO NOT AUTOMATICALLY PUSH.

DO NOT REWRITE HISTORY.

DO NOT PERFORM DESTRUCTIVE DATABASE OPERATIONS WITHOUT
AUTHORIZATION.

DO NOT CLAIM VERIFICATION WITHOUT ACTUALLY VERIFYING.

ALWAYS REVIEW THE DIFF.

ALWAYS PROTECT THE BEFORE STATE.

ALWAYS INSPECT THE AFTER STATE.

ALWAYS PROVIDE VERIFIED ROLLBACK INFORMATION.

==================================================
CURRENT PROJECT
==================================================

Project:

cse-frontend

Current environment:

VS Code + Windows PowerShell

Known baseline:

71e9f08 fix: route registration links to signup

Future environment may be:

GitHub Codespaces + VS Code

When the environment changes, adapt terminal commands while
maintaining every safety rule in this document.

==================================================
FINAL INSTRUCTION
==================================================

These are PERMANENT DEVELOPMENT RULES for the entire lifetime
of this website project.

Apply them automatically to every future development request.

The highest priority is:

PROTECT THE EXISTING WEBSITE WHILE SAFELY BUILDING NEW
FUNCTIONALITY.

The required philosophy is:

INSPECT
→ UNDERSTAND
→ PLAN
→ APPROVE
→ MODIFY MINIMALLY
→ RE-INSPECT
→ DIFF
→ VALIDATE
→ VERIFY
→ COMMIT WHEN APPROPRIATE
→ DOCUMENT
→ MAINTAIN ROLLBACK INFORMATION
