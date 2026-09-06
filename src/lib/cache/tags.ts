// Relative Path: src/lib/cache/tags.ts

/**
 * Slice 4B-2: Canonical Cache Tags, Keys, and TTLs for Server Data Cache.
 * Narrowly scoped to public shared educational catalogs (Reviewer & Reading Materials).
 */

export const CACHE_TAGS = {
  REVIEWER: "reviewer-content",
  READING_MATERIALS: "reading-materials",
} as const;

export const CACHE_KEYS = {
  REVIEWER: ["reviewer", "notes-catalog", "v1"],
  READING_MATERIALS: ["reading-materials", "catalog-metadata", "v1"],
} as const;

export const CACHE_TTLS = {
  REVIEWER: 3600,
  READING_MATERIALS: 3600,
} as const;
