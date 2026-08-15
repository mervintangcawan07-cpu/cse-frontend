# CANDIDATE REPORT — CLEANUP-2026-08-15-001

**Audit Session:** `CLEANUP-2026-08-15-001`  
**Date/Time:** `2026-08-15 13:46:00+08:00`  
**Project:** `c:\Users\Administrator\cse-frontend`  
**Git Checkpoint:** `e1aac327512f2016582585b16ee73f398b6c63ac` (Branch: `backup/cleanup-2026-08-15-001`)  
**External Backup:** `C:\Users\Administrator\cse-frontend-backup-before-cleanup-2026-08-15-001` (VERIFIED_SUCCESS)  

---

## 1. SUMMARY TABLE

| # | File | Classification | Risk | Dependencies Found | Recommendation | Approval Status |
| - | ---- | -------------- | ---- | ------------------ | -------------- | --------------- |
| #001 | `generate_verbal_all.js` | **A — PROVEN UNUSED** | `LOW` | None | **QUARANTINE & DELETE** | `PENDING` |
| #002 | `integrate-live-events.js` | **A — PROVEN UNUSED** | `LOW` | None | **QUARANTINE & DELETE** | `PENDING` |
| #003 | `setup-clean-tables.js` | **A — PROVEN UNUSED** | `LOW` | None | **QUARANTINE & DELETE** | `PENDING` |
| #004 | `temp_insert.sql` | **A — PROVEN UNUSED** | `LOW` | None | **QUARANTINE & DELETE** | `PENDING` |
| #005 | `gen-csv.py` | **A — PROVEN UNUSED** | `LOW` | None | **QUARANTINE & DELETE** | `PENDING` |
| #006 | `numerical_reasoning_data_interpretation_25_updated.csv` | **A — PROVEN UNUSED** | `LOW` | None | **QUARANTINE & DELETE** | `PENDING` |
| #007 | `public/file.svg` | **A — PROVEN UNUSED** | `LOW` | None | **QUARANTINE & DELETE** | `PENDING` |
| #008 | `public/globe.svg` | **A — PROVEN UNUSED** | `LOW` | None | **QUARANTINE & DELETE** | `PENDING` |
| #009 | `public/next.svg` | **A — PROVEN UNUSED** | `LOW` | None | **QUARANTINE & DELETE** | `PENDING` |
| #010 | `public/vercel.svg` | **A — PROVEN UNUSED** | `LOW` | None | **QUARANTINE & DELETE** | `PENDING` |
| #011 | `public/window.svg` | **A — PROVEN UNUSED** | `LOW` | None | **QUARANTINE & DELETE** | `PENDING` |
| #012 | `public/templates/question_upload_template_full.csv` | **C — POSSIBLE HIDDEN DEPENDENCY (PUBLIC ASSET)** | `LOW` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #013 | `public/templates/question_upload_template_standard.csv` | **C — POSSIBLE HIDDEN DEPENDENCY (PUBLIC ASSET)** | `LOW` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #014 | `scripts/audit-and-fix-questions.ts` | **B — PROBABLY UNUSED IN RUNTIME (MAINTENANCE SCRIPT) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #015 | `scripts/audit-detailed.ts` | **B — PROBABLY UNUSED IN RUNTIME (MAINTENANCE SCRIPT) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #016 | `scripts/audit-duplicates.ts` | **B — PROBABLY UNUSED IN RUNTIME (MAINTENANCE SCRIPT) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #017 | `scripts/check-db-dupes.ts` | **B — PROBABLY UNUSED IN RUNTIME (MAINTENANCE SCRIPT) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #018 | `scripts/clean-reingest.ts` | **B — PROBABLY UNUSED IN RUNTIME (MAINTENANCE SCRIPT) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #019 | `scripts/deduplicate-and-purge.ts` | **B — PROBABLY UNUSED IN RUNTIME (MAINTENANCE SCRIPT) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #020 | `scripts/fix-schema-softdelete.js` | **B — PROBABLY UNUSED IN RUNTIME (MIGRATION TOOL) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #021 | `scripts/import-all-generated-questions.ts` | **B — PROBABLY UNUSED IN RUNTIME (INGESTION TOOL) — REVIEW REQUIRED** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #022 | `scripts/inspect-everything.ts` | **B — PROBABLY UNUSED IN RUNTIME (DIAGNOSTIC TOOL) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #023 | `scripts/inspect-softdeleted.ts` | **B — PROBABLY UNUSED IN RUNTIME (DIAGNOSTIC TOOL) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #024 | `scripts/sanitize-csvs.ts` | **B — PROBABLY UNUSED IN RUNTIME (MAINTENANCE SCRIPT) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #025 | `scripts/test-backup-system.ts` | **B — PROBABLY UNUSED IN RUNTIME (TEST HARNESS) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #026 | `scripts/test-mock-exam-generation.ts` | **B — PROBABLY UNUSED IN RUNTIME (TEST HARNESS) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #027 | `scripts/test-resilience.ts` | **B — PROBABLY UNUSED IN RUNTIME (TEST HARNESS) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #028 | `scripts/test-sudo.ts` | **B — PROBABLY UNUSED IN RUNTIME (TEST HARNESS) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #029 | `scripts/update-schema-softdelete.js` | **B — PROBABLY UNUSED IN RUNTIME (MIGRATION TOOL) — REVIEW REQUIRED** | `LOW` | Modular / Feature Subsystem | **KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)** | `PENDING` |
| #030 | `src/proxy.ts` | **D — DEFINITELY USED (CRITICAL SYSTEM PROXY)** | `HIGH` | Core App Router / Auth Engine | **KEEP (ABSOLUTELY PROTECTED)** | `PENDING` |
| #031 | `src/components/admin/DatabaseStorageWidget.tsx` | **C — POSSIBLE HIDDEN DEPENDENCY (ADMIN DASHBOARD FEATURE)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #032 | `src/components/analytics/CategoryBreakdown.tsx` | **C — POSSIBLE HIDDEN DEPENDENCY (ANALYTICS FEATURE)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #033 | `src/components/cse/GroupErrorReview.tsx` | **C — POSSIBLE HIDDEN DEPENDENCY (CSE REVIEW FEATURE)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #034 | `src/components/cse/LiveSpeedDrill.tsx` | **C — POSSIBLE HIDDEN DEPENDENCY (CSE DRILL FEATURE)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #035 | `src/components/cse/NotificationSystem.tsx` | **C — POSSIBLE HIDDEN DEPENDENCY (NOTIFICATION FEATURE)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #036 | `src/components/cse/PostExamDashboard.tsx` | **C — POSSIBLE HIDDEN DEPENDENCY (STUDY TOGETHER FEATURE)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #037 | `src/components/cse/StudyTogetherModal.tsx` | **C — POSSIBLE HIDDEN DEPENDENCY (STUDY TOGETHER FEATURE)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #038 | `src/components/dashboard/AnalyticsOverview.tsx` | **C — POSSIBLE HIDDEN DEPENDENCY (DASHBOARD FEATURE)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #039 | `src/components/dashboard/ReviewCenter.tsx` | **C — POSSIBLE HIDDEN DEPENDENCY (DASHBOARD FEATURE)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #040 | `src/components/exam/CancelExamModal.tsx` | **C — POSSIBLE HIDDEN DEPENDENCY (EXAM FLOW FEATURE)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #041 | `src/components/social/DeleteRoomModal.tsx` | **C — POSSIBLE HIDDEN DEPENDENCY (SOCIAL ROOM FEATURE)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #042 | `src/hooks/useSubmitLock.ts` | **C — POSSIBLE HIDDEN DEPENDENCY (SECURITY HOOK)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #043 | `src/lib/error/apiHandler.ts` | **C — POSSIBLE HIDDEN DEPENDENCY (ERROR HANDLING UTILITY)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #044 | `src/middleware/requestLogger.ts` | **C — POSSIBLE HIDDEN DEPENDENCY (LOGGING UTILITY)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #045 | `src/middleware/softDeleteFilter.ts` | **C — POSSIBLE HIDDEN DEPENDENCY (DB RECOVERY UTILITY)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #046 | `src/middleware/validate.ts` | **C — POSSIBLE HIDDEN DEPENDENCY (VALIDATION UTILITY)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #047 | `src/scripts/migrateEncryption.ts` | **C — POSSIBLE HIDDEN DEPENDENCY (SECURITY MIGRATION TOOL)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |
| #048 | `src/scripts/test-phase6b.ts` | **C — POSSIBLE HIDDEN DEPENDENCY (SECURITY TEST TOOL)** | `MEDIUM` | Modular / Feature Subsystem | **KEEP** | `PENDING` |

