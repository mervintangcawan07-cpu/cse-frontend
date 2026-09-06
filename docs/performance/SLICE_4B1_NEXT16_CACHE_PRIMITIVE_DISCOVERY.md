# GovStudyX - Performance Hardening
# Slice 4B-1: Next.js 16.3.2 Cache Primitive Discovery

**Document Version**: 1.0.0
**Date**: 2026-09-06
**Branch**: performance/cache-architecture
**HEAD**: 38cbe6149b27020cdfe917c1e957ae77e355ff0f
**Scope**: Discovery only. Zero runtime changes. Zero config changes. Zero test files.


---

## 1. Starting Gate Verification

- Worktree: C:\Users\Administrator\govstudyx-performance-4a
- Branch:   performance/cache-architecture
- HEAD:     38cbe6149b27020cdfe917c1e957ae77e355ff0f
- Status:   nothing to commit, working tree clean

Log chain verified:
- 38cbe61  fix: harden study content deletion integrity  (Slice 4.5)
- 92a977d  perf: isolate user badge client cache          (Slice 4B-0)
- 53a6201  docs: add slice 4a cache architecture discovery (Slice 4A)
- 7bce0b0  test(payment): allow postgres harnesses on integration branch

---

## 2. Installed Next.js Version

- next@16.3.2, react@19.2.4, TypeScript ^5, Prisma 7.9.1
- Source: package.json

---

## 3. Cache Components Current State

### 3.1 cacheComponents Enabled?

**NO.** cacheComponents is NOT enabled in next.config.ts.
The current next.config.ts contains only:
- Global HTTP security headers (/:path*)
- Short-lived static asset cache headers for svg|jpg|jpeg|png|webp|ico|woff|woff2|ttf
No cacheComponents: true, no experimental.dynamicIO, no experimental.useCache, no experimental.ppr.

### 3.2 What cacheComponents: true Enables

Per installed documentation (cacheComponents.md):
- 'use cache' directive
- cacheLife function
- cacheTag function
- Partial Prerendering (PPR) as default behavior in the App Router
- <Activity> component-based navigation state preservation
- GET Route Handlers follow the same prerendering model as pages

### 3.3 Blast Radius of Enabling cacheComponents

`cacheComponents` is an application-wide rendering-model opt-in. It enables Cache Components / Partial Prerendering behavior, and GET Route Handlers follow the same prerendering model as pages. Existing route-segment configuration semantics also change or become unsupported. This creates a broad migration/blast radius across GovStudyX and therefore is not appropriate for this small caching slice.

Note: POST, PUT, and DELETE Route Handlers themselves are not PPR-rendered; only GET Route Handlers follow the page prerendering model. However, the overall application-wide migration surface remains substantial:

| Impact Area | Detail |
|---|---|
| GET Route Handler rendering model | GET Route Handlers follow the same prerendering model as pages. Every GET handler in `src/app/api/` must be assessed for compatibility. Auth, exam, payment, and financial GET endpoints require audit. |
| Route-segment config changes | Existing `dynamic`, `fetchCache`, `revalidate` route-segment exports change semantics or become unsupported under Cache Components. All currently configured route segments must be reviewed. |
| Navigation Model | `<Activity>` replaces traditional unmounting during navigation. Component state is preserved on back-navigation. All pages require UI testing. |
| PPR default in App Router | All App Router routes adopt Partial Prerendering as default. Each route must be audited for correct Suspense boundaries and streaming behavior. |
| Edge Runtime Removal | Any deprecated `runtime = 'edge'` exports would need removal (none currently detected). |
| experimental.useCache Migration | Any `experimental.useCache` references require migration per the Version 16 upgrade guide (none currently present). |

**DECISION**: DO NOT enable cacheComponents in Slice 4B-2. The broad migration/blast radius across GovStudyX is not appropriate for this small caching slice.


---

## 4. unstable_cache Status and Signature

### 4.1 Deprecation Status

Per installed documentation (unstable_cache.md):
> Note: This API has been replaced by 'use cache' in Next.js 16.
> We recommend opting into Cache Components and replacing unstable_cache with the use cache directive.

unstable_cache is **deprecated** in Next.js 16 in favor of 'use cache'. It continues to function but is not the recommended path.

### 4.2 Installed Signature

```ts
unstable_cache(
  fetchData: () => Promise<T>,
  keyParts?: string[],
  options?: {
    tags?: string[];
    revalidate?: number | false;
  }
): () => Promise<T>
```

### 4.3 Key Behaviors

