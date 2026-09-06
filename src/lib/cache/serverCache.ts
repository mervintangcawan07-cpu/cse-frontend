// Relative Path: src/lib/cache/serverCache.ts
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, CACHE_KEYS, CACHE_TTLS } from "./tags";

/**
 * Authoritative Server Data Cache for Reviewer Study Notes catalog.
 * Wraps Prisma query in Next.js Data Cache with 3600-second TTL and on-demand tag revalidation.
 */
export const getCachedReviewerNotes = unstable_cache(
  async () => {
    return prisma.studyNote.findMany({
      orderBy: { createdAt: "desc" },
    });
  },
  [...CACHE_KEYS.REVIEWER],
  {
    tags: [CACHE_TAGS.REVIEWER],
    revalidate: CACHE_TTLS.REVIEWER,
  }
);

/**
 * Authoritative Server Data Cache for Reading Materials Handbook Metadata catalog.
 * Strictly metadata-only (fileData excluded).
 * Wraps Prisma query in Next.js Data Cache with 3600-second TTL and on-demand tag revalidation.
 */
export const getCachedReadingMaterials = unstable_cache(
  async () => {
    return prisma.handbook.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        category: true,
        description: true,
        pages: true,
        fileName: true,
        createdAt: true,
      },
    });
  },
  [...CACHE_KEYS.READING_MATERIALS],
  {
    tags: [CACHE_TAGS.READING_MATERIALS],
    revalidate: CACHE_TTLS.READING_MATERIALS,
  }
);

/**
 * Narrow invalidation helper using two-argument Next.js 16 API: revalidateTag(tag, "max").
 * Logs failures clearly at ERROR level and never throws, ensuring database mutation
 * success is not falsely returned as a failure to callers.
 */
export function invalidateCacheTag(tag: string): void {
  try {
    revalidateTag(tag, "max");
  } catch (error) {
    console.error("[CACHE_INVALIDATION_FAILURE]", {
      tag,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Invalidate Reviewer catalog cache tag on successful mutation.
 */
export function revalidateReviewerCatalog(): void {
  invalidateCacheTag(CACHE_TAGS.REVIEWER);
}

/**
 * Invalidate Reading Materials catalog cache tag on successful mutation.
 */
export function revalidateReadingMaterialsCatalog(): void {
  invalidateCacheTag(CACHE_TAGS.READING_MATERIALS);
}