---

## 2. DETAILED CANDIDATE AUDIT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #001
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `generate_verbal_all.js`
TYPE: JavaScript Root Script
SIZE: 88293 bytes
LAST MODIFIED: 2026-08-07T06:45:07.366Z
SHA-256: `ae6c698b7ae08d5833f8e111e3776b3acfd34ea2b5e1a1d0f04534e4157c5869`

PURPOSE:
Standalone offline question generator script used during early question bank population.

WHAT REFERENCES IT:
None (0 imports, 0 dynamic calls, 0 package.json scripts).

WHAT IT REFERENCES:
Node fs module.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
None.

DYNAMIC USAGE:
None.

ROUTE USAGE:
None.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
None (not included in next.config.ts or build scripts).

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
None.

WHY IT APPEARS UNUSED:
Zero references across entire codebase.

WHY DELETION IS SAFE:
Standalone script completely decoupled from Next.js runtime and build.

RISK: LOW

CLASSIFICATION: A — PROVEN UNUSED

RECOMMENDATION: QUARANTINE & DELETE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #002
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `integrate-live-events.js`
TYPE: JavaScript Root Script
SIZE: 22654 bytes
LAST MODIFIED: 2026-08-10T07:47:21.323Z
SHA-256: `07983c222d560e6578a169a7f6d69c804fa9c10a342ee5a81b29915c441823e2`

PURPOSE:
Temporary patch script used during initial study events code integration.

WHAT REFERENCES IT:
None (0 imports, 0 dynamic calls, 0 package.json scripts).

WHAT IT REFERENCES:
Node fs, path modules.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
None.

DYNAMIC USAGE:
None.

ROUTE USAGE:
None.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
None.

WHY IT APPEARS UNUSED:
Zero references across entire codebase.

WHY DELETION IS SAFE:
Completed one-off integration script no longer needed.

RISK: LOW

CLASSIFICATION: A — PROVEN UNUSED

RECOMMENDATION: QUARANTINE & DELETE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #003
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `setup-clean-tables.js`
TYPE: JavaScript Root Script
SIZE: 6564 bytes
LAST MODIFIED: 2026-08-10T07:47:21.326Z
SHA-256: `e4cfee6115f4428aeed722ea45e2d7b0be6f37b82a8fbda99c045dedcad1a37c`

PURPOSE:
Temporary helper script used during development to generate formatPrompt.ts.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
Node fs, child_process.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
None.

DYNAMIC USAGE:
None.

ROUTE USAGE:
None.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
None.

WHY IT APPEARS UNUSED:
Zero references across codebase.

WHY DELETION IS SAFE:
Target file formatPrompt.ts exists and operates independently.

RISK: LOW

CLASSIFICATION: A — PROVEN UNUSED

RECOMMENDATION: QUARANTINE & DELETE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #004
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `temp_insert.sql`
TYPE: SQL Test Snippet
SIZE: 170 bytes
LAST MODIFIED: 2026-08-09T06:32:45.540Z
SHA-256: `2a75b9895cfbe7bdeeb9242f1ce6134adf88f2c0648b933e313b4c430d7d8201`

PURPOSE:
Temporary SQL test insertion statement used in manual DB verification.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
None.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
None.

DYNAMIC USAGE:
None.

ROUTE USAGE:
None.

SERVER USAGE:
None.

DATABASE USAGE:
None (not part of Prisma migrations).

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
None.

WHY IT APPEARS UNUSED:
One-line temporary SQL scratch file.

WHY DELETION IS SAFE:
Prisma schema and migrations manage database state.

RISK: LOW

CLASSIFICATION: A — PROVEN UNUSED

RECOMMENDATION: QUARANTINE & DELETE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #005
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `gen-csv.py`
TYPE: Python Scratch Script
SIZE: 2080 bytes
LAST MODIFIED: 2026-08-10T07:47:21.321Z
SHA-256: `ad2e354b3c2b6a91c62be965b0bf950fe920d9e230b678f3cda3ada17de6dee0`

PURPOSE:
One-off Python script used to clean CSV prompt formatting.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
Python csv, re modules.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
None.

DYNAMIC USAGE:
None.

ROUTE USAGE:
None.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
None.

WHY IT APPEARS UNUSED:
Zero references in TypeScript/Next codebase.