- Caches the async function result across requests using the Next.js Data Cache (server-side file-system cache).
- Cache key = stringified function body + keyParts array.
- tags: array of strings for on-demand invalidation via revalidateTag().
- revalidate: seconds before time-based background revalidation. Omit or false = cache indefinitely until revalidateTag() or revalidatePath().
- Cannot access headers(), cookies(), or request-time APIs inside the cached function.
- Works **WITHOUT** enabling cacheComponents: true.

**Can be used without Cache Components? YES.** unstable_cache operates on the legacy Next.js Data Cache model and does not require cacheComponents: true.

---

## 5. 'use cache' Requirements

Per installed documentation (caching.md):
> This page covers caching with Cache Components, enabled by setting cacheComponents: true.
> If you are not using Cache Components, see the Caching and Revalidating (Previous Model) guide.

**'use cache' REQUIRES cacheComponents: true.** Since GovStudyX has cacheComponents disabled, 'use cache' cannot be used.

**DECISION**: 'use cache' is NOT available in GovStudyX until cacheComponents: true is deliberately enabled with full blast-radius assessment.

---

## 6. revalidateTag -- Exact Installed Semantics

Source: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md

### 6.1 Installed Signature

```ts
revalidateTag(tag: string, profile?: string | { expire?: number }): void
```

### 6.2 Behavior by Invocation Form

| Form | Behavior |
|---|---|
| revalidateTag(tag) | **DEPRECATED.** Tag expired immediately. Next request is a blocking cache miss. Docs state 'may be removed in a future version.' |
| revalidateTag(tag, 'max') | **RECOMMENDED.** Tag marked **STALE**. Next request serves stale content while fresh data is fetched in the **background** (stale-while-revalidate). |
| revalidateTag(tag, { expire: 0 }) | Immediate expiration. Next request is a blocking cache miss. Intended for webhooks/external services. |

### 6.3 CORRECTION 1: 'max' Is NOT Immediate Invalidation

'max' uses **stale-while-revalidate semantics**. It does NOT immediately serve fresh data.

Mutation lifecycle with revalidateTag(tag, 'max'):
```text
Step 1: Admin executes PUT /api/reviewer  -->  database write succeeds
Step 2: revalidateTag('reviewer-content', 'max') called
Step 3: Server Data Cache tag marked STALE

FIRST request after mutation:
  --> tag is STALE --> STALE cached response is served (pre-mutation content)
  --> background fresh Prisma query is triggered in parallel

SECOND request after mutation (background refresh has completed):
  --> FRESH cached response is served (post-mutation content)
```
**First request after mutation: Receives STALE pre-mutation data.**
**Second request after mutation: Receives fresh post-mutation data (after background refresh).**

Stale window: best case = a few hundred milliseconds. Worst case = up to full TTL (3600s) if background refresh fails silently.

### 6.4 Freshness Contract Assessment

For admin-only catalog edits:
- Admin does NOT typically navigate to end-user pages immediately after mutation.
- A stale first-read after mutation is generally acceptable for educational catalog metadata.
- The stale window is bounded: second request by any user after background refresh sees fresh data.

**ASSESSMENT**: The 'max' stale-while-revalidate contract is conditionally acceptable for Reviewer Notes and Reading Materials catalog, PROVIDED the maximum stale exposure window is reasonable and the client sessionStorage cache does not extend it further (see Section 11).


---

## 7. updateTag Applicability

Source: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md

### 7.1 Restriction

> updateTag can **only** be called from within Server Actions.
> It cannot be used in Route Handlers, Client Components, or any other context.

The installed docs include an explicit code example showing that calling updateTag inside a Route Handler **throws an error**.

### 7.2 Behavior vs. revalidateTag

| Function | Where Usable | Invalidation Behavior |
|---|---|---|
| updateTag(tag) | Server Actions ONLY | Immediate expiration. Next request is a blocking cache miss. |
| revalidateTag(tag, 'max') | Server Actions AND Route Handlers | Stale-while-revalidate. Next request receives stale; background refresh fetches fresh. |

### 7.3 Architectural Consequence for GovStudyX

GovStudyXs catalog mutations (POST/PUT/DELETE /api/reviewer and /api/reading-materials) are all implemented as **Next.js App Router Route Handlers**, not Server Actions.

Converting these mutation APIs to Server Actions solely to use updateTag is **NOT authorized** in Slice 4B-1 and is not warranted -- it would require architectural changes to the admin panel, auth middleware integration, and client-side mutation logic that are outside the scope of a performance caching slice.

