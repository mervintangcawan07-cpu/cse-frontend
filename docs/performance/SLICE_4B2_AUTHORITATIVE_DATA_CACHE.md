# Slice 4B-2 — Authoritative Data Cache

## Scope and baseline

Slice 4B-2 implements the cache architecture selected by Slice 4B-1 for two public, slowly changing educational catalogs:

- Reviewer study notes (`GET /api/reviewer`)
- Reading Materials metadata (`GET /api/reading-materials`)

Implementation baseline: `42764b49db7bcc393d45c10e29260aaf00ea7c79` on `performance/cache-architecture`.

## Cache ownership

```text
PostgreSQL / Prisma
        ↓
Next.js Data Cache — authoritative server cache
        ↓
Route Handler JSON response — HTTP/CDN no-store
        ↓
Direct browser fetch — no sessionStorage catalog authority
```

The Next.js Data Cache is the only long-lived cache for these two JSON catalogs. The response and browser layers do not maintain independent catalog freshness clocks.

| Catalog | Cache key | Tag | TTL |
|---|---|---|---:|
| Reviewer | `reviewer / notes-catalog / v1` | `reviewer-content` | 3600 seconds |
| Reading Materials metadata | `reading-materials / catalog-metadata / v1` | `reading-materials` | 3600 seconds |

Reading Materials caching is metadata-only. The cached query does not select `fileData`.

## HTTP and CDN policy

Both catalog GET responses use the narrowly scoped `DATA_CACHE_ONLY` response profile:

```text
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
CDN-Cache-Control: no-store
Vercel-CDN-Cache-Control: no-store
```

The existing `STATIC_METADATA` and other public cache profiles remain unchanged for unrelated routes.

## Client policy

The Reviewer, Reading Materials, and Learning Hub pages use direct abortable `fetch()` calls with `cache: "no-store"`. They no longer read or write Reviewer/Reading Materials payloads through `fetchWithClientCache`.

Legacy `cse_cache_/api/reviewer` and `cse_cache_/api/reading-materials` entries may remain physically present in a browser, but sessionStorage is not an authority for these current delivery paths. No broad storage clear or prefix wipe is performed. The shared `src/lib/clientCache.ts` facility remains available to unrelated consumers.

## Mutation invalidation

Every known production catalog mutation invalidates its matching tag after the database mutation succeeds:

| Catalog | POST | PUT | DELETE |
|---|---:|---:|---:|
| Reviewer | `reviewer-content` | `reviewer-content` | `reviewer-content` |
| Reading Materials | `reading-materials` | `reading-materials` | `reading-materials` |

Invalidation uses `revalidateTag(tag, "max")`, the supported Next.js 16 Route Handler form. With the `max` profile, the first request after invalidation may receive stale data while background revalidation runs; a subsequent request receives the refreshed value after that work completes.

If invalidation throws, the helper logs an ERROR-level `[CACHE_INVALIDATION_FAILURE]` event containing the tag and a safe error description. It does not rethrow because the database mutation has already succeeded. The 3600-second TTL bounds stale exposure if on-demand invalidation fails.

## Explicit exclusions and residual risk

- `/api/reading-materials/file` is unchanged. Its mutable-URL/immutable-response risk remains deferred to Slice 4C.
- Cache Components and `"use cache"` are not enabled.
- `next.config.ts`, authentication, payments, accounting, Question Bank, Elimination Drills, Flashcards, Prisma schema, migrations, and dependencies are unchanged.
- No polling, interval, broad invalidation, or database write was introduced outside the existing authorized admin mutations.

## Rollback

Rollback is code-only: restore direct Prisma catalog reads, remove the two server-cache helper files, restore the prior route response profile, and restore the three catalog clients if necessary. No schema or data rollback is required.
