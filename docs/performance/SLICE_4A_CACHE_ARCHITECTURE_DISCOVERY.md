# GovStudyX — Performance Hardening
# Slice 4A: Cache Architecture, Data-Scope Classification & Invalidation Discovery

**Document Version**: 1.0.0
**Date**: 2026-09-06
**Repository Worktree**: `C:\Users\Administrator\govstudyx-performance-4a`
**Branch**: `performance/cache-architecture`
**Baseline HEAD**: `7bce0b0234d57fc806e20742f5b056617fc3fac2`
**Scope**: Discovery, Data Classification, Cache Layer Architecture & Invalidation Discovery Only.
**Strict Implementation Policy**: Zero runtime changes, zero cache helpers, zero dependencies, zero backend modifications.

---

## 1. Executive Summary

Slice 4A establishes the authoritative architectural foundation for caching and invalidation across GovStudyX. Prior performance work (Baseline Audit, Slice 2A Payload Reduction, Slices 3A/3B/3C Auth Ownership, Polling Reduction, and Debounce/Cancellation) stabilized frontend and client-side request frequency. Slice 4A investigates server-side and client-side data boundaries, cross-user isolation, mutation lifecycle, and cache invalidation mechanics to prepare for future execution in Slice 4B.

### Key Discoveries:
1. **Critical Client-Side Isolation Vulnerability in Existing Cache**:
   `src/lib/clientCache.ts` provides a `sessionStorage` caching mechanism keyed solely on the URL (`cse_cache_${url}`) without user identity binding. In `src/components/profile/BadgeDisplay.tsx`, the user-private route `/api/user/badges` is fetched with a 5-minute client cache. If User A logs out and User B logs in on the same browser tab, User B is served User A's private badge achievements from `sessionStorage`. Furthermore, `clearCachedData` is defined in `clientCache.ts` but is never invoked anywhere in the application (neither on logout nor on auth state change).
2. **Existing Edge/CDN Headers Lack Invalidation**:
   `src/lib/cache.ts` defines `STATIC_METADATA` (`s-maxage=3600, stale-while-revalidate=86400`) and `PUBLIC_FEED` (`s-maxage=60, stale-while-revalidate=300`). These headers are emitted by `/api/reviewer`, `/api/reading-materials`, `/api/drills`, `/api/csc/public-info`, and `/api/maintenance/status`. However, none of the associated mutation write paths (Admin POST/PUT/DELETE, CSC sync) trigger CDN purges or Next.js tag revalidations. As a result, educational content and maintenance status can remain stale at the Edge for up to 24 hours following administrative edits.
3. **Immutable Cache Risk on Mutable URL**:
   `/api/reading-materials/file/route.ts` streams handbook PDFs/documents directly from the database and emits `Cache-Control: public, max-age=31536000, immutable`. However, the route accepts a bare entity ID (`?id=<id>`) without a content hash or version timestamp. When an administrator updates a handbook and replaces its PDF file via `PUT /api/reading-materials`, the URL remains identical, causing browsers and CDNs to permanently serve the old cached document for up to one year.
4. **Dangerous GET Mutation in CSC Public Route**:
   `GET /api/csc/public-info` contains an auto-fallback routine that executes an unauthenticated database write (`prisma.cSCExamSchedule.upsert`) during a GET request if no future schedule is found, while concurrently returning `STATIC_METADATA` cache headers.
5. **Clear Separation of Top Candidates for Slice 4B**:
   Only two resources satisfy all 13 strict cache acceptance criteria:
   - **Candidate 1**: Reviewer Study Notes Catalog (`StudyNote` list)
   - **Candidate 2**: Reading Materials / Handbooks Metadata Catalog (`Handbook` metadata list, strictly excluding binary file streams)
   All other candidate resources (Pricing, Flashcards, Elimination Drills, CSC Sync, Daily Questions, Question Bank) carry mutation gaps, mixed personal/shared state, dynamic randomization, or financial authority risks and are deferred to Slice 4C or classified as strict live.

---

## 2. Starting Git State

Before starting discovery, the repository worktree and revision were verified:
```powershell
Get-Location
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status
git log -6 --oneline
```

### Verification Record:
- **Worktree**: `C:\Users\Administrator\govstudyx-performance-4a`
- **Toplevel**: `C:/Users/Administrator/govstudyx-performance-4a`
- **Branch**: `performance/cache-architecture`
- **HEAD Commit**: `7bce0b0234d57fc806e20742f5b056617fc3fac2` (`test(payment): allow postgres harnesses on integration branch`)
- **Starting Status**: `On branch performance/cache-architecture`, `nothing to commit, working tree clean`.
- **Pre-Change Commit**: `7bce0b0234d57fc806e20742f5b056617fc3fac2`.

---

## 3. Current Performance / Architecture Baseline

The application baseline incorporates merged readiness, security, and performance hardening:
- **Runtime Environment**: Next.js 16.3.2, React 19.2.4, TypeScript ^5, Prisma 7.9.1, Node.js v24.19.0.
- **Frontend Architecture**: Client-heavy single-page application shells (`RootLayout` wraps `ThemeProvider` and `AuthProvider`).
- **Auth Request Ownership**: Managed centrally by `AuthContext.tsx` and `src/lib/auth/clientAuth.ts` via token-gated active requests, debouncing, and visibility listeners.
- **Financial Architecture**: Append-only idempotent ledger (`FinancialLedgerEntry`), transaction manifest revisions (`PaymentFinalizationManifestRevision`), cryptographically anchored SHA-256 finalization coordinator, strict payment recovery engine, and anti-replay barriers.
- **Database Access Pattern**: Direct Prisma ORM invocations inside Next.js App Router Route Handlers (`src/app/api/**/*.ts`). Zero external caching layer (no Redis, no Upstash, no Memcached).

---

## 4. Data-Scope Classification Model

All resources across GovStudyX are classified into the following 10 primary categories:

| Data Class | Definition | Sharing Boundary | Authority Model | Default Cache Policy |
|---|---|---|---|---|
| `PUBLIC_STATIC` | Content that is completely hardcoded or immutable at build time. No database dependencies. | Global / CDN | Static Build Artifact | Build-time static / Long TTL |
| `PUBLIC_SLOW_CHANGING` | Shared educational catalog metadata, published study notes, and official handbooks. Mutated only via explicit admin actions. | Global / Multi-Tenant | Database + Admin Write | Cacheable ONLY with explicit invalidation |
| `PUBLIC_DYNAMIC` | Publicly viewable data that changes frequently (e.g., active system announcement feeds, countdowns). | Global / Regional Edge | Database / External Sync | Short TTL (30–60s) or strict live |
| `USER_PRIVATE` | Personal user history, bookmarks, exam results, mistake notebooks, profile details, and analytics. | Single User Session | User Authenticated Session | NO SHARED CACHE. Private client memory only. |
| `USER_ENTITLEMENT` | Access rights, `isPaid`, `paidUntil`, `planType`, voucher redemption status, and feature gating. | Single User Session | Live Database Authoritative | STRICT LIVE. Never cache globally or locally across sessions. |
| `ADMIN_PRIVATE` | System settings, user directories, trash bin, backup logs, security flags, and administrative audits. | Admin User Session | Server-side RBAC Enforcement | STRICT LIVE. NO SHARED CACHE. |
| `SECURITY_SENSITIVE` | Session tokens, password reset flows, email verification, active session tracking, and ban states. | Security Boundary | Live Session / Crypto Signatures | STRICT LIVE. Never cache. |
| `FINANCIAL` | PayMongo checkouts, payment verification, webhook ingestion, referral balances, partner commissions, ledger, and taxes. | Financial Boundary | Cryptographic Manifest / Idempotent Ledger | STRICT LIVE. Never cache. Zero stale tolerance. |
| `REALTIME` | Study rooms, participants, chat messages, whiteboard canvas, duels, and WebRTC signaling. | Ephemeral Room Context | Live WebSocket / Short-interval Polling | STRICT LIVE. Never ordinary HTTP cache. |
| `UNKNOWN` | Any endpoint or data flow where data dependencies, personalization, or write paths are ambiguous. | Quarantine | Live Server Validation | DO NOT CACHE. Quarantine pending discovery. |