**DECISION**: revalidateTag(tag, 'max') remains the appropriate invalidation primitive for Route Handler mutations. updateTag is noted but unsuitable for this architecture without conversion.

---

## 8. Current Server Cache -- Reviewer Study Notes

Endpoint: GET /api/reviewer
File: src/app/api/reviewer/route.ts

Current implementation:
```ts
export async function GET() {
  const notes = await prisma.studyNote.findMany({ orderBy: { createdAt: 'desc' } });
  return cachedJsonResponse({ notes }, 'STATIC_METADATA');
}
```

| Layer | Current State |
|---|---|
| Next.js Data Cache | **ABSENT.** No unstable_cache, no 'use cache', no fetch with cache options. Live Prisma query on every request. |
| Cache-Control Header | Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400 |
| CDN-Cache-Control | CDN-Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400 |
| Vercel-CDN-Cache-Control | Vercel-CDN-Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400 |

---

## 9. Current Server Cache -- Reading Materials Catalog

Endpoint: GET /api/reading-materials
File: src/app/api/reading-materials/route.ts

Current implementation:
```ts
export async function GET() {
  const handbooks = await prisma.handbook.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id, title, category, description, pages, fileName, createdAt },
  });
  return cachedJsonResponse({ handbooks }, 'STATIC_METADATA');
}
```

| Layer | Current State |
|---|---|
| Next.js Data Cache | **ABSENT.** Live Prisma query on every request. |
| Cache-Control Header | Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400 |
| CDN-Cache-Control | CDN-Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400 |
| Vercel-CDN-Cache-Control | Vercel-CDN-Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400 |


---

## 10. CORRECTION 2: HTTP/CDN Headers and Data Cache Interaction

### 10.1 Exact Current Headers from CACHE_PROFILES.STATIC_METADATA in src/lib/cache.ts

```text
Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400
CDN-Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400
Vercel-CDN-Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400
```

These headers instruct CDN/edge nodes to cache the response for up to 3,600 seconds (1 hour) and serve stale for up to 86,400 seconds (24 hours) during background CDN revalidation.

### 10.2 Does revalidateTag() Invalidate HTTP/CDN Cached Responses?

**NO.** revalidateTag() does NOT invalidate HTTP/CDN cached responses.

Per installed documentation (cdn-caching.md):
> CDN-level caching alone does not support on-demand revalidation (revalidateTag() / revalidatePath()):
> those calls **invalidate the Next.js server cache**, but the CDN will continue serving its
> cached copy until the s-maxage TTL expires. To propagate on-demand revalidation to the CDN,
> **trigger CDN purges alongside your revalidation call.**

The complete invalidation chain:
```text
revalidateTag('reviewer-content', 'max')
  --> Invalidates: Next.js server-side Data Cache entry ONLY
  --> Does NOT invalidate: Vercel Edge / Cloudflare / CDN cached HTTP responses
  --> Does NOT invalidate: browser HTTP cache (Cache-Control: public, s-maxage=3600)
  --> Does NOT invalidate: browser sessionStorage cache
```

### 10.3 Stacking Risk

If unstable_cache (Next.js Data Cache) is added underneath the existing STATIC_METADATA HTTP headers:
1. revalidateTag() purges the Next.js server Data Cache entry (CORRECT)
2. Route Handler re-executes the Prisma query on the next request (CORRECT)
3. Returns a fresh response (CORRECT)
4. **BUT**: An intermediate CDN (Vercel Edge, Cloudflare) that has cached the previous HTTP response
   would continue serving the stale payload for up to 3,600 seconds to end-users passing through
   that CDN edge node. (PROBLEM -- Model C outcome)

This is the **Model C stacked cache problem**: Data Cache invalidation does not propagate to HTTP CDN caches without a CDN purge API call.

---

## 11. CORRECTION 3: Browser/SessionStorage Cache -- Full Audit

### 11.1 fetchWithClientCache Implementation Summary

File: src/lib/clientCache.ts (UNCHANGED after Slice 4.5)
- Cache key: `cse_cache_${url}` (URL-only, no user identity)
- Storage: sessionStorage
- Default TTL: 30 * 60 * 1000 = **30 minutes**
- Pattern: If cached data exists AND navigator.onLine: return cached data immediately + fire background fetch() to update sessionStorage. If no cache: blocking fetch() + store in sessionStorage.

### 11.2 Current Consumers for /api/reviewer and /api/reading-materials (All Unchanged After Slice 4.5)

