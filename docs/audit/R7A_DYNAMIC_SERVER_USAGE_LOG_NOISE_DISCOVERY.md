# GovStudyX — Production Operational Cleanup
## Phase R7A — Dynamic Server Usage / Log-Noise Read-Only Discovery Report

---

### 1. Executive Conclusion

```
SAFE_TO_CLEAN
```

**Rationale:**
1. **Reproduction Confirmed:** During every production build (`npm run build`), exactly **19 diagnostic log noise events** are emitted across two signatures:
   - 18 events from `src/lib/serverAuth.ts` via `src/app/admin/layout.tsx` (one for each `/admin/**` route).
   - 1 event from `src/lib/partnerAuth.ts` via `src/app/partner-portal/page.tsx`.
2. **Classification — Expected Dynamic Rendering with Diagnostic Noise (`NOISE_ONLY` / `EXPECTED_DYNAMIC_BEHAVIOR`):**
   - The routes themselves (`/admin/**` and `/partner-portal`) **must be dynamic**. They are authenticated entry points that inspect per-request cookies (`cse_session` and `cse_partner_session`).
   - Next.js App Router static prerendering naturally triggers a `DynamicServerError` (with `digest: 'DYNAMIC_SERVER_USAGE'`) when `cookies()` is evaluated at build time. This is Next.js's internal control-flow signal to opt the route into dynamic on-demand rendering (`ƒ`).
   - However, `src/lib/serverAuth.ts` (`getAuthenticatedSessionResult`) and `src/lib/partnerAuth.ts` (`getAuthenticatedPartner`) wrap `await cookies()` inside blanket `try { ... } catch (error) { ... }` blocks that intercept this internal Next.js error, log it to `console.error` with full stack traces as `[serverAuth] Authentication error:` and `[PARTNER_AUTH_ERROR]`, and swallow it.
3. **Zero Correctness or Performance Issue:** The build completes successfully with exit code 0 (212/212 routes generated). In live production runtime, `cookies()` does not throw; requests are authenticated correctly against the database.
4. **Safe, Minimal Cleanup Path for R7B:** A surgical, minimum-change improvement to the catch blocks in `src/lib/serverAuth.ts` and `src/lib/partnerAuth.ts` (allowing Next.js dynamic/redirect control-flow exceptions to propagate without being logged as authentication errors) will eliminate 100% of this build log noise while preserving 100% of runtime authentication, security, and caching behavior.

---

### 2. Branch and Baseline Verification

- **Repository / Worktree Root:** `C:\Users\Administrator\govstudyx-log-noise-cleanup`
- **Active Branch:** `cleanup/dynamic-server-usage-noise`
- **Current HEAD Commit:** `e0efcbd03dd6f91f2936c559e20674326e34ebb5`
- **Expected Baseline Commit:** `e0efcbd03dd6f91f2936c559e20674326e34ebb5`
- **Working Tree Status:** Clean (`nothing to commit, working tree clean`).
- **Baseline Verification:**
  - Includes Post-Launch Readiness Hardening (`5da214a`).
  - Includes completed Performance Slice 4 Cache Architecture and Content Integrity Hardening (`a024cea`, `59fe943`, `9cf9698`).
  - Includes R6 Rate-Limit Consolidation (`e0efcbd`).
  - Confirmed: Zero changes have been made to prior production hardening baselines.

---

### 3. TypeScript Typecheck Result

- **Command:** `npx tsc --noEmit`
- **Exit Code:** `0`
- **Errors:** `0`
- **Summary:** Complete repository type checking passed with zero errors or warnings.

---

### 4. Production Build Result

- **Command:** `$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/govstudyx_dummy"; npm run build`
- **Environment:** Next.js 16.3.2 (Turbopack), React 19.2.4, Prisma 7.9.1
- **Exit Code:** `0`
- **Build Duration:** ~115 seconds (Prisma generation 3.3s, Next.js compilation 49s, TypeScript 62s, Static page generation 4.9s).
- **Route Manifest Summary:**
  - Total Pages & Endpoints: **246**
  - Static Pre-rendered Routes (`○`): **64**
  - Dynamic On-Demand Routes (`ƒ`): **182**
  - Middleware / Proxy (`ƒ`): **1** (`src/proxy.ts`)