---

## 5. Existing Cache Mechanisms

GovStudyX currently has two active caching implementations in the codebase:

### 1. Edge/CDN Response Helper: `src/lib/cache.ts`
- **Location**: `src/lib/cache.ts`
- **Implementation**: Defines `CACHE_PROFILES`:
  - `STATIC_METADATA`: `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`
  - `PUBLIC_FEED`: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
  - `PRIVATE`: `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`
  Also sets vendor-specific `CDN-Cache-Control` and `Vercel-CDN-Cache-Control` headers.
- **Consumers**:
  - `src/app/api/reviewer/route.ts` (GET) -> `STATIC_METADATA`
  - `src/app/api/reading-materials/route.ts` (GET) -> `STATIC_METADATA`
  - `src/app/api/drills/route.ts` (GET) -> `STATIC_METADATA`
  - `src/app/api/csc/public-info/route.ts` (GET) -> `STATIC_METADATA`
  - `src/app/api/maintenance/status/route.ts` (GET) -> `PUBLIC_FEED`
  - Error branches and `src/lib/ratelimit.ts` -> `PRIVATE`
- **Critical Flaw**: No cache invalidation mechanism exists. When an admin updates a study note or reading material, the Edge CDN continues serving the stale cached payload for up to 3,600 seconds (and up to 86,400 seconds during stale-while-revalidate background fetches).

### 2. Client-Side Browser Storage Cache: `src/lib/clientCache.ts`
- **Location**: `src/lib/clientCache.ts`
- **Implementation**: In-browser caching using `sessionStorage` with key prefix `cse_cache_${url}` and default 30-minute TTL. Provides `fetchWithClientCache<T>(url, ttlMs, init)`.
- **Consumers**:
  - `src/app/reviewer/page.tsx` (`/api/reviewer`, 30 min)
  - `src/app/reading-materials/page.tsx` (`/api/reading-materials`, 30 min)
  - `src/app/learning/page.tsx` (`/api/reviewer`, `/api/reading-materials`, 30 min)
  - `src/components/CSCCountdownWidget.tsx` (`/api/csc/public-info`, 30 min)
  - `src/components/profile/BadgeDisplay.tsx` (`/api/user/badges`, 5 min)
- **Critical Flaw**:
  1. **Cross-User Data Bleed**: `/api/user/badges` returns user-specific earned badges. Caching under `cse_cache_/api/user/badges` stores personal achievements in browser `sessionStorage` without a user ID namespace. If User A logs out and User B logs in within the same browser session, User B sees User A's badges.
  2. **Orphaned Invalidation Function**: `clearCachedData(key)` is exported in `src/lib/clientCache.ts` line 56, but is never referenced or called anywhere in the entire codebase. Logout and auth changes do not clear `sessionStorage`.

---

## 6. Existing Cache-Control / No-Store / Dynamic Findings

A repository-wide audit of caching directives reveals the following status:

| File / Route | Directive / Header | Evaluation | Rationale |
|---|---|---|---|
| `src/app/api/pricing/route.ts` | `no-store, no-cache, max-age=0, must-revalidate` | **CORRECTLY_LIVE** | Protects against price discrepancies between display UI and checkout. |
| `src/app/api/health/liveness/route.ts` | `export const dynamic = "force-dynamic"` | **CORRECTLY_LIVE** | Operational health monitoring must reflect instant process state. |
| `src/app/api/health/readiness/route.ts` | `export const dynamic = "force-dynamic"` | **CORRECTLY_LIVE** | Database connectivity probe must test live connection on every call. |
| `src/app/api/admin/trash/route.ts` | `export const dynamic = "force-dynamic"` | **CORRECTLY_LIVE** | Admin recovery/trash bin items must reflect immediate soft-delete changes. |
| `src/app/api/drills/elimination/route.ts` | `export const dynamic = "force-dynamic"; export const revalidate = 0;` | **CORRECTLY_LIVE** | Dynamic query parameters (`seenIds`) and randomized question selection per user. |
| `src/app/api/social/posts/route.ts` | `export const dynamic = "force-dynamic"` | **CORRECTLY_LIVE** | Social timeline with live comments and reactions. |
| `src/app/api/reading-materials/file/route.ts` | `Cache-Control: public, max-age=31536000, immutable` | **HIGH RISK / OVER-CONSERVATIVE** | Mutable file uploaded to static URL without content hashing. Stale binary locked in browser for 1 year. |
| `src/app/api/reviewer/route.ts` | `public, s-maxage=3600, stale-while-revalidate=86400` | **UNSAFE WITHOUT INVALIDATION** | Admin updates take up to 24 hours to propagate to edge CDN viewers. |
| `src/app/api/reading-materials/route.ts` | `public, s-maxage=3600, stale-while-revalidate=86400` | **UNSAFE WITHOUT INVALIDATION** | Admin handbook updates/deletions take up to 24 hours to propagate. |
| `src/app/api/maintenance/status/route.ts` | `public, s-maxage=60, stale-while-revalidate=300` | **UNSAFE WITHOUT INVALIDATION** | Emergency maintenance toggles take up to 5 minutes to take effect. |
| `src/app/api/csc/public-info/route.ts` | `public, s-maxage=3600, stale-while-revalidate=86400` | **UNSAFE (GET MUTATION)** | Contains database fallback upsert inside GET; sync updates do not invalidate edge cache. |

---

## 7. Route & Data Inventory

GovStudyX contains 118 API route handlers and 16 Server Component pages. The inventory below details the primary data-handling paths:

### Public Educational Content & Catalogs:
- `GET /api/reviewer`: Queries `prisma.studyNote.findMany()`. Returns all study notes.
- `GET /api/reading-materials`: Queries `prisma.handbook.findMany({ select: { id, title, category, description, pages, fileName, createdAt } })`. Returns handbook catalog metadata.
- `GET /api/reading-materials/file?id=...`: Queries `prisma.handbook.findUnique({ select: { fileData, fileName } })`. Streams binary PDF buffer.
- `GET /api/drills`: Queries `prisma.question.findMany()` for elimination drill questions. (Legacy/uncalled).
- `GET /api/drills/elimination?seenIds=...`: Queries `prisma.question.findMany()`, filters by seen IDs, shuffles and slices 10 items.
- `GET /api/flashcards`: Queries `prisma.flashcard.findMany()`. Auto-seeds default cards if table is empty. Requires auth.
- `GET /api/csc/public-info`: Queries `prisma.cSCExamSchedule`, `prisma.cSCAnnouncement`, `prisma.cSCDownload`. Performs fallback upsert if schedule is empty.

### Authentication & User Identity:
- `GET /api/auth/me`: Authenticates session cookie, verifies concurrent logins, enforces 30-min inactivity timeout, verifies subscription expiration (`paidUntil`), and conditionally writes `lastActiveAt: now`.
- `POST /api/auth/login`, `POST /api/auth/signup`, `POST /api/auth/logout`: Session lifecycle management.
- `GET /api/partner/auth/me`: Partner session verification.