| File | URL | Explicit TTL |
|---|---|---|
| src/app/reviewer/page.tsx L39 | /api/reviewer | None (defaults to 30 minutes) |
| src/app/reading-materials/page.tsx L29 | /api/reading-materials | None (defaults to 30 minutes) |
| src/app/learning/page.tsx L16 | /api/reviewer | None (defaults to 30 minutes) |
| src/app/learning/page.tsx L17 | /api/reading-materials | None (defaults to 30 minutes) |

### 11.3 Critical Questions Answered

**Q1: Can server tag invalidation invalidate browser sessionStorage?**
**NO.** revalidateTag() operates entirely on the server-side Next.js Data Cache. It cannot remove, expire, or invalidate any cse_cache_/api/reviewer entry in any user's sessionStorage.

**Q2: Does the background refresh in fetchWithClientCache update already-rendered React state?**
**NO.** The background refresh calls setCachedData (updates sessionStorage only). It does NOT call any React state setter. The already-mounted component continues showing the cached (stale) data. Only the NEXT mount benefits from the updated sessionStorage.

**Q3: Can a user continue seeing cached content after an Admin mutation?**
**YES.** A user who loaded /reviewer or /reading-materials within the last 30 minutes will continue seeing pre-mutation content. sessionStorage contains a valid non-expired entry. The already-mounted React component's state is NOT updated.

**Q4: What is the actual maximum client-visible stale duration?**

Current `STATIC_METADATA` is confirmed as:
`s-maxage=3600, stale-while-revalidate=86400`

The upper bound of staleness is determined across the shared HTTP cache and browser cache layers:
* **shared-cache fresh lifetime**: up to 1 hour (`s-maxage=3600`);
* **subsequent SWR window**: up to 24 hours (`stale-while-revalidate=86400`);
* an old CDN object can therefore potentially be served nearly 25 hours after creation under worst-case/no-intervening-refresh timing;
* if a stale CDN response is then placed into the existing 30-minute sessionStorage cache near the end of that period, theoretical end-user staleness can extend approximately another 30 minutes (up to ~25.5 hours total).

| User Scenario | Max Stale Window | Dominant Mechanism |
|---|---|---|
| Warm sessionStorage (< 30 min), no navigation | **30 minutes** | sessionStorage TTL prevents network refetch |
| Cold request — CDN fresh window (within s-maxage=3600) | **Up to 1 hour** from CDN entry creation | CDN s-maxage=3600 |
| Cold request — CDN stale-while-revalidate window | **Up to 25 hours** from CDN entry creation (1h + 24h) | CDN s-maxage + stale-while-revalidate |
| CDN stale response placed into sessionStorage near end of SWR window | **Up to ~25.5 hours** from CDN entry creation | CDN SWR + sessionStorage 30 min |
| Cold request after all CDN caches expire | **Near-zero** | Route Handler executes live Prisma result |

**Theoretical worst-case maximum**: approximately **25 hours and 30 minutes** from the time a response is first cached by the CDN — composed of 1 hour (`s-maxage`) + 24 hours (`stale-while-revalidate`) + 30 minutes (sessionStorage TTL if a stale CDN response is placed into sessionStorage near the end of that period).

**This is a theoretical worst-case bound, not expected steady-state behavior.** In practice, CDN background revalidations typically complete promptly within the SWR window, and users actively navigating will trigger background refreshes. However, the theoretical bound accurately captures the maximum exposure under current `STATIC_METADATA` headers — and this exposure **already exists today**, before any server caching is added.


---

## 12. All StudyNote Mutation Sources -- Complete Audit

Search scope: src/ -- all .ts and .tsx files.

### 12.1 Write Operations

| File | Operation | Classification |
|---|---|---|
| src/app/api/reviewer/route.ts L30 | prisma.studyNote.create(...) | ACTIVE PRODUCTION MUTATION |
| src/app/api/reviewer/route.ts L55 | prisma.studyNote.update(...) | ACTIVE PRODUCTION MUTATION |
| src/app/api/reviewer/route.ts L82 | prisma.studyNote.delete(...) | ACTIVE PRODUCTION MUTATION |
| src/lib/backup/backupRestore.ts | NOT PRESENT (studyNote not in applySnapshotToDatabase) | N/A |

### 12.2 Read Operations (No Writes)