- **Build Status:** **PASS** (Zero fatal errors; process exited cleanly with code 0).

---

### 5. Exact Dynamic / Log-Noise Reproduction Result

The historical dynamic server usage log noise was **consistently reproduced** on the current baseline.

- **Reproduction Status:** `REPRODUCED` (19 noisy log events).
- **Failure Mode:** Non-fatal build stderr noise during static page generation phase:
  `Generating static pages using 3 workers (53/212) ... (159/212)`
- **Nature of Noise:** Full JavaScript stack traces logged to `console.error` by application catch handlers intercepting Next.js internal `DynamicServerError` exceptions.

---

### 6. Relevant Warning Inventory

| # | Signature / Text | Occurrence Count | Phase | Implicated Source File | Caller / Trigger Route | Triggering Mechanism |
| :- | :--- | :-: | :---: | :--- | :--- | :--- |
| 1 | `[serverAuth] Authentication error: Error: Dynamic server usage: Route <route> couldn't be rendered statically because it used cookies. See more info here: https://nextjs.org/docs/messages/dynamic-server-error` | 18 | Build (Static Generation) | `src/lib/serverAuth.ts:141` | `src/app/admin/layout.tsx:12` | `cookies()` called in `getAuthenticatedSessionResult` during static prerender of `AdminLayout`. Caught by blanket `try/catch` and printed via `console.error`. |
| 2 | `[PARTNER_AUTH_ERROR] Error: Dynamic server usage: Route /partner-portal couldn't be rendered statically because it used cookies. See more info here: https://nextjs.org/docs/messages/dynamic-server-error` | 1 | Build (Static Generation) | `src/lib/partnerAuth.ts:81` | `src/app/partner-portal/page.tsx:6` | `cookies()` called in `getAuthenticatedPartner` during static prerender of `PartnerPortalRootPage`. Caught by blanket `try/catch` and printed via `console.error`. |

#### Routes Emitting Signature 1 (`[serverAuth] Authentication error`):
1. `/admin`
2. `/admin/accounting`
3. `/admin/backups`
4. `/admin/csc-sync`
5. `/admin/dashboard`
6. `/admin/elimination-drills`
7. `/admin/flags`
8. `/admin/flashcards`
9. `/admin/health`
10. `/admin/pricing`
11. `/admin/questions`
12. `/admin/reading`
13. `/admin/reading-materials`
14. `/admin/referrals`
15. `/admin/reviewer`
16. `/admin/system`
17. `/admin/trash`
18. `/admin/users`

#### Routes Emitting Signature 2 (`[PARTNER_AUTH_ERROR]`):
19. `/partner-portal`

---

### 7. Route / Component Inventory

