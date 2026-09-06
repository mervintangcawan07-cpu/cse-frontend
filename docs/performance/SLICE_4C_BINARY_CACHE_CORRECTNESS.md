# Slice 4C — Binary Cache Correctness

**Branch:** `performance/cache-architecture`
**Prerequisite:** Slice 4B-2 (`b23e8059de21ab11f8850c6560faa2ef8f85cd12`)

---

## 1. Defect Description

### Route Affected

`GET /api/reading-materials/file?id=<handbookId>`

### Pre-Slice-4C Behavior (DEFECTIVE)

The route served Handbook binary file bytes using:

```
Cache-Control: public, max-age=31536000, immutable
```

This is a one-year browser-and-CDN cache with an `immutable` directive, meaning browsers never revalidate.

### Why This Was Wrong

The `Handbook` model uses a stable `id` (cuid). An administrator can:

1. Upload a new PDF to an existing Handbook via `PUT /api/reading-materials`
2. The `fileData` column is replaced on the same `id`
3. The `updatedAt` timestamp advances (`@updatedAt`)
4. **But a browser that previously downloaded the file at that URL would never re-fetch it** — it would serve stale bytes until the browser cache expired (up to one year)

This is an **immutable-policy on a mutable resource** — a cache correctness defect.

---

## 2. Fix Architecture

### ETag Validator

`Handbook.updatedAt` (milliseconds since epoch) is used as the ETag discriminator.

- `updatedAt` is a Prisma `@updatedAt` field — it advances on every `update()` to the Handbook row, including file-only replacements
- **No schema change is required** — `updatedAt` already exists
- **No versioned URL** — the stable `?id=<id>` URL is preserved

### Weak ETag Format

```
W/"handbook-<id>-<updatedAtMs>"
```

Example: `W/"handbook-clxyz123-1717000000000"`

A **weak ETag** (`W/` prefix) indicates logical equivalence (same file version), not byte-for-byte identity. This is appropriate because we compare based on the version timestamp, not a content hash.

### Browser Cache Policy

```
Cache-Control: private, no-cache, max-age=0, must-revalidate
CDN-Cache-Control: no-store
Vercel-CDN-Cache-Control: no-store
```

**Why `private, no-cache` (not `no-store`)**:
- `no-cache` tells the browser it MUST revalidate before using a stored copy
- `no-store` would prevent the browser from retaining the file bytes at all
- With `no-cache`, the browser keeps the bytes and can short-circuit the download with a 304 (sending only the ETag header, not the full PDF body)
- CDNs are told `no-store` because conditional revalidation is browser-to-origin only

### Request Flow

```
First load:
  Browser → GET /api/reading-materials/file?id=abc
  No If-None-Match header
  → Full DB query (fileData + fileName + updatedAt)
  → 200 + ETag: W/"handbook-abc-<ms>" + file bytes
  → Browser stores bytes + ETag

Admin replaces file:
  PUT /api/reading-materials → fileData updated → updatedAt advances

Subsequent browser load (same tab, or refresh):
  Browser → GET /api/reading-materials/file?id=abc
             If-None-Match: W/"handbook-abc-<old-ms>"
  → Metadata-only DB query: select { updatedAt }   ← NO fileData blob read
  → Build ETag from new updatedAt
  → ETags differ → fall through to full query
  → 200 + new ETag + new file bytes

File unchanged, subsequent browser load:
  Browser → GET /api/reading-materials/file?id=abc
             If-None-Match: W/"handbook-abc-<ms>"
  → Metadata-only DB query: select { updatedAt }
  → ETags match
  → 304 Not Modified (no body)
  → Browser reuses cached bytes
```

### Two-Query Optimization

When `If-None-Match` is present:

1. **Metadata-only query first**: `select: { updatedAt: true }` — reads only 8 bytes from the DB instead of the full `fileData` blob (which can be megabytes)
2. If ETag matches → return 304 immediately (no blob ever read)
3. If ETag differs → fall through to **full query** (`select: { fileData, fileName, updatedAt }`)

A second ETag check is performed after the full query as a correctness guard in the rare case `updatedAt` changes between the two queries.

---

## 3. Files Changed

### New Files