### User Personal Records & Progress:
- `GET /api/user/profile`: User name, email, role, phone, preferences.
- `GET /api/user/badges`: Queries `prisma.userBadge.findMany({ where: { userId } })`.
- `GET /api/user/mistakes`: Queries `prisma.userMistake.findMany({ where: { userId, isMastered: false } })`.
- `GET /api/user/analytics/detailed`: Queries `prisma.examResult` and aggregates accuracy by category.
- `GET /api/user/readiness-card`: Computes student exam readiness score based on user attempt history.
- `GET /api/bookmarks`: Queries `prisma.bookmark.findMany({ where: { userId } })` joined with questions and study notes.
- `GET /api/notifications`: Queries `prisma.notification.findMany({ where: { userId } })`.

### Exam System & Attempt Execution:
- `GET /api/exam/start`: Active exam question generator. Filters questions against user attempt history (`masteredQuestionIds`, unattempted/mistakes pool), shuffles, and structures 170-item or custom test.
- `POST /api/exam/draft`: Persists in-progress exam attempt draft.
- `POST /api/exam/submit`: Grades exam, writes `ExamResult`, `ExamCategoryResult`, updates streak, records mistakes, triggers badges.
- `GET /api/exam/history`, `GET /api/mock-exam/history`: Queries user-specific past exam scores.
- `GET /api/questions/daily`: Generates deterministic daily question prompt, checks user's daily attempt record, and conditionally reveals answer index and explanation.

### Financial, PayMongo & Accounting:
- `GET /api/pricing`: Reads `prisma.pricingPlan` with `no-store` headers.
- `POST /api/paymongo/checkout`: Authenticates user, reads authoritative plan price from DB, validates promo/partner code, creates PayMongo checkout session.
- `POST /api/paymongo/verify`: Verifies PayMongo payment status, invokes `paymentFinalizationCoordinator`.
- `POST /api/paymongo/webhook`: Asynchronous webhook handler for PayMongo charge events.
- `GET /api/admin/accounting/*`: Ledger overview, drilldowns, reconciliation, tax provisions, partner commissions, refund execution.
- `GET /api/partner/portal/*`: Partner earnings, payouts, statements, transactions.

### Social & Collaboration:
- `GET /api/social/rooms`: Active study rooms and participant counts.
- `GET /api/social/rooms/[roomId]/chat`: Chat messages in study room.
- `GET /api/social/rooms/[roomId]/whiteboard`: Canvas stroke history.
- `GET /api/duels/*`: Active 1v1 peer challenges, matchmaking, live duel scores.

---

## 8. Cache Matrix

The following matrix classifies all major read endpoints across GovStudyX:

| Resource | Route / Function | Primary Scope | Cache Class | User-specific? | Auth Required? | Premium Gated? | Financial? | Exam? | Realtime? | Mutation Sources | Candidate Layer | Proposed TTL | Proposed Invalidation | Cross-user Safe? | Risk | Recommended Phase |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Reviewer Study Notes | `GET /api/reviewer` | `PUBLIC_SLOW_CHANGING` | `S1` | No | No | No | No | No | No | Admin POST, PUT, DELETE in `/api/reviewer` | Next.js Server Cache | 1 hour | Tag `reviewer-content` | **YES** | **LOW** | **Slice 4B** |
| Handbooks Catalog Metadata | `GET /api/reading-materials` | `PUBLIC_SLOW_CHANGING` | `S1` | No | No | No | No | No | No | Admin POST, PUT, DELETE in `/api/reading-materials` | Next.js Server Cache | 1 hour | Tag `reading-materials` | **YES** | **LOW** | **Slice 4B** |
| Handbook Binary File Stream | `GET /api/reading-materials/file` | `PUBLIC_SLOW_CHANGING` | `S1` | No | No | No | No | No | No | Admin PUT in `/api/reading-materials` (PDF upload) | HTTP Header / CDN | 1 year | URL version query `?v=<hash>` | **YES** | **MEDIUM** | **Slice 4C** |
| Feature Flags Registry | `GET /api/admin/feature-flags` | `PUBLIC_SLOW_CHANGING` | `S1` | No | No | No | No | No | No | Admin POST in `/api/admin/feature-flags` | Next.js Server Cache | 15 mins | Tag `feature-flags` | **YES** | **LOW** | **Slice 4C** |
| Pricing Catalog (Display) | `GET /api/pricing` | `PUBLIC_SLOW_CHANGING` | `S2` | No | No | No | Yes (Indirect) | No | No | Admin PUT in `/api/admin/pricing` | Do Not Cache (Current) | 0s (no-store) | N/A | **YES** | **HIGH** | **Slice 4C / Defer** |
| CSC Public Timetable | `GET /api/csc/public-info` | `PUBLIC_SLOW_CHANGING` | `S1` | No | No | No | No | No | No | `POST /api/csc/sync`, `POST /api/csc/seed`, GET upsert | Next.js Server Cache | 1 hour | Tag `csc-public-info` | **YES** | **MEDIUM** | **Slice 4C** |
| Elimination Drill Questions | `GET /api/drills` | `PUBLIC_SLOW_CHANGING` | `S1` | No | No | No | No | Yes | No | Admin POST/PUT/DELETE in `admin/elimination-drills` | Do Not Cache (Unused) | N/A | N/A | **YES** | **HIGH** | **DO NOT CACHE** |
| Dynamic Elimination Drills | `GET /api/drills/elimination` | `PUBLIC_DYNAMIC` | `E0` | Semi (seenIds) | No | No | No | Yes | No | Admin question updates, randomizer | Do Not Cache | 0s (force-dynamic) | N/A | **NO** | **HIGH** | **DO NOT CACHE** |
| Daily Question Delivery | `GET /api/questions/daily` | `MIXED` | `E0` | Yes (Attempt) | Optional | No | No | Yes | No | Daily attempt submit, question edit | Do Not Cache Whole Route | 0s | N/A | **NO** | **CRITICAL** | **Slice 4C (Split)** |
| Flashcards Deck | `GET /api/flashcards` | `PUBLIC_SLOW_CHANGING` | `S1` | No | Yes | No | No | No | No | Admin CRUD in `/api/admin/flashcards`, bulk | Next.js Server Cache | 1 hour | Tag `flashcards` | **YES** | **MEDIUM** | **Slice 4C** |
| Full Question Bank Practice | `GET /api/questions` | `MIXED` | `E0` | Yes (Mastered) | Yes | No | No | Yes | No | Admin question imports, user exams | Do Not Cache | 0s | N/A | **NO** | **CRITICAL** | **DO NOT CACHE** |
| Active Exam Start | `GET /api/exam/start` | `USER_PRIVATE` | `E0` | Yes | Yes | No | No | Yes | No | User exam history, randomize | Do Not Cache | 0s | N/A | **NO** | **CRITICAL** | **DO NOT CACHE** |
| Exam Draft State | `GET/POST /api/exam/draft` | `USER_PRIVATE` | `E0` | Yes | Yes | No | No | Yes | No | User draft save/resume | Do Not Cache | 0s | N/A | **NO** | **CRITICAL** | **DO NOT CACHE** |
| Exam Submission & Grading | `POST /api/exam/submit` | `USER_PRIVATE` | `E0` | Yes | Yes | No | No | Yes | No | User answer submission | Do Not Cache | 0s | N/A | **NO** | **CRITICAL** | **DO NOT CACHE** |
| Exam History Results | `GET /api/exam/history` | `USER_PRIVATE` | `U1` | Yes | Yes | No | No | Yes | No | Exam submissions | Do Not Cache Shared | 0s | N/A | **NO** | **HIGH** | **DO NOT CACHE** |
| Auth Session Verification | `GET /api/auth/me` | `SECURITY_SENSITIVE` | `AUTH0` | Yes | Yes | Yes | No | No | No | User activity, login, subscription expire | Do Not Cache | 0s | N/A | **NO** | **CRITICAL** | **DO NOT CACHE** |
| User Badges | `GET /api/user/badges` | `USER_PRIVATE` | `U1` | Yes | Yes | No | No | No | No | Exam submit, streak milestone | Client Memory Only | 0s | Client user-scope | **NO** | **HIGH** | **DO NOT CACHE** |
| User Mistakes Notebook | `GET /api/user/mistakes` | `USER_PRIVATE` | `U1` | Yes | Yes | No | No | Yes | No | Exam submit, practice review | Do Not Cache Shared | 0s | N/A | **NO** | **HIGH** | **DO NOT CACHE** |
| User Bookmarks | `GET /api/bookmarks` | `USER_PRIVATE` | `U1` | Yes | Yes | No | No | No | No | User bookmark toggle | Do Not Cache Shared | 0s | N/A | **NO** | **HIGH** | **DO NOT CACHE** |
| User Analytics Detailed | `GET /api/user/analytics/detailed` | `USER_PRIVATE` | `U1` | Yes | Yes | No | No | Yes | No | Exam submissions | Do Not Cache Shared | 0s | N/A | **NO** | **HIGH** | **DO NOT CACHE** |
| Notifications Feed | `GET /api/notifications` | `USER_PRIVATE` | `U1` | Yes | Yes | No | No | No | Yes | New notifications, mark as read | Do Not Cache Shared | 0s | N/A | **NO** | **HIGH** | **DO NOT CACHE** |
| Maintenance Status | `GET /api/maintenance/status` | `PUBLIC_DYNAMIC` | `O0` | No | No | No | No | No | No | Admin setting update | Next.js Server Cache | 30s | Tag `system-settings` | **YES** | **MEDIUM** | **Slice 4C** |
| Liveness Probe | `GET /api/health/liveness` | `OPERATIONAL_HEALTH` | `O0` | No | No | No | No | No | No | Process health | Do Not Cache | 0s (force-dynamic) | N/A | **YES** | **CRITICAL** | **DO NOT CACHE** |
| Readiness Probe | `GET /api/health/readiness` | `OPERATIONAL_HEALTH` | `O0` | No | No | No | No | No | No | Database connection state | Do Not Cache | 0s (force-dynamic) | N/A | **YES** | **CRITICAL** | **DO NOT CACHE** |
| Background Worker Cron | `GET /api/cron/background-worker`| `OPERATIONAL_HEALTH` | `O0` | No | Cron / Bearer | No | No | No | No | Scheduled job | Do Not Cache | 0s | N/A | **N/A** | **CRITICAL** | **DO NOT CACHE** |
| PayMongo Checkout | `POST /api/paymongo/checkout` | `FINANCIAL` | `F0` | Yes | Yes | Yes | Yes | No | No | User purchase attempt | Do Not Cache | 0s | N/A | **NO** | **CRITICAL** | **DO NOT CACHE** |
| PayMongo Verification | `POST /api/paymongo/verify` | `FINANCIAL` | `F0` | Yes | Yes | Yes | Yes | No | No | Webhook / redirect verify | Do Not Cache | 0s | N/A | **NO** | **CRITICAL** | **DO NOT CACHE** |
| Admin Accounting Ledger | `GET /api/admin/accounting/ledger` | `FINANCIAL` | `F0` | No (Admin) | Yes (Admin) | No | Yes | No | No | Financial transactions | Do Not Cache | 0s | N/A | **NO** | **CRITICAL** | **DO NOT CACHE** |
| Partner Portal Overview | `GET /api/partner/portal/overview` | `FINANCIAL` | `F0` | Yes (Partner) | Yes (Partner) | No | Yes | No | No | Attributions, payouts | Do Not Cache | 0s | N/A | **NO** | **CRITICAL** | **DO NOT CACHE** |
| Referral Status & Balance | `GET /api/referral/me` | `FINANCIAL` | `F0` | Yes | Yes | No | Yes | No | No | Referral conversions, rewards | Do Not Cache | 0s | N/A | **NO** | **CRITICAL** | **DO NOT CACHE** |
| Social Rooms Active List | `GET /api/social/rooms` | `REALTIME` | `R0` | No | Yes | No | No | No | Yes | Room create, join, leave | Do Not Cache Shared | 0s | N/A | **YES** | **HIGH** | **DO NOT CACHE** |
| Study Room Chat Messages | `GET /api/social/rooms/[id]/chat` | `REALTIME` | `R0` | Yes (Room) | Yes | No | No | No | Yes | Chat message post | Do Not Cache | 0s | N/A | **NO** | **CRITICAL** | **DO NOT CACHE** |
| Study Room Whiteboard | `GET /api/social/rooms/[id]/whiteboard`| `REALTIME` | `R0` | Yes (Room) | Yes | No | No | No | Yes | Canvas stroke draw, clear | Do Not Cache | 0s | N/A | **NO** | **CRITICAL** | **DO NOT CACHE** |
| Active Duel Match State | `GET /api/duels/[id]` | `REALTIME` | `R0` | Yes (Match) | Yes | No | No | Yes | Yes | Duel answer submit, forfeit | Do Not Cache | 0s | N/A | **NO** | **CRITICAL** | **DO NOT CACHE** |