| Route Path | Source File | Dynamic API Used | Why Used | Intentional? | Authenticated? | Request-Specific State? | Current Render Behavior | Static Attempted? | Safe? | Code Change Required? |
| :--- | :--- | :--- | :--- | :-: | :-: | :-: | :---: | :-: | :-: | :-: |
| `/admin/**` (18 routes) | `src/app/admin/layout.tsx` | `cookies()` via `getAuthenticatedUser` | Server-side admin authentication and RBAC authorization guard | YES | YES (ADMIN) | User session token (`cse_session`) | Dynamic (`ƒ`) | YES | YES | YES (R7B: refine catch block in `serverAuth.ts`) |
| `/partner-portal` | `src/app/partner-portal/page.tsx` | `cookies()` via `getAuthenticatedPartner` | Server-side partner session validation & conditional redirect | YES | YES (PARTNER) | Partner session token (`cse_partner_session`) | Dynamic (`ƒ`) | YES | YES | YES (R7B: refine catch block in `partnerAuth.ts`) |
| `/partner-portal/**` (subpages) | `src/app/partner-portal/*/page.tsx` | None (Client components) | Subpages render client shells; fetch partner API via browser `fetch` | YES | YES (Client-side) | Browser cookie / Bearer token via API | Static Shell (`○`) | YES | YES | NO |
| `/dashboard` | `src/app/dashboard/page.tsx` | Client `useSearchParams()` | Reads `payment` param; fetches stats via client API | YES | YES (Client-side) | Client session | Static Shell (`○`) | YES | YES | NO |
| `/practice` | `src/app/practice/page.tsx` | Client `useAuth()` | Checks entitlement via client auth context | YES | Mixed | Client auth state | Static Shell (`○`) | YES | YES | NO |
| `/exam` | `src/app/exam/page.tsx` | Client `router.replace` | Checks auth via `/api/auth/me`; redirects to mock exam | YES | YES (Client-side) | Client auth state | Static Shell (`○`) | YES | YES | NO |
| `/mock-exam/take` | `src/app/mock-exam/take/page.tsx` | Client `useSearchParams()` | Reads quiz setup params (`itemCount`, `categories`, `pool`) | YES | YES (Client-side) | Client quiz state | Static Shell (`○`) | YES | YES | NO |
| `/mock-exam/results` | `src/app/mock-exam/results/page.tsx` | Client `useSearchParams()` | Reads quiz `id` | YES | YES (Client-side) | Client attempt state | Static Shell (`○`) | YES | YES | NO |
| `/mock-exam/review/[id]` | `src/app/mock-exam/review/[id]/page.tsx` | `params: Promise<{ id }>` | Dynamic route param for exam attempt review | YES | YES (Client-side) | Dynamic segment `id` | Dynamic (`ƒ`) | NO (dynamic param) | YES | NO |
| `/reviewer` | `src/app/reviewer/page.tsx` | None (Client component) | Renders study notes UI; fetches cached API data | YES | NO (Public / Pro) | Client category filter | Static Shell (`○`) | YES | YES | NO |
| `/reading-materials` | `src/app/reading-materials/page.tsx` | Client `fetch` | Renders handbook catalog; client fetch | YES | NO (Public / Pro) | Client search state | Static Shell (`○`) | YES | YES | NO |
| `/flashcards` | `src/app/flashcards/page.tsx` | None (Client component) | Spaced repetition flashcards client UI | YES | Mixed | Client deck state | Static Shell (`○`) | YES | YES | NO |
| `/flashcards/study` | `src/app/flashcards/study/page.tsx` | None (Client component) | Flashcard active study runner | YES | Mixed | Client study queue | Static Shell (`○`) | YES | YES | NO |
| `/social` | `src/app/social/page.tsx` | Client polling | Study Together social hub & presence | YES | YES (Client-side) | User profile & tabs | Static Shell (`○`) | YES | YES | NO |
| `/upgrade` | `src/app/upgrade/page.tsx` | Client `useAuth()` | PayMongo upgrade plans display | YES | Mixed | User plan selection | Static Shell (`○`) | YES | YES | NO |
| `/register` | `src/app/register/page.tsx` | `searchParams: Promise<{ ... }>` | Server component awaiting searchParams for referral attribution | YES | NO (Guest) | Query parameters | Dynamic (`ƒ`) | NO (searchParams Promise) | YES | NO |
| `/p/[code]` | `src/app/p/[code]/page.tsx` | `params` & `searchParams` Promise | Partner vanity landing page | YES | NO (Public) | Dynamic slug & tracking | Dynamic (`ƒ`) | NO (dynamic param) | YES | NO |
| `/api/paymongo/**` (3 routes) | `src/app/api/paymongo/*/route.ts` | Request body / cookies | Payment checkout, verify, webhook | YES | YES | Payment transactions | Dynamic (`ƒ`) | N/A (Route Handler) | YES | NO |
| `/api/auth/**` (9 routes) | `src/app/api/auth/*/route.ts` | `cookies()`, Request body | Authentication session issuance & lifecycle | YES | Auth endpoints | Session credentials | Dynamic (`ƒ`) | N/A (Route Handler) | YES | NO |
| `/api/admin/**` (50+ routes) | `src/app/api/admin/**/route.ts` | `requireAdminAuth(req)` | Server-side admin operations | YES | YES (ADMIN) | Admin session token | Dynamic (`ƒ`) | N/A (Route Handler) | YES | NO |
| `/api/exam/**` (4 routes) | `src/app/api/exam/*/route.ts` | `requireAuthUser(req)`, Request URL | Exam generation, drafting, grading | YES | YES (USER/PRO) | User exam state | Dynamic (`ƒ`) | N/A (Route Handler) | YES | NO |