| File | Operation | Classification |
|---|---|---|
| src/app/api/reviewer/route.ts L9 | prisma.studyNote.findMany(...) | READ -- primary catalog endpoint |
| src/lib/backup/backupService.ts L70 | prisma.studyNote.findMany() | READ -- backup snapshot, no writes |
| src/app/api/bookmarks/route.ts L38 | prisma.studyNote.findMany({ where: { id: { in: ... } } }) | READ -- bookmark hydration, no writes |

### 12.3 Backup Restore Analysis

src/lib/backup/backupRestore.ts applySnapshotToDatabase() only writes to:
- pricingPlans: deleteMany() + create() per record
- systemSettings: deleteMany() + create() per record
- featureFlags: deleteMany() + create() per record
- All other table names: syncedTables++ with **NO write operation**

Additionally: P0_003_RESTORE_CONTAINMENT_ACTIVE = true at line 14 means both executeRestore() and restoreFromBackup() return early with P0_003_RESTORE_DISABLED_CODE. **Backup restore is currently hard-disabled at the application level.**

### 12.4 Scripts/Seeds

Searched src/scripts/ -- no studyNote or StudyNote references found. No seed or import scripts for study notes exist in the codebase.

### 12.5 Summary: All Active Production StudyNote Mutation Sources

**EXACTLY THREE active production mutation sources**, all in src/app/api/reviewer/route.ts:
1. POST /api/reviewer --> prisma.studyNote.create()
2. PUT /api/reviewer --> prisma.studyNote.update()
3. DELETE /api/reviewer --> prisma.studyNote.delete()

---

## 13. All Handbook Mutation Sources -- Complete Audit

Search scope: src/ -- all .ts and .tsx files.

### 13.1 Write Operations

| File | Operation | Classification |
|---|---|---|
| src/app/api/reading-materials/route.ts L45 | prisma.handbook.create(...) | ACTIVE PRODUCTION MUTATION |
| src/app/api/reading-materials/route.ts L84 | prisma.handbook.update(...) | ACTIVE PRODUCTION MUTATION |
| src/app/api/reading-materials/route.ts L104 | prisma.handbook.delete(...) | ACTIVE PRODUCTION MUTATION |

### 13.2 Read Operations (No Writes)

| File | Operation | Classification |
|---|---|---|
| src/app/api/reading-materials/route.ts L9 | prisma.handbook.findMany(...) | READ -- catalog endpoint |
| src/lib/backup/backupService.ts L71 | prisma.handbook.findMany() | READ -- backup snapshot, no writes |
| src/app/api/reading-materials/file/route.ts L9 | prisma.handbook.findUnique(...) | READ -- binary file stream, OUT OF SCOPE |

### 13.3 Backup Restore + Scripts

Confirmed: applySnapshotToDatabase() does NOT write to handbook table. Restore pathway hard-disabled. No handbook seeds in src/scripts/.

### 13.4 Summary: All Active Production Handbook Mutation Sources

**EXACTLY THREE active production mutation sources**, all in src/app/api/reading-materials/route.ts:
1. POST /api/reading-materials --> prisma.handbook.create()
2. PUT /api/reading-materials --> prisma.handbook.update()
3. DELETE /api/reading-materials --> prisma.handbook.delete()

---

## 14. Binary File Route -- Out of Scope Confirmation

src/app/api/reading-materials/file/route.ts is confirmed **EXCLUDED** from Slice 4B-1 and 4B-2.
- Emits: Cache-Control: public, max-age=31536000, immutable
- Accepts bare entity ID without content hash (mutable URL with immutable cache header)
- Remediation (URL versioning with ?v=hash) deferred to Slice 4C as established in Slice 4A Section 34.


---

## 15. Cache-Layer Ownership Diagram (Current State)

```text
USER BROWSER
  sessionStorage
    Keys: cse_cache_/api/reviewer, cse_cache_/api/reading-materials
    TTL: 30 minutes
    SWR: background refresh fires on cache hit if navigator.onLine
    Pages: /reviewer, /reading-materials, /learning
    Invalidation: NONE (zero tie to server mutations)

  Browser HTTP Cache
    Honors Cache-Control: public, s-maxage=3600 from CDN response
    Invalidation: NONE

  CDN / Vercel Edge Cache
    s-maxage: 3600 (1 hour)
    stale-while-revalidate: 86400 (24 hours)
    Invalidation: NONE (CDN purge API not called from any mutation path)

NEXT.JS SERVER
  Route Handler: GET /api/reviewer
    Next.js Data Cache: NONE
    Every request: prisma.studyNote.findMany() executed live
    Every response: STATIC_METADATA headers

  Route Handler: GET /api/reading-materials
    Next.js Data Cache: NONE
    Every request: prisma.handbook.findMany() executed live
    Every response: STATIC_METADATA headers

DATABASE (PostgreSQL via Prisma)
  StudyNote table
  Handbook table (metadata columns only; fileData excluded from catalog GET select)
```