WHY DELETION IS SAFE:
Development utility for one-off CSV cleaning.

RISK: LOW

CLASSIFICATION: A — PROVEN UNUSED

RECOMMENDATION: QUARANTINE & DELETE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #006
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `numerical_reasoning_data_interpretation_25_updated.csv`
TYPE: CSV Question Dataset Artifact
SIZE: 18802 bytes
LAST MODIFIED: 2026-08-10T07:47:21.324Z
SHA-256: `49d1ea8e4f09cb94d35964c627c9507f68c50f408eb518a4f5e0a210345d50b9`

PURPOSE:
Source CSV dataset containing 25 data interpretation questions (already ingested into DB).

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
None.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
None.

DYNAMIC USAGE:
None.

ROUTE USAGE:
None.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
None.

WHY IT APPEARS UNUSED:
Questions already in PostgreSQL database and offline question generator.

WHY DELETION IS SAFE:
Zero runtime dependencies.

RISK: LOW

CLASSIFICATION: A — PROVEN UNUSED

RECOMMENDATION: QUARANTINE & DELETE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #007
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `public/file.svg`
TYPE: SVG Public Asset
SIZE: 391 bytes
LAST MODIFIED: 2026-08-07T06:45:07.381Z
SHA-256: `2b67812c325c199a02536cdbeea0c593a72f707d323b72ee3e08dbab06753bd4`

PURPOSE:
Default Next.js starter template file icon.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
None.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
None.

DYNAMIC USAGE:
None.

ROUTE USAGE:
None.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
None.

WHY IT APPEARS UNUSED:
Zero references in any component, page, or CSS.

WHY DELETION IS SAFE:
Boilerplate asset not used by custom CSE Reviewer UI.

RISK: LOW

CLASSIFICATION: A — PROVEN UNUSED

RECOMMENDATION: QUARANTINE & DELETE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #008
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `public/globe.svg`
TYPE: SVG Public Asset
SIZE: 1035 bytes
LAST MODIFIED: 2026-08-07T06:45:07.382Z
SHA-256: `b614b9bf183925957661ac851498fe1d8029fd43a62fbfed86f9e2624a57e7cf`

PURPOSE:
Default Next.js starter template globe icon.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
None.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
None.

DYNAMIC USAGE:
None.

ROUTE USAGE:
None.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
None.

WHY IT APPEARS UNUSED:
Zero references.

WHY DELETION IS SAFE:
Boilerplate asset.

RISK: LOW

CLASSIFICATION: A — PROVEN UNUSED

RECOMMENDATION: QUARANTINE & DELETE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #009
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `public/next.svg`
TYPE: SVG Public Asset
SIZE: 1375 bytes
LAST MODIFIED: 2026-08-07T06:45:07.382Z
SHA-256: `55995dfad6ecb4945a1e856ddca03c5e16aa5bf13fd21b4df6a74ae79357bcfc`

PURPOSE:
Default Next.js starter template logo.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
None.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
None.

DYNAMIC USAGE:
None.

ROUTE USAGE:
None.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
None.

WHY IT APPEARS UNUSED:
Zero references.

WHY DELETION IS SAFE:
Boilerplate asset.

RISK: LOW

CLASSIFICATION: A — PROVEN UNUSED

RECOMMENDATION: QUARANTINE & DELETE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #010
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `public/vercel.svg`
TYPE: SVG Public Asset
SIZE: 128 bytes
LAST MODIFIED: 2026-08-07T06:45:07.382Z
SHA-256: `f081337b2fee635b455b63275406a3e7f39d6a014e25ad90dab5a67e62a12ac4`

PURPOSE:
Default Next.js starter template Vercel logo.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
None.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
None.

DYNAMIC USAGE:
None.

ROUTE USAGE:
None.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
None.

WHY IT APPEARS UNUSED:
Zero references.

WHY DELETION IS SAFE:
Boilerplate asset.

RISK: LOW

CLASSIFICATION: A — PROVEN UNUSED

RECOMMENDATION: QUARANTINE & DELETE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #011
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `public/window.svg`
TYPE: SVG Public Asset
SIZE: 385 bytes
LAST MODIFIED: 2026-08-07T06:45:07.382Z
SHA-256: `644768c4aaeb4767bce293344eeb0c125fb804a94d801440424072202d85e3a1`

PURPOSE:
Default Next.js starter template window icon.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
None.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
None.

DYNAMIC USAGE:
None.

ROUTE USAGE:
None.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
None.

WHY IT APPEARS UNUSED:
Zero references.

WHY DELETION IS SAFE:
Boilerplate asset.

RISK: LOW

CLASSIFICATION: A — PROVEN UNUSED

RECOMMENDATION: QUARANTINE & DELETE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #012
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `public/templates/question_upload_template_full.csv`
TYPE: CSV Template
SIZE: 6345 bytes
LAST MODIFIED: 2026-08-15T03:42:27.623Z
SHA-256: `b068989bd3f1273a6a68e94cea442fb41924e0ccfdd32241e9e6e5ca07eac0cc`

PURPOSE:
Full question CSV upload template for administrator bulk question import.

WHAT REFERENCES IT:
Static download asset in public folder.

WHAT IT REFERENCES:
None.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
None.

DYNAMIC USAGE:
Public URL download (/templates/question_upload_template_full.csv).

ROUTE USAGE:
Admin question upload UI.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
Vercel static asset hosting.

CONFIGURATION USAGE:
None.

ASSET USAGE:
Downloadable template.

EXTERNAL USAGE:
Admin/User browser downloads.

WHY IT APPEARS UNUSED:
Not directly imported in TypeScript code.

WHY DELETION IS SAFE:
N/A - Useful template asset.

RISK: LOW

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (PUBLIC ASSET)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #013
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `public/templates/question_upload_template_standard.csv`
TYPE: CSV Template
SIZE: 2118 bytes
LAST MODIFIED: 2026-08-15T03:42:38.114Z
SHA-256: `aa3cfbc08b2cc95414ed018cbd4cfbf403cbcdc34e217f67c6fedbc63c746555`

PURPOSE:
Standard question CSV upload template for administrator bulk question import.

WHAT REFERENCES IT:
Static download asset in public folder.

WHAT IT REFERENCES:
None.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
None.

DYNAMIC USAGE:
Public URL download (/templates/question_upload_template_standard.csv).

ROUTE USAGE:
Admin question upload UI.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
Vercel static asset hosting.

CONFIGURATION USAGE:
None.

ASSET USAGE:
Downloadable template.

