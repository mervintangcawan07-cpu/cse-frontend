/**
 * binaryCache.ts
 *
 * Slice 4C — Binary Cache Correctness helpers for mutable binary assets.
 *
 * Problem: /api/reading-materials/file served Handbook bytes with
 *   Cache-Control: public, max-age=31536000, immutable
 * even though an administrator can replace the file on the same Handbook id.
 *
 * Solution: weak ETag derived from Handbook.updatedAt (milliseconds).
 * Browser retains the file copy and revalidates via If-None-Match → 304
 * instead of re-downloading the full payload every time.
 *
 * Out of scope for Slice 4C:
 *   - Range requests
 *   - Auth / authorization changes (existing auth is preserved as-is)
 *   - Schema changes (no new columns, no migrations)
 *   - CDN caching (CDN is told no-store; conditional revalidation is
 *     browser-to-origin only)
 */

// ---------------------------------------------------------------------------
// ETag builder
// ---------------------------------------------------------------------------

/**
 * Build a weak ETag for a Handbook binary asset.
 *
 * Format: W/"handbook-<id>-<updatedAtMs>"
 *
 * Using a weak ETag (W/ prefix) because we compare by logical equivalence
 * (same file version) rather than byte-for-byte identity.  The Prisma
 * @updatedAt field advances whenever any field on the Handbook row changes,
 * including file-only replacements, so it is a sufficient validator.
 *
 * @param id        - Handbook.id (cuid string)
 * @param updatedAt - Handbook.updatedAt (Date, set by @updatedAt on every write)
 * @returns         - Weak ETag header value, e.g. W/"handbook-abc123-1717000000000"
 */
export function buildHandbookBinaryEtag(id: string, updatedAt: Date): string {
  return `W/"handbook-${id}-${updatedAt.getTime()}"`;
}

// ---------------------------------------------------------------------------
// ETag matcher  (If-None-Match → 304 logic)
// ---------------------------------------------------------------------------

/**
 * Determine whether the client's If-None-Match header matches a given ETag.
 *
 * Handles:
 *   - null / missing header  → no match
 *   - exact string match
 *   - comma-separated multi-value list (RFC 7232 §3.2)
 *   - wildcard "*"           → always matches
 *
 * Comparison is case-sensitive per RFC 7232.
 *
 * @param ifNoneMatchHeader - Value of the If-None-Match request header, or null
 * @param etag              - The ETag we computed for the current resource version
 * @returns true if the client already holds the current version (→ 304)
 */
export function matchesEtag(
  ifNoneMatchHeader: string | null,
  etag: string
): boolean {
  if (!ifNoneMatchHeader) return false;

  const trimmed = ifNoneMatchHeader.trim();

  // Wildcard matches everything
  if (trimmed === "*") return true;

  // Split comma-separated list and compare each token
  const tokens = trimmed.split(",").map((t) => t.trim());
  return tokens.some((token) => token === etag);
}

// ---------------------------------------------------------------------------
// Response header policies
// ---------------------------------------------------------------------------

/**
 * Cache-Control policy for mutable binary assets (Handbook files).
 *
 * private          – no CDN/shared-cache storage; each user's browser caches
 *                    its own copy keyed by user session implicitly (the route
 *                    requires authentication upstream).
 * no-cache         – browser MUST revalidate before using any stored copy.
 *                    This is NOT the same as no-store: the browser is allowed
 *                    to retain the file bytes and serve a 304 shortcut.
 * max-age=0        – reinforces that the stored copy is immediately stale.
 * must-revalidate  – cache MUST NOT serve stale copy when origin is
 *                    unreachable (strict revalidation).
 *
 * CDN-Cache-Control / Vercel-CDN-Cache-Control: no-store
 *   Prevent Vercel Edge Network and any upstream CDN from ever caching binary
 *   file responses. Conditional revalidation is browser-to-origin only.
 */
export const BINARY_BROWSER_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

/**
 * Cache-Control policy for error responses (400 / 404 / 500).
 *
 * Errors must never be cached in any tier.
 */
export const BINARY_ERROR_CACHE_HEADERS = {
  "Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;