---

## 16. First and Second Request After Mutation

### 16.1 Current State (No Server Data Cache)

```text
Admin mutation: PUT /api/reviewer --> database record updated immediately

User REQUEST 1 (sessionStorage valid, < 30 min):
  --> fetchWithClientCache returns sessionStorage data immediately (STALE)
  --> Background fetch fires --> may hit CDN-cached stale response
  --> sessionStorage updated with CDN-stale data
  --> React component state NOT updated (still shows pre-mutation content)

User REQUEST 1 (sessionStorage expired, CDN cache warm):
  --> fetch() executes --> CDN serves cached HTTP response (stale, up to 3600s old)
  --> sessionStorage updated with CDN-stale data
  --> React component renders with CDN-stale data

User REQUEST 1 (sessionStorage expired, CDN cache expired):
  --> fetch() executes --> Route Handler executes prisma.studyNote.findMany() live
  --> Fresh post-mutation data returned
  --> sessionStorage updated with fresh data
  --> React component renders fresh
```

### 16.2 With Server Data Cache Added (Model A)

```text
Admin mutation: PUT /api/reviewer --> database record updated
--> revalidateTag('reviewer-content', 'max') called
--> Next.js Data Cache tag marked STALE

User REQUEST 1 (sessionStorage valid, < 30 min):
  --> fetchWithClientCache returns sessionStorage data immediately (STALE -- unchanged)
  --> Server Data Cache IRRELEVANT; network request not even made

User REQUEST 1 (sessionStorage expired, CDN cache warm):
  --> CDN serves cached HTTP response (STALE -- CDN not invalidated by revalidateTag)

User REQUEST 1 (sessionStorage expired, CDN cache expired):
  --> fetch() --> Route Handler invoked
  --> Next.js Data Cache tag is STALE --> STALE Data Cache entry served
  --> Background Prisma query fires in parallel
  --> Stale content returned to this user

User REQUEST 2 (after background Prisma refresh completes):
  --> Data Cache updated with fresh data
  --> Fresh response delivered
  --> sessionStorage updated with fresh data --> React state fresh on next mount
```

---

## 17. Maximum Realistic User-Visible Stale Window

| Scenario | Max Stale Window | Dominant Layer |
|---|---|---|
| Warm sessionStorage (< 30 min) | **30 minutes** | sessionStorage TTL |
| Cold request — CDN fresh window (s-maxage=3600) | **Up to 1 hour** from CDN entry creation | CDN s-maxage |
| Cold request — CDN stale-while-revalidate window | **Up to 25 hours** from CDN entry creation (1h + 24h) | CDN s-maxage + SWR |
| CDN stale response placed into sessionStorage near end of SWR window | **Up to ~25.5 hours** from CDN entry creation | CDN SWR + sessionStorage |
| Cold request after all caches expire | **Near-zero** | Route Handler live Prisma |

**Theoretical worst-case maximum**: approximately **25 hours and 30 minutes** from CDN entry creation (1h s-maxage + 24h SWR + 30 min sessionStorage at end of SWR window).

**This is a theoretical worst-case bound, not expected steady-state behavior.** This exposure already exists today under current `STATIC_METADATA` headers — before any server caching is added.

**After adding Model A (Data Cache only, HTTP headers unchanged):**
- sessionStorage (30 min): **UNCHANGED**
- CDN HTTP cache (up to 25 hours theoretical maximum): **UNCHANGED** (revalidateTag does not purge CDN)
- Next.js Data Cache: **REDUCED** (fresh after background refresh, typically < 1s)

**CONCLUSION**: Adding unstable_cache alone does NOT reduce the maximum user-visible stale window. The database query elimination is a SERVER PERFORMANCE IMPROVEMENT only, not a DATA FRESHNESS IMPROVEMENT from the user's perspective.


---

## 18. CORRECTION 4: Model A vs. Model B vs. Model C

### Model A -- Next.js Data Cache Authoritative

Architecture: Database --> Next.js Data Cache (unstable_cache) --> HTTP response (STATIC_METADATA headers) --> CDN HTTP cache --> Browser sessionStorage

Pros:
- Eliminates repeated Prisma queries (real server performance benefit)
- Tag invalidation clears server Data Cache on mutation
- Route Handler API contract unchanged
- Requires only 2 new files and 6 route modifications
- Does not require cacheComponents: true