---

## 9. Static / Build-Time Resources

GovStudyX possesses several pages and assets that are strictly `PUBLIC_STATIC` / `S0`:
- **Static Marketing Pages**:
  - `src/app/about/page.tsx`: Static company and mission statement.
  - `src/app/contact/page.tsx`: Static contact guidelines.
  - `src/app/privacy/page.tsx`, `src/app/privacy-policy/page.tsx`: Statutory privacy disclosure.
  - `src/app/terms/page.tsx`, `src/app/terms-and-conditions/page.tsx`: Terms of service.
  - `src/app/refund/page.tsx`, `src/app/refund-policy/page.tsx`: Refund terms.
  - `src/app/cookies/page.tsx`, `src/app/cookie-policy/page.tsx`: Cookie compliance policy.
  - `src/app/terms/referral/page.tsx`: Referral program guidelines.
- **Static Reviewer Demo**:
  - `src/app/reviewer/lesson/page.tsx`: Completely hardcoded educational sample lesson ("Converting Fractions to Decimals") with zero database queries.
- **Brand Static Assets**:
  - Images under `public/brand/`, icons, manifest, favicon.

*Architectural Directive*: These routes require zero runtime database caching. They compile to pure static HTML/SSG at Next.js build time.

---

## 10. Low-Risk Shared Cache Candidates

Out of all dynamic endpoints in the application, only two qualify as **LOW RISK** for initial Slice 4B implementation:

### 1. Reviewer Study Notes Catalog (`StudyNote`)
- **Route**: `GET /api/reviewer`
- **Underlying Model**: `prisma.studyNote`
- **Data Returned**: `{ notes: StudyNote[] }` (`id`, `category`, `title`, `summary`, `content`, `tips`, `videoUrl`, `createdAt`, `updatedAt`).
- **Why Safe**:
  - Zero user-specific data.
  - Zero authentication or entitlement restrictions.
  - Byte-for-byte identical for all users nationwide.
  - Read-heavy, low-frequency administrative mutation.
- **Risk Level**: **LOW**.

### 2. Handbooks Catalog Metadata (`Handbook`)
- **Route**: `GET /api/reading-materials`
- **Underlying Model**: `prisma.handbook`
- **Data Returned**: `{ handbooks: DocumentItem[] }` (`id`, `title`, `category`, `description`, `pages`, `fileName`, `createdAt`).
- **Why Safe**:
  - Metadata only; does NOT contain binary PDF payloads.
  - Zero user-specific personalization.
  - Identical catalog across all examinees.
  - Mutated strictly through administrative handbook uploads and deletions.
- **Risk Level**: **LOW**.

---

## 11. Business-Sensitive Shared Candidates

The following resources are shared but carry direct business, operational, or customer pricing sensitivity:

### 1. Public Pricing Plans (`PricingPlan`)
- **Route**: `GET /api/pricing`
- **Current Behavior**: Emits `no-store, no-cache, max-age=0, must-revalidate`.
- **Business Sensitivity**: While display prices are public, any caching creates a divergence window between the price displayed on the landing page and the price enforced by `paymongo/checkout/route.ts`. A user observing 99 PHP on a cached UI could be billed 149 PHP by checkout, triggering customer disputes, chargebacks, and legal violations.
- **Recommendation**: **DO NOT CACHE IN 4B**. Maintain live `no-store` until synchronized display/checkout cache invalidation is architected in Slice 4C.

### 2. Maintenance Status (`SystemSetting`)
- **Route**: `GET /api/maintenance/status`
- **Current Behavior**: Emits `public, s-maxage=60, stale-while-revalidate=300`.
- **Operational Sensitivity**: Caching maintenance status at the edge causes a 1-to-5-minute delay when toggling maintenance mode on or off. During an emergency production outage, users continue accessing routes; conversely, after maintenance ends, users are falsely blocked.
- **Recommendation**: Defer to Slice 4C. Implement explicit `system-settings` revalidation tag before adopting server caching.

---

## 12. User-Private Resources

The following resources contain private user data and must **NEVER** be placed in a shared, multi-tenant, or edge CDN cache:
- `/api/user/profile`: Personal contact details, role, name, phone.
- `/api/user/badges`: User-specific gamification achievements.
- `/api/user/mistakes`: Personal wrong-answer notebook.
- `/api/user/analytics/detailed`: Personal accuracy, score distributions, mastery metrics.
- `/api/user/readiness-card`: Algorithmic probability of passing the Civil Service Exam.
- `/api/bookmarks`: User's saved questions and study notes.
- `/api/notifications`: User-specific in-app notifications and announcements.
- `/api/exam/history`, `/api/mock-exam/history`: Historical exam scores and answer breakdowns.

*Isolation Rule*: Client-side caching for these resources must strictly incorporate the authenticated user's ID in the storage key (`user_${userId}_...`) or reside exclusively in volatile React component state.

---

## 13. User Entitlement Resources

The entitlement boundary governs premium features, practice quizzes, and mock exams:
- **Core Entitlement Fields**: `isPaid`, `paidUntil`, `planType`, `role`.
- **Authoritative Enforcement Point**: Server-side in `src/app/api/auth/me/route.ts` and `src/lib/serverAuth.ts` via `requireProAuth()`.
- **Subscription Expiration Guard**: `auth/me` executes a conditional compare-and-swap query:
  ```ts
  if (user.paidUntil && user.paidUntil < now && user.role !== "ADMIN") {
    await prisma.user.updateMany({
      where: { id: user.id, paidUntil: { lt: now } },
      data: { isPaid: false },
    });
  }
  ```
- **Voucher Redemption**: `/api/vouchers/redeem` immediately provisions entitlements in database transactions.

*Strict Rule*: Never cache entitlement decisions globally or locally across sessions. A user who purchases Premium or redeems a voucher must receive instantaneous access without waiting for cache expiration.

---

## 14. Admin-Private Resources

Administrative endpoints handle security-critical and operational operations:
- `/api/admin/users`: User directory, ban/unban toggles, role demotions/promotions.
- `/api/admin/accounting/*`: Full ledger, partner commissions, tax records, refunds.
- `/api/admin/trash`: Soft-deleted recovery bin for questions, users, and flashcards.
- `/api/admin/backups`: System snapshot creation and database restoration.
- `/api/admin/support-tickets`: User support inquiries and resolution.
- `/api/admin/logs`, `/api/admin/login-history`: Security audit trails.

*Strict Rule*: Administrative routes must enforce server-side role verification (`user.role === 'ADMIN'`) on every request. No shared caching is permitted.

---

## 15. Security / Auth No-Cache Zone

Authentication and session integrity are strictly **ZERO CACHE**:
- `/api/auth/me`: Validates session cookie, checks for concurrent logins (`SESSION_MISMATCH`), detects 30-minute inactivity, validates subscription status, and records `lastActiveAt`. Any caching of `/api/auth/me` completely destroys session revocation and concurrent login detection.
- `/api/auth/login`, `/api/auth/logout`, `/api/auth/signup`: Modifies cryptographic HTTP-only cookie headers.
- `/api/auth/forgot-password`, `/api/auth/reset-password`: One-time crypto tokens.
- `/api/partner/auth/*`: Partner session authentication.

*Classification*: `SECURITY_SENSITIVE / AUTH0 / STRICT LIVE`.

---

## 16. Financial / Payment / Accounting No-Cache Zone

Financial integrity is safety-critical. All financial endpoints are classified as **STRICT LIVE**:
- `/api/paymongo/checkout`: Resolves dynamic pricing, promo codes, and creates payment intents.
- `/api/paymongo/verify`: Server-side payment verification and immutable ledger entry creation.
- `/api/paymongo/webhook`: Asynchronous payment capture and finalization coordinator execution.
- `/api/admin/accounting/*`: Ledger reconciliation, payout execution, tax provisioning, refund processing.
- `/api/partner/portal/*`: Commission calculations, partner payouts, ledger statements.
- `/api/referral/*`: Referral reward calculations and payouts.

*Strict Rule*: Zero stale tolerance. Never introduce caching into financial read or write paths.

---

## 17. Active Exam No-Cache Zone

The exam engine delivers randomized, timed, high-stakes examination simulations:
- `/api/exam/start`: Selects 170 questions according to official Civil Service Exam quotas, excludes user-mastered questions, and performs Fisher-Yates randomization.
- `/api/exam/draft`: Stores ephemeral exam drafts.
- `/api/exam/submit`: Grades answer submissions against database keys and writes attempt results.
- `/api/questions`: Used for custom quizzes; filters dynamically by user mastery.

*Strict Rule*: Caching active exam question delivery would cause multiple examinees to receive identical randomized sequences, compromise answer key confidentiality, or leak answered status. Caching is strictly forbidden.

---

## 18. Realtime / Social No-Cache Zone

Social and collaborative features depend on live state:
- `/api/social/rooms`: Active study rooms and participant presence.
- `/api/social/rooms/[roomId]/chat`: Ephemeral chat messages.
- `/api/social/rooms/[roomId]/whiteboard`: Interactive canvas draw events.
- `/api/social/rooms/[roomId]/voice-token`: LiveKit WebRTC access tokens.
- `/api/duels/*`: Realtime 1v1 battle matchmaking, timers, and point increments.

*Classification*: `REALTIME / R0 / STRICT LIVE`.

---

## 19. Operational Health No-Cache Zone

Health checks must reflect actual live process and database readiness:
- `/api/health/liveness`: Returns `{ status: 'ok', timestamp: ... }`. Must confirm the Node.js event loop is responsive.
- `/api/health/readiness`: Executes `prisma.$queryRaw\`SELECT 1\``. Must verify live database socket connectivity.
- `/api/cron/*`: Cron job executions (health monitor, database storage check, daily backup, background worker).

*Classification*: `OPERATIONAL_HEALTH / O0 / STRICT LIVE`.

---

## 20. Mixed Shared + Personalized Responses

Several endpoints combine globally shared educational content with user-specific personalized fields:

| Route | Shared Content | Personalized Fields | Entitlement Fields | Leak Risk If Cached Whole | Recommendation |
|---|---|---|---|---|---|
| `GET /api/questions/daily` | Today's question prompt, options, category, subtopic. | `hasAnswered`, `userAnswerIndex`, `isCorrect`. | Answer index & explanation revealed ONLY if user answered. | **CRITICAL**: User B receives User A's answered status and correct answer key. | **SPLIT_SHARED_HELPER_LATER (Slice 4C)** |
| `GET /api/questions` | Question prompts, options, explanations. | `masteredQuestionIds` filtering based on user exam history. | Custom quiz limit. | **HIGH**: User B receives question pool filtered by User A's weaknesses. | **DO NOT CACHE** |
| `GET /api/exam/start` | Question prompts and options. | User unattempted/mistake pool selection, randomized order. | Timed vs self-paced. | **CRITICAL**: Fixed seed delivered across users; leaks answer structure. | **DO NOT CACHE** |
| `GET /api/drills/elimination` | Question prompts, options, elimination distractors. | `seenIds` query parameter filtering. | None. | **HIGH**: Stale question cycle; user repeatedly served seen questions. | **DO NOT CACHE** |
| `GET /api/social/rooms/[id]/topic` | Question bank options for room study. | Room host/member authorization check, search filter. | Room privacy. | **HIGH**: Room privacy bypass or stale topic list. | **DO NOT CACHE** |

---

## 21. Reviewer Content Findings

- **Model**: `StudyNote` (`id`, `category`, `title`, `summary`, `content`, `tips`, `videoUrl`, `createdAt`, `updatedAt`).
- **Data Footprint**: Approximately 10–50 curated study notes covering Civil Service exam topics.
- **Access Patterns**: Fetched by `src/app/reviewer/page.tsx` and `src/app/learning/page.tsx`.
- **Write Paths**:
  - `POST /api/reviewer`: Admin creates study note.
  - `PUT /api/reviewer`: Admin updates note fields.
  - `DELETE /api/reviewer?id=...`: Admin deletes note.
  - Backup restore: `src/lib/backup/backupRestore.ts`.
- **Safety Assessment**: Completely public, non-personalized, non-financial, non-entitlement-gated.
- **Slice 4B Viability**: **QUALIFIED CANDIDATE #1**.

---

## 22. Reading Material Findings

- **Dual-Model Architecture**:
  1. `model Handbook`: Used by `/api/reading-materials` (metadata) and `/api/reading-materials/file` (binary stream). Contains `title`, `category`, `description`, `pages`, `fileName`, `fileData`.
  2. `model ReadingMaterial`: Used exclusively in `/api/admin/reading` (internal admin prototype). Contains `title`, `category`, `content`, `isPremium`. Not surfaced to students.
- **Student Consumption**: `src/app/reading-materials/page.tsx` displays the handbook catalog list and embeds an iframe to `/api/reading-materials/file?id=${selectedDoc.id}`.
- **Safety Assessment**:
  - Catalog Metadata (`GET /api/reading-materials`): Completely safe, non-personalized, non-financial. **QUALIFIED CANDIDATE #2**.
  - Binary File Stream (`GET /api/reading-materials/file`): Unsafe for long-lived caching without URL version hashing. Defer to Slice 4C.

---

## 23. Elimination Drill Findings

- **Model**: `Question` where `category = 'Elimination Drill'` or `subtopic contains 'Elimination Drill'`.
- **Endpoints**:
  1. `/api/drills`: Returns all elimination drill questions in a single JSON payload. Tagged with `STATIC_METADATA`. **Zero frontend callers** (dead endpoint).
  2. `/api/drills/elimination`: Accepts `seenIds`, computes candidate pool, randomizes (`Math.random()`), and slices 10 items. Set to `force-dynamic`, `revalidate = 0`. Actively called by `src/app/drills/page.tsx` and `src/app/drills/elimination/page.tsx`.
- **Safety Assessment**: Whole-response caching on `/api/drills/elimination` is impossible due to the user-specific `seenIds` parameter and randomization.
- **Recommendation**: **DO NOT CACHE IN 4B**. In Slice 4C, consider pre-fetching the full shared pool of elimination questions into a shared cached helper and executing `seenIds` exclusion on the client.

---

## 24. Flashcard Findings

- **Model**: `Flashcard` (`id`, `category`, `topic`, `front`, `back`, `question`, `answer`, `options`, `difficulty`, `explanation`, `deletedAt`).
- **Endpoints**:
  - `GET /api/flashcards`: Requires user session. Automatically seeds default flashcards if table is empty. **Fails to filter `deletedAt: null`**.
  - `GET /api/admin/flashcards`: Filters `deletedAt: null`. Admin CRUD.
  - `POST /api/admin/flashcards/bulk`: Bulk insert. Does NOT call `revalidatePath`.
- **Safety Assessment**: Auto-seeding mutation inside a GET handler, lack of soft-delete filtering in the user endpoint, and missing invalidation in bulk uploads make flashcards ineligible for initial Slice 4B.
- **Recommendation**: **DEFER TO 4C**.

---

## 25. Question-Bank Metadata Findings

- **Architecture**: Categories and subtopics are currently embedded within individual `Question` records rather than stored in a normalized category table.
- **Access Patterns**: Exam generation and practice builders inspect category distributions dynamically via `prisma.question.findMany()`.
- **Redundant Reads**: Multiple endpoints independently query `prisma.question.findMany({ select: { category: true, subtopic: true } })`.
- **Recommendation**: In a future slice, create a lightweight `/api/questions/categories` endpoint backed by a shared cache tag (`question-bank-metadata`) to eliminate repetitive full-table scans.

---

## 26. CSC / External Content Findings

- **Model**: `CSCExamSchedule`, `CSCAnnouncement`, `CSCDownload`, `SyncStatus`.
- **Endpoint**: `GET /api/csc/public-info`. Emits `STATIC_METADATA`.
- **Write Paths**:
  - Background crawler: `POST /api/csc/sync` (`src/lib/cscSyncEngine.ts`).
  - Admin seed: `POST /api/csc/seed`.
  - **GET Side Effect**: `src/app/api/csc/public-info/route.ts` line 46 performs a database write (`prisma.cSCExamSchedule.upsert`) during a GET request if no future schedule exists.
- **Safety Assessment**: Performing a database mutation during a GET handler violates HTTP semantics and cache safety.
- **Recommendation**: **DEFER TO 4C**. Refactor the auto-fallback logic into database seeding before applying server-side caching.

---

## 27. Pricing Findings

- **DISPLAY PRICING SOURCE**: `GET /api/pricing` (queries `prisma.pricingPlan.findMany()`). Emits `no-store`.
- **AUTHORITATIVE TRANSACTION PRICE SOURCE**: `src/app/api/paymongo/checkout/route.ts` (directly queries `prisma.pricingPlan.findUnique({ where: { planType } })`).
- **SAME OR DIFFERENT**: **DIFFERENT EXECUTION PATHS**. Checkout does NOT call `/api/pricing`.
- **ADMIN MUTATION PATH**: `PUT /api/admin/pricing` (executes `prisma.$transaction` updating plan prices).
- **CHECKOUT DEPENDENCY**: Checkout relies on live database prices.
- **REFERRAL DEPENDENCY**: Referral commission percentages depend on live plan prices.
- **ENTITLEMENT DEPENDENCY**: Entitlement duration (`durationDays`) is read from `PricingPlan`.
- **CACHE SAFE FOR DISPLAY**: Potentially, but introduces risk of price mismatch between display and checkout.
- **CACHE SAFE FOR TRANSACTION**: **STRICT NO. ZERO STALE TOLERANCE.**
- **Recommendation**: **DEFER FROM INITIAL SLICE 4B**.

---

## 28. Premium / Entitlement Findings

- **Educational Content Gating**: Reviewer notes and handbooks are currently open access. Reading materials model has `isPremium`, but the model is not exposed on user routes.
- **Architectural Requirement**: If premium educational content is introduced in the future, authorization must remain live:
  ```text
  Client Request
        ↓
  LIVE Auth & Entitlement Check (ServerAuth)
        ↓ (Authorized)
  Shared Cached Content Helper (Next.js Cache Tag)
        ↓
  Deliver Response
  ```