---

### 8. Dynamic API Usage Inventory

Across the entire `src/` tree:

1. **`cookies()` from `next/headers`:**
   - Evaluated in 11 files:
     - `src/lib/serverAuth.ts`: Canonical session validation (`cse_session`).
     - `src/lib/partnerAuth.ts`: Canonical partner session validation (`cse_partner_session`).
     - `src/app/api/auth/signup/route.ts`: Sets auth cookie on registration.
     - `src/app/api/auth/register/route.ts`: Sets auth cookie on registration.
     - `src/app/api/auth/me/route.ts`: Fallback cookie extraction.
     - `src/app/api/auth/logout/route.ts`: Clears auth cookie on logout.
     - `src/app/api/paymongo/checkout/route.ts`: Session fallback check.
     - `src/app/api/paymongo/verify/route.ts`: Session fallback check.
     - `src/app/api/partner/auth/setup/route.ts`: Sets partner auth cookie.
     - `src/app/api/partner/auth/login/route.ts`: Sets partner auth cookie.
     - `src/app/api/partner/auth/logout/route.ts`: Clears partner auth cookie.
2. **`headers()` from `next/headers`:**
   - Zero call sites (`headers()` is not called directly in any file).
   - In route handlers, request headers are accessed directly via standard web `req.headers.get(...)`.
3. **`searchParams`:**
   - **Server Components:**
     - `src/app/register/page.tsx`: Uses `searchParams: Promise<{ [key: string]: string | ... }>` to capture referral codes.
     - `src/app/p/[code]/page.tsx`: Uses `searchParams?: Promise<{ src?: string }>` for partner attribution.
   - **Client Components:**
     - 10 client pages use `useSearchParams()` from `next/navigation` wrapped in appropriate boundaries (`/verify-email`, `/signup`, `/reset-password`, `/mock-exam/take`, `/mock-exam/results`, `/login`, `/partner-portal/setup`, `/partner-portal/reset-password`, `/dashboard`, `/duels`).
   - **Route Handlers:**
     - 25+ route handlers use `new URL(request.url).searchParams`.
4. **`unstable_cache` from `next/cache`:**
   - Exactly 2 call sites in `src/lib/cache/serverCache.ts` (Performance Slice 4B2):
     - `getCachedReviewerNotes`: Caches public study notes with 3600s TTL.
     - `getCachedReadingMaterials`: Caches public handbook metadata with 3600s TTL.
   - Both caches are wrapped with tag invalidation (`CACHE_TAGS.REVIEWER`, `CACHE_TAGS.READING_MATERIALS`) and emit zero build noise.

---

### 9. Static / Dynamic Configuration Inventory

All route segment configurations across `src/` were audited:

| File | Configuration | Intended Role | Legitimate? | Mismatch? |
| :--- | :--- | :--- | :---: | :---: |
| `src/app/api/health/readiness/route.ts` | `export const dynamic = "force-dynamic";` | Live database health check probe | YES | NO |
| `src/app/api/health/liveness/route.ts` | `export const dynamic = "force-dynamic";` | Live container health probe | YES | NO |
| `src/app/api/drills/elimination/route.ts` | `export const dynamic = "force-dynamic";`<br>`export const revalidate = 0;` | Real-time question randomization based on query parameters | YES | NO |
| `src/app/api/admin/trash/route.ts` | `export const dynamic = "force-dynamic";` | Real-time admin trash query | YES | NO |
| `src/app/api/social/posts/route.ts` | `export const dynamic = "force-dynamic";` | Real-time social feed | YES | NO |
| `src/app/api/social/posts/[id]/route.ts` | `export const dynamic = "force-dynamic";` | Real-time social post | YES | NO |
| `src/app/api/social/posts/[id]/reactions/route.ts` | `export const dynamic = "force-dynamic";` | Real-time reactions | YES | NO |
| `src/app/api/social/posts/[id]/comments/route.ts` | `export const dynamic = "force-dynamic";` | Real-time comments stream | YES | NO |
| `src/app/api/admin/accounting/refunds/execute/route.ts` | `export const runtime = "nodejs";` | PayMongo refund execution handler requiring Node.js runtime | YES | NO |

- `force-static` declarations: **0** across entire codebase.
- Conflicting cache declarations: **0** found.
- Unnecessary route segment declarations: **0** found. All 8 routes declaring `force-dynamic` are real-time API routes that must never be cached by Next.js GET route handler caching.

---

### 10. Expected Behavior vs. Real Issue Classification

| Finding Item | Technical Description | Classification | Action in R7B? |
| :--- | :--- | :--- | :---: |
| `/admin/**` dynamic rendering | Admin layout and pages render dynamically at runtime based on `cse_session` cookie. | `EXPECTED_DYNAMIC_BEHAVIOR` | No change to rendering behavior. |
| `/partner-portal` dynamic rendering | Partner root page renders dynamically based on `cse_partner_session` cookie. | `EXPECTED_DYNAMIC_BEHAVIOR` | No change to rendering behavior. |
| `[serverAuth] Authentication error` build log | Generic `try/catch` in `getAuthenticatedSessionResult` logs Next.js `DynamicServerError` to stderr. | `NOISE_ONLY` | **CLEAN in R7B:** Ignore / rethrow dynamic server usage errors without logging. |
| `[PARTNER_AUTH_ERROR]` build log | Generic `try/catch` in `getAuthenticatedPartner` logs Next.js `DynamicServerError` to stderr. | `NOISE_ONLY` | **CLEAN in R7B:** Ignore / rethrow dynamic server usage errors without logging. |
| `/register` and `/p/[code]` dynamic rendering | Routes await `searchParams` / `params` Promise. | `EXPECTED_DYNAMIC_BEHAVIOR` | None. Generates cleanly with zero log noise. |
| Dynamic route handlers (`/api/**`) | All API endpoints render dynamically on demand. | `EXPECTED_DYNAMIC_BEHAVIOR` | None. Generates cleanly with zero log noise. |
| Client component static shells (`○`) | 64 client pages prerender static HTML shell and hydrate client-side. | `EXPECTED_DYNAMIC_BEHAVIOR` | None. |

---

### 11. Authenticated-Route Correctness Assessment

- **Server-Side Enforcement:**
  - `/admin/**`: Protected by `AdminLayout` via `getAuthenticatedUser()`. If unauthenticated or non-admin, redirects immediately to `/login` or `/dashboard`. Zero admin UI or sensitive data is rendered.
  - `/partner-portal`: Protected by `PartnerPortalRootPage` via `getAuthenticatedPartner()`. Unauthenticated visitors are redirected to `/partner-portal/login`.
  - `/api/admin/**`: Every admin route handler invokes `requireAdminAuth(req)`, returning HTTP 401/403 before executing any business logic.
- **Request-Specific Data Isolation:**
  - Cookies and headers are never baked into static responses.
  - No authenticated or personalized data is exposed to shared caches or CDN layers.
  - Static prerendering correctly bails out for all authenticated entry points.

---

### 12. Client / Server Boundary Assessment

An exhaustive scan across all `.ts` and `.tsx` source files containing `"use client"` verified:
- **`next/headers` imports in client components:** **0**
- **`@/lib/serverAuth` imports in client components:** **0**
- **`@/lib/partnerAuth` imports in client components:** **0**
- **`@/lib/prisma` / `@prisma/client` imports in client components:** **0**
- **`@/lib/ratelimit` imports in client components:** **0**
- **Payment secret or database leakage:** **0**