| File | Purpose |
|------|---------|
| `src/lib/cache/binaryCache.ts` | ETag builder, `If-None-Match` matcher, browser/error header policy constants |
| `src/scripts/test-performance-slice-4c.ts` | 41-assertion static verification suite |
| `docs/performance/SLICE_4C_BINARY_CACHE_CORRECTNESS.md` | This document |

### Modified Files

| File | Change |
|------|--------|
| `src/app/api/reading-materials/file/route.ts` | Replaced one-year immutable policy with conditional GET (ETag / If-None-Match / 304) |

### Explicitly NOT Modified

| File | Reason |
|------|--------|
| `prisma/schema.prisma` | `Handbook.updatedAt @updatedAt` already present — no schema change needed |
| `src/app/reading-materials/page.tsx` | Iframe URL `?id=<id>` unchanged |
| `src/app/api/reading-materials/route.ts` | Slice 4B-2 revalidation logic preserved |
| `src/lib/cache/tags.ts` | Slice 4B-2 cache tags unchanged |
| `src/lib/cache/serverCache.ts` | Slice 4B-2 server cache unchanged |
| `src/lib/cache.ts` | Slice 4B-2 DATA_CACHE_ONLY profile unchanged |
| `next.config.ts` | No configuration changes |

---

## 4. `binaryCache.ts` API Reference

### `buildHandbookBinaryEtag(id, updatedAt): string`

```typescript
buildHandbookBinaryEtag("clxyz123", new Date(1717000000000))
// → 'W/"handbook-clxyz123-1717000000000"'
```

### `matchesEtag(ifNoneMatchHeader, etag): boolean`

| Input | Result |
|-------|--------|
| `null` | `false` |
| `W/"handbook-abc-1000"` (exact match) | `true` |
| `W/"handbook-abc-999", W/"handbook-abc-1000"` (list) | `true` |
| `*` (wildcard) | `true` |
| `W/"handbook-abc-999"` (mismatch) | `false` |

### `BINARY_BROWSER_CACHE_HEADERS`

```typescript
{
  "Cache-Control": "private, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
}
```

### `BINARY_ERROR_CACHE_HEADERS`

```typescript
{
  "Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
}
```

---

## 5. Out of Scope

| Item | Reason |
|------|--------|
| Range requests | Not needed for PDF viewer use case; no browser request observed |
| Versioned URLs (`?v=<hash>`) | User explicitly excluded |
| Schema columns (`fileVersion`, `fileHash`) | User explicitly excluded |
| Content-addressed storage | User explicitly excluded |
| Auth / authorization changes | Existing auth preserved as-is |
| CDN conditional caching | CDN is told `no-store`; only browser revalidates |

---

## 6. DB Impact

- **Production DB writes: 0**
- No schema migration
- New query pattern: metadata-only `select: { updatedAt: true }` on cache HIT path (avoids blob read)
- Full query pattern unchanged on cache MISS path

---

## 7. Security Impact

- Authorization preserved unchanged
- No new public exposure — `Cache-Control: private` prevents the binary response from being treated as a shared-cacheable representation, while `CDN-Cache-Control` and `Vercel-CDN-Cache-Control` explicitly use `no-store`.
- No secrets exposed

---

## 8. Validation

### Slice 4C Test Suite

```
test-performance-slice-4c.ts — 41 assertions PASS
```

- Section 1: binaryCache.ts helpers (15 tests)
- Section 2: file/route.ts defect fix (17 tests)
- Section 3: Prisma schema unchanged (3 tests)
- Section 4: Scope boundary (6 tests)

### Regression

- `test-performance-slice-4b2.ts` — pre-existing ESM module resolution failure (env issue, not Slice 4C)
- `test-performance-slice-2a.ts` — pre-existing ESM module resolution failure
- `test-performance-slice-3a.ts` — pre-existing ESM module resolution failure
- `npm run build` — VERIFIED ✅

---

## 9. Performance Improvement

| Request type | Before | After |
|-------------|--------|-------|
| First load | Full DB query + blob bytes → 200 | Same |
| File unchanged (revalidation) | Full DB query + blob bytes → 200 | Metadata-only query → 304 (no body) |
| File replaced (revalidation) | Full DB query + blob bytes → 200 (stale!) | Full query → 200 (fresh bytes) |

On cache-hit revalidation: **eliminates full blob DB read + eliminates HTTP body transfer** (can be several MB per PDF).