- **Safety Principle**: Never cache the combined (Auth Check + Educational Content) HTTP response at the CDN edge.

---

## 29. Invalidation Dependency Map

The following dependency chains define cache lifecycles for qualified candidates:

```text
[READ PATH]                     [CACHE UNIT]          [MUTATION SOURCES]                      [INVALIDATION EVENT]
GET /api/reviewer        →   StudyNote Catalog    ←  Admin POST/PUT/DELETE /api/reviewer  →  revalidateTag("reviewer-content")
GET /api/reading-materials→   Handbook Metadata    ←  Admin POST/PUT/DELETE /api/reading   →  revalidateTag("reading-materials")
```

---

## 30. Mutation / Invalidation Matrix

| Candidate | Create Mutation | Update Mutation | Delete Mutation | Restore Mutation | Import / Sync | Other Mutation | Proposed Invalidation Point(s) | Coverage Confidence |
|---|---|---|---|---|---|---|---|---|
| **Reviewer Study Notes** | `POST /api/reviewer` | `PUT /api/reviewer` | `DELETE /api/reviewer` | `backupRestore.ts` | None | None | Admin route handlers (`POST`, `PUT`, `DELETE` in `/api/reviewer`) | **HIGH** |
| **Reading Materials Metadata**| `POST /api/reading-materials`| `PUT /api/reading-materials`| `DELETE /api/reading-materials`| `backupRestore.ts` | None | None | Admin route handlers (`POST`, `PUT`, `DELETE` in `/api/reading-materials`)| **HIGH** |
| **Feature Flags** | None (upsert) | `POST /api/admin/feature-flags` | `backupRestore.ts` | None | None | None | `POST /api/admin/feature-flags` | **HIGH** |
| **Flashcards Deck** | `POST /api/admin/flashcards` | `PUT /api/admin/flashcards` | `DELETE /api/admin/flashcards` | `POST /api/admin/trash` | `POST /api/admin/flashcards/bulk` | Auto-seed in `/api/flashcards` | Inconsistent coverage across bulk and auto-seed | **LOW / MEDIUM** |
| **CSC Public Info** | `POST /api/csc/seed` | `POST /api/csc/sync` | None | None | Cheerio scraping | Fallback upsert in GET | Scraping engine + seed handler | **MEDIUM** |
| **Pricing Plans** | None (fixed rows) | `PUT /api/admin/pricing` | None | `backupRestore.ts` | None | None | `PUT /api/admin/pricing` | **HIGH (Display only)** |

---

## 31. Cache Key Proposals

For all candidate resources in Slice 4B, cache keys must be completely anonymous:
- **Reviewer Catalog Key**: `["reviewer", "notes-catalog", "v1"]`
- **Reading Materials Metadata Key**: `["reading-materials", "catalog-metadata", "v1"]`

*Security Constraint*: Shared cache keys must never include user IDs, session cookies, bearer tokens, or tenant identifiers.

---

## 32. TTL Proposals

| Candidate | Proposed S-Maxage | Proposed Stale-While-Revalidate | Rationale |
|---|---|---|---|
| **Reviewer Study Notes** | 3,600s (1 hour) | 86,400s (24 hours) | Content changes infrequently; explicit tag invalidation purges immediately on admin edits. |
| **Reading Materials Metadata** | 3,600s (1 hour) | 86,400s (24 hours) | Catalog metadata is stable; explicit tag invalidation purges on new handbook uploads. |
| **Feature Flags** | 300s (5 minutes) | 900s (15 minutes) | Low latency requirement for flag rollouts. |
| **Maintenance Status** | 30s | 60s | Emergency maintenance changes must propagate rapidly. |

---

## 33. Invalidation Tag Proposals

The following standard Next.js cache tags are proposed for Slice 4B:
- `reviewer-content`: Attached to cached study notes. Invalidated when `StudyNote` records are created, updated, or deleted.
- `reading-materials`: Attached to cached handbook metadata. Invalidated when `Handbook` records are created, updated, or deleted.

*Anti-Pattern Warning*: Avoid broad tags such as `all`, `global`, or `everything`. Keep tags tightly scoped to individual domain models.

---

## 34. Existing Long-Lived / Immutable Cache Risks

- **Route**: `src/app/api/reading-materials/file/route.ts` line 37.
- **Header**: `"Cache-Control": "public, max-age=31536000, immutable"`.
- **Vulnerability**:
  - The URL requested by the client iframe is `/api/reading-materials/file?id=${selectedDoc.id}`.
  - When an admin updates a handbook in `PUT /api/reading-materials`, line 80 updates `fileData` for the same handbook ID.
  - The URL does not change.
  - Because the response header specifies `immutable` and a 1-year max age, downstream browsers and intermediate CDN edge nodes will **never** check the origin server for the updated document.
  - Examinees will continue viewing superseded legal or civil service reference handbooks.
- **Recommended Remediation (Slice 4C)**:
  Append a content hash or updatedAt timestamp to the file URL:
  `/api/reading-materials/file?id=${doc.id}&v=${doc.updatedAt.getTime()}`.

---

## 35. Cross-User Leak Risk Analysis

- **Identified Risk in `src/components/profile/BadgeDisplay.tsx`**:
  `fetchWithClientCache("/api/user/badges", 5 * 60 * 1000)` stores user achievements in `sessionStorage` under `cse_cache_/api/user/badges`.
- **Attack / Failure Scenario**:
  1. Student A logs in on a shared library computer.
  2. Student A visits their profile page. Badges are fetched and stored in `sessionStorage`.
  3. Student A logs out. `clearCachedData` is not called.
  4. Student B logs in on the same browser tab.
  5. Student B visits their profile page within 5 minutes.
  6. `getCachedData` returns Student A's badge record from `sessionStorage`.
  7. Student B sees Student A's achievements and counts.
- **Remediation**:
  User-private routes must be excluded from generic client caching, or `clientCache.ts` must namespace storage keys with the authenticated user ID and clear storage upon logout.

---

## 36. Mutation Coverage Gaps

1. **Flashcards Bulk Upload**: `src/app/api/admin/flashcards/bulk/route.ts` imports questions in bulk but does not invoke cache revalidation.
2. **Flashcards Soft-Delete Inconsistency**: Admin trash soft-delete marks `deletedAt: new Date()`, but `src/app/api/flashcards/route.ts` does not include `where: { deletedAt: null }`.
3. **Reading Materials PDF Replacement**: Admin handbook update replaces binary data in the database without busting the immutable CDN cache.
4. **CSC Crawler Sync**: Cheerio scraping updates database tables asynchronously without triggering Next.js cache tag purges.

---

## 37. Structural Performance Benefit Estimates

*Note: STRUCTURAL ESTIMATES ONLY — NOT PRODUCTION TELEMETRY.*

### Candidate 1: Reviewer Study Notes (`/api/reviewer`)
- **Queries Per Request**: 1 Prisma query (`prisma.studyNote.findMany()`).
- **Traffic Profile**: Fetched on every load of `/reviewer` and `/learning`.
- **Estimated Database Read Reduction**: 100 visits/hour = 100 queries/hour eliminated. Under cache hit rates of >98%, database reads for study notes approach zero.

### Candidate 2: Reading Materials Catalog (`/api/reading-materials`)
- **Queries Per Request**: 1 Prisma query (`prisma.handbook.findMany()`).
- **Traffic Profile**: Fetched on every load of `/reading-materials` and `/learning`.
- **Estimated Database Read Reduction**: 100 visits/hour = 100 queries/hour eliminated.

---

## 38. Measurement Requirements