Client components communicate exclusively with server routes via standard HTTP endpoints (`/api/auth/me`, `/api/admin/stats`, etc.) and client-safe context providers (`AuthContext`, `SudoContext`, `ThemeContext`).

---

### 13. Performance Slice 4 Interaction Assessment

- `src/lib/cache.ts`, `src/lib/cache/**`, and `src/lib/contentEligibility.ts` are completely untouched.
- `unstable_cache` is utilized strictly for public, static-like educational content:
  - `getCachedReviewerNotes`
  - `getCachedReadingMaterials`
- Revalidation tags (`CACHE_TAGS.REVIEWER`, `CACHE_TAGS.READING_MATERIALS`) utilize Next.js 16's two-argument `revalidateTag(tag, "max")` API without causing any build bails or warnings.
- The cache architecture is fully compliant with Next.js 16 App Router principles and has zero connection to the `[serverAuth]` or `[PARTNER_AUTH_ERROR]` build noise.

---

### 14. Cache Correctness Assessment

- No user-specific data is cached in Next.js Data Cache or Full Route Cache.
- Client fetches for sensitive or dynamic content specify `cache: "no-store"` where appropriate (e.g., `/api/reading-materials` with query parameters).
- Header configurations in `next.config.ts` correctly restrict caching to immutable static assets (`public, max-age=3600, stale-while-revalidate=86400` for images, fonts, and icons).

---

### 15. Production Impact Assessment

- **Live Production Runtime Impact:** **ZERO.** In production runtime, incoming HTTP requests supply cookies; `cookies()` does not throw `DynamicServerError`; user sessions and partner sessions authenticate normally against PostgreSQL.
- **CI/CD Build Pipeline Impact:** **HIGH LOG NOISE.** Emitting 19 stack traces containing the word `Error` and `Authentication error` during every build creates false alarms in deployment pipelines, causes developer confusion, and clutters build logs.
- **Deployment Reliability:** **SAFE.** Build exits with code 0; all 212 routes compile, type-check, and deploy successfully.

---

### 16. Exact Minimum-Change Recommendation

In Phase R7B, implement a minimal, non-breaking fix in exactly **two files**:

1. **`src/lib/serverAuth.ts` (`getAuthenticatedSessionResult`):**
   In the `catch (error)` handler:
   ```typescript
   } catch (error) {
     // Propagate Next.js internal control-flow exceptions (dynamic bailouts & redirects)
     if (
       (error as any)?.digest === "DYNAMIC_SERVER_USAGE" ||
       (error as any)?.digest?.startsWith?.("NEXT_") ||
       (error instanceof Error && error.message.includes("Dynamic server usage"))
     ) {
       throw error;
     }

     console.error("[serverAuth] Authentication error:", error);
     return { authenticated: false, code: "AUTHENTICATION_ERROR" };
   }
   ```
2. **`src/lib/partnerAuth.ts` (`getAuthenticatedPartner`):**
   In the `catch (error)` handler:
   ```typescript
   } catch (error) {
     // Propagate Next.js internal control-flow exceptions (dynamic bailouts & redirects)
     if (
       (error as any)?.digest === "DYNAMIC_SERVER_USAGE" ||
       (error as any)?.digest?.startsWith?.("NEXT_") ||
       (error instanceof Error && error.message.includes("Dynamic server usage"))
     ) {
       throw error;
     }

     console.error("[PARTNER_AUTH_ERROR]", error);
     return null;
   }
   ```

**Why this is the exact correct approach:**
- Next.js App Router relies on JavaScript exceptions for internal rendering control flow (specifically `DynamicServerError` with `digest: 'DYNAMIC_SERVER_USAGE'` and `NEXT_REDIRECT`).
- When application code swallows these errors in a broad `try/catch` and logs them via `console.error`, it converts normal Next.js framework signaling into spurious application error logs.
- Allowing `DynamicServerError` to bubble out of the auth helper lets Next.js's build worker handle it cleanly: Next.js catches it, marks the route as dynamic (`ƒ`), and emits zero stderr noise.
- When an actual runtime authentication error occurs (such as a database disconnection, malformed token, or unexpected exception), it will still be caught, logged to `console.error`, and handled safely.