Cons:
- revalidateTag('max') does NOT purge CDN HTTP cache or browser sessionStorage
- End-user visible stale window still dominated by sessionStorage (30 min) and CDN (up to ~25 hours theoretical maximum)
- unstable_cache is deprecated in Next.js 16 (though still functional)
- Must be presented accurately: SERVER INFRASTRUCTURE PERFORMANCE IMPROVEMENT only, not end-to-end data freshness

**Verdict: VIABLE** for database query elimination. NOT effective for reducing end-user stale data exposure on its own.

---

### Model B -- HTTP/CDN Response Cache Authoritative

Architecture: Database --> Route Handler (live Prisma query) --> HTTP response (same as today) --> CDN cache --> Browser sessionStorage

No Next.js Data Cache is added. Instead, improve the existing HTTP cache layer:
- Reduce s-maxage to a shorter window (e.g., 60s), or
- Add CDN purge API calls on mutations (requires CDN API access and configuration), or
- Add Surrogate-Key / Cache-Tag headers for CDN tag-based purging on Vercel/Cloudflare

Pros:
- No new server infrastructure
- No deprecated API
- If CDN purge is implemented, provides TRUE end-to-end freshness on mutation

Cons:
- Requires CDN API access and platform-specific purge implementation
- Does NOT reduce database query load (live Prisma query still executes on every CDN miss)
- Client sessionStorage still independently caches for 30 minutes

**Verdict: Most correct for end-to-end freshness** IF CDN purge API is available. Does not help database query count. Does not address sessionStorage.

---

### Model C -- Stacked Cache (REJECTED)

Architecture: Database --> Next.js Data Cache --> HTTP CDN cache --> browser sessionStorage (no coordinated invalidation)

Problems:
1. revalidateTag() invalidates ONLY the Data Cache. CDN and sessionStorage remain stale.
2. After Data Cache invalidation, CDN has already cached the old response and serves it to users.
3. Even if CDN cache expires, browser sessionStorage continues serving stale data for 30 minutes.
4. Admin doing read-after-write may navigate to /reviewer immediately after saving, but their
   browser sessionStorage serves the old catalog.
5. Three independent caches with three independent staleness clocks, no coordinated invalidation.

**Verdict: REJECT Model C.** No coherent invalidation across all layers. No CDN purge API integration exists in GovStudyX. Model C cannot demonstrate coherent end-to-end invalidation.

---

## 19. Selected Strategy for Slice 4B-2

**DECISION: Strategy A-Transitional with required companion actions.**

### Rationale

Adding `unstable_cache` to the Route Handlers eliminates repeated Prisma queries -- a meaningful server performance improvement (reduces database load on heavily trafficked catalog pages).

However, **shortening the CDN TTL alone does NOT automatically eliminate stacked-cache ownership.** If the CDN still caches responses independently of Data Cache tag invalidation, two independent cache clocks continue to exist.

For the proposed transitional Model A, Slice 4B-2 must specify an exact HTTP/CDN policy that prevents the HTTP response cache from becoming a second long-lived authoritative freshness layer.

The intended architecture should conceptually be:

```text
Database
  ↓
Next.js Data Cache = authoritative server cache
  ↓
Route response with no competing long-lived shared HTTP cache
  ↓
Browser without independent long-lived sessionStorage authority
```

Exact HTTP headers are not chosen in this discovery slice because they must be proven against deployment environment capabilities during Slice 4B-2 planning.

### Required Components for Slice 4B-2

**COMPONENT 1 -- Server Data Cache (Model A Baseline):**
- Add `unstable_cache` wrappers to `GET /api/reviewer` and `GET /api/reading-materials`
- Tags: `'reviewer-content'` and `'reading-materials'`
- TTL: 3600 seconds (1 hour)
- Invalidation: `revalidateTag(tag, 'max')` in POST/PUT/DELETE mutation handlers
- Invalidation failure: log visibly at ERROR level; do NOT swallow silently

**COMPONENT 2 -- HTTP/CDN Policy Specification (Required companion to prevent Model C):**
- Shortening the CDN TTL alone does NOT automatically eliminate stacked-cache ownership.
- Slice 4B-2 must specify an exact HTTP/CDN policy preventing the HTTP response cache from becoming a second long-lived authoritative freshness layer competing with the Data Cache.
- The route response must NOT maintain a competing long-lived shared HTTP cache that outlives or ignores tag invalidation.
- Exact HTTP headers are not finalized in discovery; Slice 4B-2 must evaluate and select an exact header policy (e.g., bypassing shared cache or strictly bounding shared cache lifetime to an unproblematic minimal window) that ensures the Data Cache remains the sole authoritative server cache.