EXTERNAL USAGE:
Admin/User browser downloads.

WHY IT APPEARS UNUSED:
Not directly imported in TypeScript code.

WHY DELETION IS SAFE:
N/A - Useful template asset.

RISK: LOW

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (PUBLIC ASSET)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #014
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/audit-and-fix-questions.ts`
TYPE: CLI TypeScript Script
SIZE: 1675 bytes
LAST MODIFIED: 2026-08-14T23:14:53.118Z
SHA-256: `027c9f7ba31e8cf8e0ef3df54458314fd29282ba9602245700b19979956e22cf`

PURPOSE:
CLI maintenance script for auditing and fixing database questions.

WHAT REFERENCES IT:
None (run via npx ts-node / npx tsx).

WHAT IT REFERENCES:
@prisma/client, @/lib/prisma.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
Prisma DB.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI.

DATABASE USAGE:
Inspects and fixes question records.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Developer maintenance.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Next.js build and web app do not require it.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (MAINTENANCE SCRIPT) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #015
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/audit-detailed.ts`
TYPE: CLI TypeScript Script
SIZE: 7240 bytes
LAST MODIFIED: 2026-08-15T05:02:13.260Z
SHA-256: `7583164d4adf0389c958b32660c4f9cae08f992bc8aba17e1f3f1e244a4c1903`

PURPOSE:
CLI detailed question audit tool.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
@prisma/client, @/lib/prisma.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
Prisma DB.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI.

DATABASE USAGE:
Audits question subjects and counts.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Developer maintenance.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Next.js web app does not require it.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (MAINTENANCE SCRIPT) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #016
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/audit-duplicates.ts`
TYPE: CLI TypeScript Script
SIZE: 10066 bytes
LAST MODIFIED: 2026-08-15T05:00:40.543Z
SHA-256: `d06f2f0a3d03ebf308f22a35af6232207ca9438dc7650138133bc0eb1f31f220`

PURPOSE:
CLI duplicate detector and audit script for DB questions.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
@prisma/client, @/lib/prisma.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
Prisma DB.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI.

DATABASE USAGE:
Queries Question table for duplicates.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Developer maintenance.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Next.js web app does not require it.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (MAINTENANCE SCRIPT) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #017
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/check-db-dupes.ts`
TYPE: CLI TypeScript Script
SIZE: 2371 bytes
LAST MODIFIED: 2026-08-15T05:03:37.981Z
SHA-256: `65d109e73f8f4affa1127f8b01f36dbde7dca91e19f5669da7facdedb01d4a0c`

PURPOSE:
CLI check script for database duplicates.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
@prisma/client, @/lib/prisma.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
Prisma DB.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI.

DATABASE USAGE:
Queries Question table.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Developer maintenance.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Next.js web app does not require it.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (MAINTENANCE SCRIPT) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #018
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/clean-reingest.ts`
TYPE: CLI TypeScript Script
SIZE: 8244 bytes
LAST MODIFIED: 2026-08-14T23:42:39.152Z
SHA-256: `2f22ffbad34d7eafb44a24e96e33d97421786cddec3a97d15cf8c946b0ff4794`

PURPOSE:
CLI script for clean re-ingestion of verified questions.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
@prisma/client, @/lib/prisma, fs, path.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
Prisma DB, CSV question files.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI.

DATABASE USAGE:
Inserts Question records.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Developer maintenance.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Next.js web app does not require it.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (MAINTENANCE SCRIPT) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #019
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/deduplicate-and-purge.ts`
TYPE: CLI TypeScript Script
SIZE: 3210 bytes
LAST MODIFIED: 2026-08-15T05:08:33.120Z
SHA-256: `4f46ac2122a30256251a3681cd3f18969e62540c41e01efede12f888793a6324`

PURPOSE:
CLI script used in recent database cleanup to purge duplicate batches.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
@prisma/client, @/lib/prisma.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
Prisma DB.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI.

DATABASE USAGE:
Purges duplicate question rows.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Developer maintenance.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Next.js web app does not require it.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (MAINTENANCE SCRIPT) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #020
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/fix-schema-softdelete.js`
TYPE: Node Migration Script
SIZE: 784 bytes
LAST MODIFIED: 2026-08-07T10:04:17.924Z
SHA-256: `40c407cc4ecfc3ef7a9a96c9d5ae49d7cacc9668842877583f52d84f590ca1a4`

PURPOSE:
Migration script for soft-delete schema update.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
pg, dotenv.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
PostgreSQL DB.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI.

DATABASE USAGE:
Executes DDL alter table.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Historical migration.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Historical migration.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (MIGRATION TOOL) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #021
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/import-all-generated-questions.ts`
TYPE: CLI TypeScript Script
SIZE: 9882 bytes
LAST MODIFIED: 2026-08-14T23:14:14.534Z
SHA-256: `6e6cee607706563ee6e5c02ec2a8f3661f7658dd8827855e3dec9fee693f249b`

PURPOSE:
CLI pipeline for importing generated questions from cse-question-generator into database.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
@prisma/client, @/lib/prisma, fs, path.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
Prisma DB, cse-question-generator.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI.

DATABASE USAGE:
Bulk creates Question records.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Offline ingestion bridge.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Important ingestion bridge tool; keep for future batch imports.

RISK: MEDIUM

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (INGESTION TOOL) — REVIEW REQUIRED

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #022
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/inspect-everything.ts`
TYPE: CLI TypeScript Script
SIZE: 4317 bytes
LAST MODIFIED: 2026-08-15T05:03:11.177Z
SHA-256: `a18cb9ef87030f633bd54e2a7e6cb0c26b01ac637ac10878cecbc87e2bab5473`

PURPOSE:
CLI inspection tool for DB statistics across all tables.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
@prisma/client, @/lib/prisma.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
Prisma DB.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI.

DATABASE USAGE:
Counts rows across tables.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Developer diagnostics.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Diagnostic script.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (DIAGNOSTIC TOOL) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #023
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/inspect-softdeleted.ts`
TYPE: CLI TypeScript Script
SIZE: 510 bytes
LAST MODIFIED: 2026-08-15T05:04:10.179Z
SHA-256: `25b805a34acaa2072fdac668d50370d20d6da452ed372c46c86caeab6f2e4ff3`

PURPOSE:
CLI inspection tool for soft-deleted DB records.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
@prisma/client, @/lib/prisma.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
Prisma DB.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI.