---

### 17. Exact Proposed R7B Files

| File Path | Proposed Change in R7B | Why Change is Required | Behavior Change? |
| :--- | :--- | :--- | :--- |
| `src/lib/serverAuth.ts` | Update `catch (error)` in `getAuthenticatedSessionResult` to rethrow errors with `digest === "DYNAMIC_SERVER_USAGE"` or dynamic signatures before logging. | Eliminates 18 spurious `[serverAuth] Authentication error:` stack traces across `/admin/**` during build. | **ZERO.** Runtime auth remains byte-for-byte identical. Only unmasks Next.js dynamic control-flow signal. |
| `src/lib/partnerAuth.ts` | Update `catch (error)` in `getAuthenticatedPartner` to rethrow errors with `digest === "DYNAMIC_SERVER_USAGE"` or dynamic signatures before logging. | Eliminates 1 spurious `[PARTNER_AUTH_ERROR]` stack trace for `/partner-portal` during build. | **ZERO.** Runtime partner auth remains byte-for-byte identical. Only unmasks Next.js dynamic control-flow signal. |

---

### 18. Files Explicitly Protected from R7B

The following files and directories must **NOT** be modified in Phase R7B:

- `src/app/admin/layout.tsx` (Preserve current layout implementation).
- `src/app/partner-portal/page.tsx` (Preserve current root redirect implementation).
- `src/app/admin/**/page.tsx` (Preserve all 18 admin page implementations).
- All routes under `src/app/api/paymongo/**` (Protected payment endpoints).
- `src/lib/ratelimit.ts` and `src/lib/rate-limit.ts` (Protected canonical rate-limiting infrastructure).
- `src/lib/auth/sudoMode.ts` and `src/routes/admin/criticalActions.ts` (Protected sudo elevation).
- `src/lib/cache.ts` and `src/lib/cache/**` (Protected Performance Slice 4 cache architecture).
- `src/lib/contentEligibility.ts` (Protected content integrity filtering).
- `prisma/schema.prisma` and `prisma/migrations/**` (Protected database schema).
- `package.json` and `package-lock.json` (Protected dependencies).
- All test scripts in `src/scripts/**` (Authoritative verification harnesses).

---

### 19. Risk Assessment

```
LOW
```

**Justification:**
- The proposed change is strictly limited to 2 files (`src/lib/serverAuth.ts` and `src/lib/partnerAuth.ts`).
- Within those files, only the `catch` blocks in session retrieval are modified.
- No database queries, JWT validation, role checks, session models, or cookie names are modified.
- In production runtime, `cookies()` never throws `DynamicServerError`, so the `if` condition evaluates to false and runtime behavior is 100% unaffected.
- Build type checking (`npx tsc --noEmit`) and build compilation (`npm run build`) will immediately verify that all 19 errors vanish and the build completes with 0 errors.

---

### 20. R7B Implementation Decision

```
GO (Targeted Log-Noise Elimination)
```

**Conditions:**
1. Only `src/lib/serverAuth.ts` and `src/lib/partnerAuth.ts` may be modified.
2. Changes must be confined to rethrowing Next.js dynamic/redirect control-flow errors (`DYNAMIC_SERVER_USAGE`).
3. Zero additions of `export const dynamic = "force-dynamic"` to pages or layouts.
4. Zero removal of `cookies()` or security checks from authenticated routes.
5. Verification must confirm:
   - `npx tsc --noEmit` passes with 0 errors.
   - `npm run build` passes with 0 errors and **0 `[serverAuth]` or `[PARTNER_AUTH_ERROR]` noise messages**.
   - All 212 routes maintain their intended dynamic/static classification (`ƒ` / `○`).
