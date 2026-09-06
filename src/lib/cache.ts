// Relative Path: src/lib/cache.ts
import { NextResponse } from "next/server";

export const CACHE_PROFILES = {
  STATIC_METADATA: {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    "CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    "Vercel-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  },
  PUBLIC_FEED: {
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    "Vercel-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
  },
  PRIVATE: {
    "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
    "CDN-Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
    "Vercel-CDN-Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  },
  /**
   * Slice 4B-2: Next.js Data Cache may cache database results.
   * HTTP/CDN/browser response caches must NOT independently retain the JSON payload.
   */
  DATA_CACHE_ONLY: {
    "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
  },
} as const;

export type CacheProfile = keyof typeof CACHE_PROFILES;

/**
 * Standardized Edge Cached JSON Response Helper for Vercel / Next.js.
 * Merges CDN cache headers with existing ResponseInit options while preserving custom headers.
 */
export function cachedJsonResponse<T>(
  data: T,
  profile: CacheProfile,
  init?: ResponseInit
): NextResponse<T> {
  const profileHeaders = CACHE_PROFILES[profile];
  const mergedHeaders = new Headers(init?.headers);

  Object.entries(profileHeaders).forEach(([key, value]) => {
    mergedHeaders.set(key, value);
  });

  return NextResponse.json(data, {
    ...init,
    headers: mergedHeaders,
  });
}