DATABASE USAGE:
Queries soft-deleted rows.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Developer diagnostics.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Diagnostic script.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (DIAGNOSTIC TOOL) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #024
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/sanitize-csvs.ts`
TYPE: CLI TypeScript Script
SIZE: 4722 bytes
LAST MODIFIED: 2026-08-15T05:07:55.320Z
SHA-256: `799546f31429c1ea1a4181c4d2ca8f21bf10dbc82975026c03c03e83598e7f1e`

PURPOSE:
CLI sanitizer script for CSV question files.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
fs, path.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
CSV files.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI.

DATABASE USAGE:
None.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
CSV maintenance.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Maintenance tool.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (MAINTENANCE SCRIPT) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #025
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/test-backup-system.ts`
TYPE: CLI TypeScript Script
SIZE: 3347 bytes
LAST MODIFIED: 2026-08-09T05:07:08.041Z
SHA-256: `5347b240a38e7bcaacb52f3766bbb699787dfb992057b0c723c552dbe7a5e392`

PURPOSE:
Automated test script for verifying database backup system.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
@prisma/client, @/lib/prisma, @/lib/backup/*

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
Prisma DB, backup services.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI test.

DATABASE USAGE:
Tests backup and restore mechanisms.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Test harness.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Test script.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (TEST HARNESS) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/test-mock-exam-generation.ts`
TYPE: CLI TypeScript Script
SIZE: 4958 bytes
LAST MODIFIED: 2026-08-14T23:16:42.383Z
SHA-256: `5ce69495b2dd0fe6302fc7d9de427297207bf3ca71c1eaf319187b457d5028b6`

PURPOSE:
Automated test script for mock exam question distribution.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
@prisma/client, @/lib/prisma.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
Prisma DB.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI test.

DATABASE USAGE:
Tests exam question sampler.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Test harness.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Test script.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (TEST HARNESS) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #027
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/test-resilience.ts`
TYPE: CLI TypeScript Script
SIZE: 1862 bytes
LAST MODIFIED: 2026-08-07T08:10:32.795Z
SHA-256: `fce4efcbeb9c40167f8358a7a51ef189f3659c7410a27066cce9477b6790ed02`

PURPOSE:
Resilience test script for database failover and retry loops.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
@prisma/client, @/lib/prisma.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
Prisma DB.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI test.

DATABASE USAGE:
Tests DB connections.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Test harness.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Test script.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (TEST HARNESS) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #028
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/test-sudo.ts`
TYPE: CLI TypeScript Script
SIZE: 933 bytes
LAST MODIFIED: 2026-08-07T08:59:07.072Z
SHA-256: `605c8ede5bf835a2a031130caceb1d2c88dbc14dd31e5b015aca8046069d48f2`

PURPOSE:
Automated test script for sudo mode admin password verification.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
@prisma/client, @/lib/prisma, @/lib/auth/sudoMode.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
Sudo mode auth.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI test.

DATABASE USAGE:
Tests sudo mode.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Test harness.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Test script.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (TEST HARNESS) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #029
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `scripts/update-schema-softdelete.js`
TYPE: Node Migration Script
SIZE: 960 bytes
LAST MODIFIED: 2026-08-07T09:53:31.477Z
SHA-256: `5852ec332af4c4190c61cce56b5dca5dbb9864245d1038f22738e77219686b77`

PURPOSE:
Migration helper script for soft delete fields.

WHAT REFERENCES IT:
None.

WHAT IT REFERENCES:
pg, dotenv.

REVERSE DEPENDENCIES:
None.

TRANSITIVE DEPENDENCIES:
PostgreSQL DB.

DYNAMIC USAGE:
CLI execution.

ROUTE USAGE:
None.

SERVER USAGE:
Standalone CLI.

DATABASE USAGE:
Executes DDL alter table.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Historical migration.

WHY IT APPEARS UNUSED:
Not imported in Next.js web runtime.

WHY DELETION IS SAFE:
Historical migration helper.

RISK: LOW

CLASSIFICATION: B — PROBABLY UNUSED IN RUNTIME (MIGRATION TOOL) — REVIEW REQUIRED

RECOMMENDATION: KEEP AS DEV TOOL (OR QUARANTINE IF REQUESTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #030
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/proxy.ts`
TYPE: TypeScript Core Proxy
SIZE: 2478 bytes
LAST MODIFIED: 2026-08-15T02:39:33.991Z
SHA-256: `fa4f3d6631ff15dfced5bbc8d2c00f2bd9470b0ef013a01c8ffb0cec4542548b`

PURPOSE:
Next.js 16 core authentication & route protection proxy/middleware.

WHAT REFERENCES IT:
Next.js 16 Framework runtime Proxy convention.

WHAT IT REFERENCES:
next/server, @/lib/auth (verifyJWT).

REVERSE DEPENDENCIES:
Next.js Framework Router / Middleware Engine.

TRANSITIVE DEPENDENCIES:
All protected /admin and /dashboard routes.

DYNAMIC USAGE:
Intercepts every incoming HTTP request to protected routes.

ROUTE USAGE:
Protects /admin/*, /dashboard/*, /mock-exam/*, /practice/*, /social/*, etc.

SERVER USAGE:
Edge/Node Next.js Request Pipeline.

DATABASE USAGE:
Validates session JWT cookie.

BUILD USAGE:
Compiled into Next.js Proxy bundle (ƒ Proxy Middleware).

DEPLOYMENT USAGE:
Vercel Edge/Serverless Middleware.

CONFIGURATION USAGE:
Matcher config.

ASSET USAGE:
Bypasses static assets.

EXTERNAL USAGE:
Intercepts all client navigation.

WHY IT APPEARS UNUSED:
Does not have explicit source-code imports because Next.js loads proxy.ts by convention.

WHY DELETION IS SAFE:
CANNOT BE DELETED. Deletion would break all authentication and route access controls.

RISK: HIGH

CLASSIFICATION: D — DEFINITELY USED (CRITICAL SYSTEM PROXY)

RECOMMENDATION: KEEP (ABSOLUTELY PROTECTED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #031
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/components/admin/DatabaseStorageWidget.tsx`
TYPE: React TSX Component
SIZE: 4064 bytes
LAST MODIFIED: 2026-08-08T11:40:39.160Z
SHA-256: `97e61abd5ef294aeb5ab58852d63b8eb9fb47379743e3899387265793a7f6ebc`

PURPOSE:
Admin DB storage metric & disk usage visualization widget.

WHAT REFERENCES IT:
Admin dashboard subsystems.

WHAT IT REFERENCES:
react, lucide-react, fetch.

REVERSE DEPENDENCIES:
Admin dashboard modules.

TRANSITIVE DEPENDENCIES:
/api/admin/db-storage route.

DYNAMIC USAGE:
Admin dashboard modular component.

ROUTE USAGE:
/admin/health, /admin/system, /admin/dashboard.

SERVER USAGE:
Consumes /api/admin/db-storage.

DATABASE USAGE:
Displays PostgreSQL disk metrics.

BUILD USAGE:
Compiled during Next.js production build.

DEPLOYMENT USAGE:
Admin UI.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Admin user monitoring.

WHY IT APPEARS UNUSED:
May be optionally mounted in modular admin panels.

WHY DELETION IS SAFE:
N/A - Feature component.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (ADMIN DASHBOARD FEATURE)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #032
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/components/analytics/CategoryBreakdown.tsx`
TYPE: React TSX Component
SIZE: 3134 bytes
LAST MODIFIED: 2026-08-07T06:45:07.483Z
SHA-256: `40e963ad589e45cf719e174c348777b6d783a1451d2a5fc3cb5021fe69e19143`

PURPOSE:
Subject & category accuracy breakdown visualization card.

WHAT REFERENCES IT:
Analytics and Readiness modules.

WHAT IT REFERENCES:
react, recharts, lucide-react.

REVERSE DEPENDENCIES:
Analytics overview.

TRANSITIVE DEPENDENCIES:
User analytics endpoints.

DYNAMIC USAGE:
Analytics card.

ROUTE USAGE:
/profile, /dashboard, /readiness-card.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
Compiled during Next.js build.

DEPLOYMENT USAGE:
Client bundle.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
User analytics UI.

WHY IT APPEARS UNUSED:
Modular chart card.

WHY DELETION IS SAFE:
N/A - Feature component.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (ANALYTICS FEATURE)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #033
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/components/cse/GroupErrorReview.tsx`
TYPE: React TSX Component
SIZE: 3756 bytes
LAST MODIFIED: 2026-08-10T10:50:54.312Z
SHA-256: `1b0d880b9d3aebac66e20ab573f2b42c6a98d6772edbddafccc328675caf01fa`

PURPOSE:
Review component for group drill errors and common traps.

WHAT REFERENCES IT:
Drill and Study Together features.

WHAT IT REFERENCES:
react, @/types/cse, @/lib/formatPrompt.

REVERSE DEPENDENCIES:
Study Together event review.

TRANSITIVE DEPENDENCIES:
CSE Drill review pipelines.

DYNAMIC USAGE:
Drill post-session review.

ROUTE USAGE:
/drills, /social.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
Compiled during build.

DEPLOYMENT USAGE:
Client UI.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Student review.

WHY IT APPEARS UNUSED:
Part of Study Together / Live Drill suite.

WHY DELETION IS SAFE:
N/A - Feature component.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (CSE REVIEW FEATURE)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #034
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/components/cse/LiveSpeedDrill.tsx`
TYPE: React TSX Component
SIZE: 9345 bytes
LAST MODIFIED: 2026-08-10T07:47:21.343Z
SHA-256: `468f3afd547903760b3b033c268e55eed9b2e51c46a4cdbede4e523e95ed44ba`

PURPOSE:
Real-time multi-user live speed drill practice stage.

WHAT REFERENCES IT:
Drill modules and Social rooms.

WHAT IT REFERENCES:
react, @/types/cse, ./CategoryTagging, @/lib/formatPrompt.

REVERSE DEPENDENCIES:
Speed drill session manager.

TRANSITIVE DEPENDENCIES:
/api/drills endpoints.

DYNAMIC USAGE:
Live drill stage.

ROUTE USAGE:
/drills, /social.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
Compiled during build.

DEPLOYMENT USAGE:
Client UI.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Real-time drill interactions.

WHY IT APPEARS UNUSED:
Modular speed drill widget.

WHY DELETION IS SAFE:
N/A - Feature component.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (CSE DRILL FEATURE)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #035
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/components/cse/NotificationSystem.tsx`
TYPE: React TSX Component
SIZE: 4258 bytes
LAST MODIFIED: 2026-08-10T10:50:54.315Z
SHA-256: `c8f7a51672664a1abee46c026fc80dd9d262ad41a0f47d901afc1cfd9ff7aa92`

PURPOSE:
In-app event notification drawer and alert popups.

WHAT REFERENCES IT:
Social and event notifications.

WHAT IT REFERENCES:
react, @/types/cse.

REVERSE DEPENDENCIES:
Study event alerts.

TRANSITIVE DEPENDENCIES:
/api/notifications.

DYNAMIC USAGE:
Event notification polling/listening.

ROUTE USAGE:
/dashboard, /social.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
Compiled during build.

DEPLOYMENT USAGE:
Client UI.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Event alerts.

WHY IT APPEARS UNUSED:
Modular notification drawer.

WHY DELETION IS SAFE:
N/A - Feature component.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (NOTIFICATION FEATURE)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #036
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/components/cse/PostExamDashboard.tsx`
TYPE: React TSX Component
SIZE: 6247 bytes
LAST MODIFIED: 2026-08-10T10:50:54.316Z
SHA-256: `b925522232661b352bbbe7a7fd8df11cc20e24e173c06bbb0aa065847b33da61`

PURPOSE:
Study Together event post-exam summary and live leaderboard display.

WHAT REFERENCES IT:
Study Together event mode.

WHAT IT REFERENCES:
react, @/types/cse, ./EventLeaderboard, @/services/questionBankService.

REVERSE DEPENDENCIES:
Live study event workflow.

TRANSITIVE DEPENDENCIES:
QuestionBankService leaderboard sorting.

DYNAMIC USAGE:
Post-event screen.

ROUTE USAGE:
/social.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
Compiled during build.

DEPLOYMENT USAGE:
Client UI.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Student leaderboard viewing.

WHY IT APPEARS UNUSED:
Modular post-exam event view.

WHY DELETION IS SAFE:
N/A - Feature component.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (STUDY TOGETHER FEATURE)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #037
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/components/cse/StudyTogetherModal.tsx`
TYPE: React TSX Component
SIZE: 8690 bytes
LAST MODIFIED: 2026-08-10T10:50:54.316Z
SHA-256: `1cc0b456d6a24a90e8b87d2d06a1729ff60c67ca44f6d21fdd89d8ee352731b3`

PURPOSE:
Modal for creating and scheduling collaborative Study Together events.

WHAT REFERENCES IT:
Study Together event creation.

WHAT IT REFERENCES:
react, @/types/cse, ./CategoryTagging.

REVERSE DEPENDENCIES:
Event creation action.

TRANSITIVE DEPENDENCIES:
/api/social/events.

DYNAMIC USAGE:
Modal launcher.

ROUTE USAGE:
/social.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
Compiled during build.

DEPLOYMENT USAGE:
Client UI.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Event creation.

WHY IT APPEARS UNUSED:
Modular creation dialog.

WHY DELETION IS SAFE:
N/A - Feature component.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (STUDY TOGETHER FEATURE)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #038
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/components/dashboard/AnalyticsOverview.tsx`
TYPE: React TSX Component
SIZE: 5939 bytes
LAST MODIFIED: 2026-08-07T06:45:07.483Z
SHA-256: `96c63b9911afaf819241fe851bdb1d7357a1e6cfcf732c1114e99c9dbfca75ff`

PURPOSE:
Analytics KPI card grid for user dashboard.

WHAT REFERENCES IT:
User dashboard module.

WHAT IT REFERENCES:
react.

REVERSE DEPENDENCIES:
Dashboard layout.

TRANSITIVE DEPENDENCIES:
User analytics state.

DYNAMIC USAGE:
Dashboard widget.

ROUTE USAGE:
/dashboard.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
Compiled during build.

DEPLOYMENT USAGE:
Client UI.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
User analytics dashboard.

WHY IT APPEARS UNUSED:
Alternative/modular dashboard card.

WHY DELETION IS SAFE:
N/A - Feature component.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (DASHBOARD FEATURE)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #039
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/components/dashboard/ReviewCenter.tsx`
TYPE: React TSX Component
SIZE: 2702 bytes
LAST MODIFIED: 2026-08-07T06:45:07.483Z
SHA-256: `d2d062b54ead0d073ed0ca11a4e669afff1a538a8dbe6405190422621e641f55`

PURPOSE:
Review navigation hub widget with quick links to mock exams and drills.

WHAT REFERENCES IT:
Dashboard overview module.

WHAT IT REFERENCES:
next/link.

REVERSE DEPENDENCIES:
Dashboard home.

TRANSITIVE DEPENDENCIES:
Navigation links.

DYNAMIC USAGE:
Dashboard hub.

ROUTE USAGE:
/dashboard.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
Compiled during build.

DEPLOYMENT USAGE:
Client UI.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
User navigation.

WHY IT APPEARS UNUSED:
Modular dashboard navigation widget.

WHY DELETION IS SAFE:
N/A - Feature component.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (DASHBOARD FEATURE)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #040
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/components/exam/CancelExamModal.tsx`
TYPE: React TSX Component
SIZE: 4361 bytes
LAST MODIFIED: 2026-08-07T06:45:07.483Z
SHA-256: `2cc21c62c3fdee0f54c3d43fa88231284b92c7f561aaae506e90289e9e01c8fa`

PURPOSE:
Confirmation modal when canceling an active mock exam attempt.

WHAT REFERENCES IT:
Exam runner components.

WHAT IT REFERENCES:
react, next/navigation.

REVERSE DEPENDENCIES:
Mock exam flow.

TRANSITIVE DEPENDENCIES:
Exam draft saving.

DYNAMIC USAGE:
Exam exit flow.

ROUTE USAGE:
/mock-exam/take, /exam.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
Compiled during build.

DEPLOYMENT USAGE:
Client UI.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Exam exit confirmation.

WHY IT APPEARS UNUSED:
Modular exam dialog.

WHY DELETION IS SAFE:
N/A - Feature component.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (EXAM FLOW FEATURE)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #041
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/components/social/DeleteRoomModal.tsx`
TYPE: React TSX Component
SIZE: 2850 bytes
LAST MODIFIED: 2026-08-12T11:08:27.765Z
SHA-256: `3f100dbc56f5808857a5c5bfbb1860bfa0daa40265a160998efc45d17cbb6a76`

PURPOSE:
Confirmation modal when deleting a study room in social hub.

WHAT REFERENCES IT:
Social room management.

WHAT IT REFERENCES:
react.

REVERSE DEPENDENCIES:
StudyRoomsSection.

TRANSITIVE DEPENDENCIES:
/api/social/rooms/[roomId].

DYNAMIC USAGE:
Room deletion confirmation.

ROUTE USAGE:
/social.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
Compiled during build.

DEPLOYMENT USAGE:
Client UI.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Room deletion action.

WHY IT APPEARS UNUSED:
Modular deletion dialog.

WHY DELETION IS SAFE:
N/A - Feature component.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (SOCIAL ROOM FEATURE)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #042
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/hooks/useSubmitLock.ts`
TYPE: Custom React Hook
SIZE: 1033 bytes
LAST MODIFIED: 2026-08-07T08:07:26.584Z
SHA-256: `5f36a62f66807bdb57b1af7c3d18b35008c55086d892739af44a355d8454d85b`

PURPOSE:
Hook for preventing double submissions and rapid clicking on async actions.

WHAT REFERENCES IT:
Form submission handlers.

WHAT IT REFERENCES:
react.

REVERSE DEPENDENCIES:
UI buttons and forms.

TRANSITIVE DEPENDENCIES:
Form validation and submission.

DYNAMIC USAGE:
UI submit debouncing.

ROUTE USAGE:
Client forms.

SERVER USAGE:
None.

DATABASE USAGE:
None.

BUILD USAGE:
Compiled during build.

DEPLOYMENT USAGE:
Client bundle.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Client submit lock.

WHY IT APPEARS UNUSED:
Companion hook to useDoubleSubmitPreventer.

WHY DELETION IS SAFE:
N/A - Reusable hook.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (SECURITY HOOK)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #043
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/lib/error/apiHandler.ts`
TYPE: TypeScript Server Utility
SIZE: 1547 bytes
LAST MODIFIED: 2026-08-07T07:57:07.587Z
SHA-256: `c8ed7cf117ee4b07ffdfad47215cb578b68dc2e88a01a56e77b1b5446beeaeea`

PURPOSE:
Higher-order wrapper providing uniform error handling and logging for API routes.

WHAT REFERENCES IT:
API Route Handlers.

WHAT IT REFERENCES:
next/server, @/lib/logger/logger.

REVERSE DEPENDENCIES:
API endpoints.

TRANSITIVE DEPENDENCIES:
Structured server logging.

DYNAMIC USAGE:
API route error wrapping.

ROUTE USAGE:
/api/*

SERVER USAGE:
API error handling.

DATABASE USAGE:
None directly.

BUILD USAGE:
Compiled into server bundle.

DEPLOYMENT USAGE:
Serverless routes.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Error responses.

WHY IT APPEARS UNUSED:
Modular error wrapper.

WHY DELETION IS SAFE:
N/A - Core server utility.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (ERROR HANDLING UTILITY)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #044
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/middleware/requestLogger.ts`
TYPE: TypeScript Middleware Utility
SIZE: 1799 bytes
LAST MODIFIED: 2026-08-07T07:55:11.129Z
SHA-256: `f4bb7eb745f8bb8a5a846f3f54660a1311edf4787f040a75a288df1035136712`

PURPOSE:
Express/Node request logger adapter.

WHAT REFERENCES IT:
Server logger pipelines.

WHAT IT REFERENCES:
../lib/logger/logger, ../lib/logger/types.

REVERSE DEPENDENCIES:
Server logging.

TRANSITIVE DEPENDENCIES:
Structured logging.

DYNAMIC USAGE:
Request timing and logging.

ROUTE USAGE:
Server pipeline.

SERVER USAGE:
Request metadata recording.

DATABASE USAGE:
None.

BUILD USAGE:
Compiled into server bundle.

DEPLOYMENT USAGE:
Server logging.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Log sinks.

WHY IT APPEARS UNUSED:
Modular logger middleware.

WHY DELETION IS SAFE:
N/A - Logging utility.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (LOGGING UTILITY)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #045
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/middleware/softDeleteFilter.ts`
TYPE: TypeScript Middleware Utility
SIZE: 490 bytes
LAST MODIFIED: 2026-08-07T09:28:48.686Z
SHA-256: `3ae50dffcb9db098db3beefa046e6e23741c7926921feb602036867252228251`

PURPOSE:
Utility for automatically appending soft delete filters to Prisma where clauses.

WHAT REFERENCES IT:
Soft delete query helpers.

WHAT IT REFERENCES:
@/types/softDelete.

REVERSE DEPENDENCIES:
Soft delete queries.

TRANSITIVE DEPENDENCIES:
Prisma query filters.

DYNAMIC USAGE:
Soft delete filtering.

ROUTE USAGE:
Admin trash, recovery endpoints.

SERVER USAGE:
DB query filtering.

DATABASE USAGE:
Prisma where clauses.

BUILD USAGE:
Compiled into server bundle.

DEPLOYMENT USAGE:
Serverless handlers.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Data recovery and purge.

WHY IT APPEARS UNUSED:
Modular soft delete helper.

WHY DELETION IS SAFE:
N/A - Data protection utility.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (DB RECOVERY UTILITY)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #046
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/middleware/validate.ts`
TYPE: TypeScript Middleware Utility
SIZE: 1815 bytes
LAST MODIFIED: 2026-08-07T08:06:05.460Z
SHA-256: `306f14e2ec5367482a0f7e40dfba734f57fbbb5ae454e4a9e9f500424e0119b3`

PURPOSE:
Higher-order middleware for sanitizing and validating JSON request payloads.

WHAT REFERENCES IT:
API Route validation pipelines.

WHAT IT REFERENCES:
next/server, @/lib/logger/logger, @/lib/validation/sanitizer, @/lib/validation/schemas.

REVERSE DEPENDENCIES:
API Route Handlers.

TRANSITIVE DEPENDENCIES:
Payload sanitization.

DYNAMIC USAGE:
Route payload validation.

ROUTE USAGE:
/api/*

SERVER USAGE:
Input sanitization.

DATABASE USAGE:
None directly.

BUILD USAGE:
Compiled into server bundle.

DEPLOYMENT USAGE:
Serverless routes.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Bad request rejection.

WHY IT APPEARS UNUSED:
Modular validation wrapper.

WHY DELETION IS SAFE:
N/A - Security validation utility.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (VALIDATION UTILITY)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #047
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/scripts/migrateEncryption.ts`
TYPE: TypeScript Migration Script
SIZE: 2196 bytes
LAST MODIFIED: 2026-08-07T09:24:31.813Z
SHA-256: `661b8472471532c41057c010744ff32f0420e852c84ecd8217e3dde21450d169`

PURPOSE:
AES-256-GCM encryption migration pipeline for securing sensitive database fields.

WHAT REFERENCES IT:
Security migration utilities.

WHAT IT REFERENCES:
@/lib/prisma, @/lib/crypto/encryption, @/lib/logger/logger.

REVERSE DEPENDENCIES:
Security pipelines.

TRANSITIVE DEPENDENCIES:
Prisma DB, Encryption module.

DYNAMIC USAGE:
Encryption backfill migration.

ROUTE USAGE:
None.

SERVER USAGE:
Security CLI.

DATABASE USAGE:
Encrypts sensitive table columns in place.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Security backfill.

WHY IT APPEARS UNUSED:
Standalone encryption backfill tool.

WHY DELETION IS SAFE:
N/A - Security migration asset.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (SECURITY MIGRATION TOOL)

RECOMMENDATION: KEEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANDIDATE #048
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: `src/scripts/test-phase6b.ts`
TYPE: TypeScript Test Script
SIZE: 1773 bytes
LAST MODIFIED: 2026-08-07T09:24:41.317Z
SHA-256: `fc8003eb56b6be6a1deb4de031519720a03f9a5c51ad14837608a5b880ab48d2`

PURPOSE:
Verification script for testing AES-256-GCM cryptographic encryption and decryption.

WHAT REFERENCES IT:
Security test suites.

WHAT IT REFERENCES:
../lib/crypto/encryption, ../lib/crypto/fieldTransformer.

REVERSE DEPENDENCIES:
Security verification.

TRANSITIVE DEPENDENCIES:
Crypto module.

DYNAMIC USAGE:
Crypto test execution.

ROUTE USAGE:
None.

SERVER USAGE:
Security test.

DATABASE USAGE:
None.

BUILD USAGE:
None.

DEPLOYMENT USAGE:
None.

CONFIGURATION USAGE:
None.

ASSET USAGE:
None.

EXTERNAL USAGE:
Crypto verification.

WHY IT APPEARS UNUSED:
Standalone security test harness.

WHY DELETION IS SAFE:
N/A - Security test asset.

RISK: MEDIUM

CLASSIFICATION: C — POSSIBLE HIDDEN DEPENDENCY (SECURITY TEST TOOL)

RECOMMENDATION: KEEP