**COMPONENT 3 -- Client Cache Policy Decision (Mandatory requirement for Slice 4B-2):**
- Server tag invalidation **cannot** invalidate browser `sessionStorage`.
- Therefore, Model A is **incomplete** unless Slice 4B-2 explicitly chooses and documents what happens to the existing 30-minute `fetchWithClientCache` behavior for:
  - `/api/reviewer`
  - `/api/reading-materials`
- Slice 4B-2 must decide between:
  1. **Removed for these catalogs**: Replace `fetchWithClientCache` with direct `fetch()` in `src/app/reviewer/page.tsx`, `src/app/reading-materials/page.tsx`, and `src/app/learning/page.tsx` (analogous to the Slice 4B-0 remediation for `BadgeDisplay.tsx`), ensuring the browser always receives the server-authoritative Data Cache response; OR
  2. **Reduced/aligned to a freshness contract**: Significantly shorten or align client cache lifetime so it does not undermine the authoritative Data Cache.
- Whichever option is selected, it must prevent browser `sessionStorage` from acting as an independent, un-invalidatable long-lived authority.

---

## 20. Invalidation Failure Policy (Correction 6)

**NOT APPROVED**: Silent suppression of revalidateTag() errors.

Failure sequence if errors are silently swallowed:
1. Admin executes PUT to update a study note --> Prisma update succeeds (200 OK)
2. revalidateTag('reviewer-content', 'max') throws an error (silently caught)
3. Data Cache entry is NOT invalidated
4. Students continue seeing the old study note content for up to 3,600 seconds

**APPROVED POLICY for Slice 4B-2:**
- Tag invalidation failure MUST be logged at ERROR level with tag name and error details
  Example: console.error('[CACHE_INVALIDATION_FAILURE]', { tag, error: err?.message })
- The HTTP mutation response (POST/PUT/DELETE) still returns the correct success status
  (Mutation succeeded; cache invalidation is a separate concern.)
- Cache invalidation failure is separately observable via server/Vercel function logs
- TTL fallback: if invalidation fails, stale window is bounded by revalidate TTL (3600s max)
- Do NOT design production error handling around test harness convenience

---

## 21. Rollback Plan

If Slice 4B-2 introduces server Data Cache and the result is incorrect behavior:

Step 1: Revert src/app/api/reviewer/route.ts to direct prisma.studyNote.findMany() (remove getCachedReviewerNotes() wrapper)
Step 2: Revert src/app/api/reading-materials/route.ts to direct prisma.handbook.findMany() (remove getCachedReadingMaterials() wrapper)
Step 3: Delete src/lib/cache/tags.ts and src/lib/cache/serverCache.ts
Step 4: Restore HTTP CDN headers to original STATIC_METADATA if changed
Step 5: Restore client sessionStorage TTLs if changed

The rollback is a targeted git revert of the Slice 4B-2 commit(s). No database schema changes, no migration rollback, no Prisma changes.

**PRE_UPDATE_COMMIT**: 38cbe6149b27020cdfe917c1e957ae77e355ff0f

---

## 22. Slice 4.5 Invariant Confirmation

This discovery slice strictly preserved all Slice 4.5 content-integrity guarantees:

| Invariant | Status |
|---|---|
| src/lib/contentEligibility.ts | UNTOUCHED |
| src/app/api/drills/elimination/route.ts | UNTOUCHED |
| src/app/drills/elimination/page.tsx | UNTOUCHED |
| src/app/api/flashcards/route.ts | UNTOUCHED |
| src/app/flashcards/study/page.tsx | UNTOUCHED |
| src/app/api/admin/questions/route.ts | UNTOUCHED |
| src/app/api/reading-materials/file/route.ts | UNTOUCHED -- binary file stream excluded |
| No server caching introduced | CONFIRMED |
| No client caching changes | CONFIRMED |
| No config changes | CONFIRMED |

---

## 23. Final Git State

Expected state after creating this document:
```powershell
git status --short
# Expected: ?? docs/performance/SLICE_4B1_NEXT16_CACHE_PRIMITIVE_DISCOVERY.md

git diff --stat
# Expected: (nothing -- no tracked files modified)

git diff --check
# Expected: (no output)
```