Before and after Slice 4B implementation, the following verifications must be executed:
1. **Prisma Query Counting**: Verify via Prisma query logging that consecutive requests to `/api/reviewer` and `/api/reading-materials` execute zero SQL queries on cache hits.
2. **Cache Invalidation Verification**:
   - Issue `GET /api/reviewer` (verify cached payload).
   - Execute administrative `PUT /api/reviewer` updating a study note.
   - Issue `GET /api/reviewer` immediately and confirm fresh payload is delivered.
3. **Cross-User Isolation Testing**: Confirm responses contain byte-identical data across distinct unauthenticated and authenticated sessions with zero session leakage.
4. **Header Verification**: Inspect response headers for correct `Cache-Control` directives.

---

## 39. Proposed Slice 4B

Slice 4B will implement server-side caching strictly for the two approved candidates:

```text
================================================================================
CANDIDATE 1: Reviewer Study Notes Catalog
================================================================================
RESOURCE: Reviewer Study Notes
WHY SAFE: Pure public educational text; zero user personalization; identical across users.
WHY USEFUL: Eliminates redundant database reads on primary study pages.
DATA CLASS: PUBLIC_SLOW_CHANGING
CACHE UNIT: Entire notes catalog array
PROPOSED CACHE LAYER: Next.js unstable_cache (or server-side cached helper)
CACHE KEY: ["reviewer", "notes-catalog"]
TTL: 3600 seconds
INVALIDATION TAG: reviewer-content
ALL KNOWN MUTATION ROUTES: POST /api/reviewer, PUT /api/reviewer, DELETE /api/reviewer
AUTHORIZATION BEHAVIOR: Public read; admin-only mutations.
ENTITLEMENT BEHAVIOR: None (open educational material).
CROSS-USER SAFETY: YES — byte-for-byte identical.
EXPECTED STALE WINDOW: < 50ms upon tag invalidation.
STALE-DATA CONSEQUENCE: Slight delay in viewing updated study guide notes.
MUTATION COVERAGE CONFIDENCE: HIGH.
ROLLBACK PLAN: Revert cache wrapper to direct Prisma query.
TESTS REQUIRED: Query count assertion, admin edit invalidation test, isolation test.
FILES LIKELY TO CHANGE:
- src/app/api/reviewer/route.ts
- src/lib/reviewer/reviewerService.ts (or dedicated cached helper)

================================================================================
CANDIDATE 2: Reading Materials / Handbooks Metadata Catalog
================================================================================
RESOURCE: Handbooks Metadata Catalog
WHY SAFE: Catalog metadata only; zero user identity; binary files excluded.
WHY USEFUL: Eliminates redundant database queries across library and learning pages.
DATA CLASS: PUBLIC_SLOW_CHANGING
CACHE UNIT: Entire handbooks metadata array (id, title, category, description, pages, fileName)
PROPOSED CACHE LAYER: Next.js unstable_cache (or server-side cached helper)
CACHE KEY: ["reading-materials", "catalog-metadata"]
TTL: 3600 seconds
INVALIDATION TAG: reading-materials
ALL KNOWN MUTATION ROUTES: POST /api/reading-materials, PUT /api/reading-materials, DELETE /api/reading-materials
AUTHORIZATION BEHAVIOR: Public read; admin-only mutations.
ENTITLEMENT BEHAVIOR: None.
CROSS-USER SAFETY: YES — byte-for-byte identical.
EXPECTED STALE WINDOW: < 50ms upon tag invalidation.
STALE-DATA CONSEQUENCE: Slight delay in viewing new handbook listings.
MUTATION COVERAGE CONFIDENCE: HIGH.
ROLLBACK PLAN: Revert cache wrapper to direct Prisma query.
TESTS REQUIRED: Query count assertion, admin create/update/delete invalidation test.
FILES LIKELY TO CHANGE:
- src/app/api/reading-materials/route.ts
- src/lib/reading/readingService.ts (or dedicated cached helper)
```

---

## 40. Proposed Slice 4C If Needed

Resources requiring architectural refactoring before caching should be addressed in Slice 4C:
1. **Daily Question Split Helper**:
   Extract shared daily question prompt into a cached helper with tag `daily-question`, while evaluating user attempt state live.
2. **Handbook File Versioning**:
   Add content-based hash query parameters (`?v=${hash}`) to `/api/reading-materials/file` to resolve the 1-year immutable cache lock-in.
3. **Flashcards Cleansing & Tagging**:
   Fix soft-delete filtering in `GET /api/flashcards`, remove GET auto-seeding, and add revalidation tags across admin single and bulk routes.
4. **Client Cache User Namespacing**:
   Remediate `clientCache.ts` by adding user session scoping to `sessionStorage` keys and binding `clearCachedData` to logout events.
5. **CSC Sync Refactor**:
   Eliminate the fallback upsert in `GET /api/csc/public-info` and integrate tag invalidation into `cscSyncEngine.ts`.

---

## 41. Files Likely to Change in Future Implementation

For Slice 4B implementation:
- `src/app/api/reviewer/route.ts` (Read caching + mutation tag revalidation)
- `src/app/api/reading-materials/route.ts` (Read caching + mutation tag revalidation)
- `src/lib/cache/cacheService.ts` (New narrow cache helper / tag definitions)

Zero payment, zero auth, zero exam, and zero schema files will be touched.

---

## 42. Collision Analysis With Readiness / Security / Payments

| Candidate / Resource | Readiness Collision | Security Collision | Financial Collision | Assessment |
|---|---|---|---|---|
| Reviewer Study Notes | **NONE** | **NONE** | **NONE** | 100% isolated educational text. |
| Handbooks Metadata | **NONE** | **NONE** | **NONE** | 100% isolated legal/study PDFs. |
| Feature Flags (4C) | **LOW** | **LOW** | **NONE** | Public flags only; admin role check preserved. |
| Pricing Plans (4C) | **HIGH** | **LOW** | **CRITICAL** | Interacts with checkout amount and referral rewards. |
| PayMongo Routes | **CRITICAL** | **CRITICAL** | **CRITICAL** | STRICT NO CACHE. |
| Auth / Session Routes| **CRITICAL** | **CRITICAL** | **NONE** | STRICT NO CACHE. |

---

## 43. Background Worker Technical Debt Note

- **Endpoint**: `src/app/api/cron/background-worker/route.ts`.
- **Functionality**: Performs operational cleanup (purging expired drafts, pruning old logs, checking sync states).
- **Technical Debt**: Has historically been triggered via browser polling in the Admin Health dashboard.
- **Slice 4A Decision**: This endpoint is an operational background worker. It must never be cached, rescheduled, or refactored in performance slices. It is preserved strictly as operational technical debt.

---

## 44. Remaining Risks

1. **Edge CDN Stale Windows Without Purge API**: Next.js `revalidateTag` purges the Next.js Data Cache. If third-party CDN caching (e.g., Cloudflare / Vercel Edge Cache) is layered in front, edge purges require CDN cache tagging or short `s-maxage` headers.
2. **Browser Tab Memory Drift**: Even with server invalidation, clients retaining in-memory React state will only reflect updates upon navigation or refetch.
3. **Accidental Scope Creep**: Attempting to cache dynamic quiz or exam paths would immediately introduce cheating risks and state inconsistencies. Strict adherence to Slice 4B boundaries is mandatory.

---

## 45. Final Recommendation

1. **Approve Discovery Findings**:
   Confirm data-scope classifications, no-cache zones, and existing client-cache risk findings.
2. **Authorize Exact Slice 4B Scope**:
   Restrict Slice 4B implementation strictly to:
   - Candidate 1: Reviewer Study Notes (`/api/reviewer`)
   - Candidate 2: Reading Materials Metadata (`/api/reading-materials`)
3. **Maintain Strict Invalidation Gate**:
   Every cached read must be paired with automated revalidation across all associated admin write paths.
4. **Preserve All Security & Financial Boundaries**:
   Zero changes to payments, checkout, recovery, auth, sessions, exams, or operational health.
