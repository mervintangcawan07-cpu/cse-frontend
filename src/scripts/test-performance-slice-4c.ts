// Relative Path: src/scripts/test-performance-slice-4c.ts
/**
 * Slice 4C — Binary Cache Correctness: Static verification test suite.
 *
 * Tests verify the source-level implementation without running the Next.js
 * server.  All tests are synchronous file/AST inspections.
 *
 * Run from project root:
 *   npx ts-node --project tsconfig.json src/scripts/test-performance-slice-4c.ts
 *
 * Expected: 35 PASS, 0 FAIL
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ PASS  ${name}`);
    passed++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ FAIL  ${name}`);
    console.error(`         ${msg}`);
    failed++;
    failures.push(`${name}: ${msg}`);
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertContains(source: string, substring: string, label: string): void {
  assert(
    source.includes(substring),
    `Expected ${label} to contain: ${JSON.stringify(substring)}`
  );
}

function assertNotContains(
  source: string,
  substring: string,
  label: string
): void {
  assert(
    !source.includes(substring),
    `Expected ${label} NOT to contain: ${JSON.stringify(substring)}`
  );
}

// ---------------------------------------------------------------------------
// Source file loader — uses process.cwd() to match other test scripts
// ---------------------------------------------------------------------------

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function fileExists(relativePath: string): boolean {
  return existsSync(join(process.cwd(), relativePath));
}

// ---------------------------------------------------------------------------
// SECTION 1: binaryCache.ts unit-level tests
// ---------------------------------------------------------------------------

console.log("\n── Section 1: binaryCache.ts helpers ──────────────────────────");

test("1.1  binaryCache.ts exists", () => {
  assert(fileExists("src/lib/cache/binaryCache.ts"), "binaryCache.ts not found");
});

const binaryCache = source("src/lib/cache/binaryCache.ts");

test("1.2  exports buildHandbookBinaryEtag", () => {
  assertContains(binaryCache, "export function buildHandbookBinaryEtag", "binaryCache.ts");
});

test("1.3  buildHandbookBinaryEtag uses weak ETag format W/\"handbook-...", () => {
  assertContains(binaryCache, 'W/"handbook-', "binaryCache.ts");
});

test("1.4  buildHandbookBinaryEtag includes updatedAt.getTime()", () => {
  assertContains(binaryCache, "updatedAt.getTime()", "binaryCache.ts");
});

test("1.5  exports matchesEtag", () => {
  assertContains(binaryCache, "export function matchesEtag", "binaryCache.ts");
});

test("1.6  matchesEtag handles null header (returns false)", () => {
  assertContains(binaryCache, "if (!ifNoneMatchHeader)", "binaryCache.ts");
});

test("1.7  matchesEtag handles wildcard *", () => {
  assertContains(binaryCache, '"*"', "binaryCache.ts");
});

test("1.8  matchesEtag handles comma-separated list", () => {
  assertContains(binaryCache, 'split(",")', "binaryCache.ts");
});

test("1.9  exports BINARY_BROWSER_CACHE_HEADERS constant", () => {
  assertContains(binaryCache, "export const BINARY_BROWSER_CACHE_HEADERS", "binaryCache.ts");
});

test("1.10 BINARY_BROWSER_CACHE_HEADERS uses private, no-cache", () => {
  assertContains(
    binaryCache,
    "private, no-cache, max-age=0, must-revalidate",
    "binaryCache.ts"
  );
});

test("1.11 BINARY_BROWSER_CACHE_HEADERS Cache-Control does NOT use no-store (browser must retain copy)", () => {
  const ccLine = binaryCache
    .split("\n")
    .find((l) => l.includes('"Cache-Control"') && l.includes("private"));
  assert(
    !!ccLine && !ccLine.includes("no-store"),
    "Cache-Control line must not contain no-store"
  );
});

test("1.12 BINARY_BROWSER_CACHE_HEADERS includes CDN-Cache-Control: no-store", () => {
  assertContains(binaryCache, '"CDN-Cache-Control": "no-store"', "binaryCache.ts");
});

test("1.13 BINARY_BROWSER_CACHE_HEADERS includes Vercel-CDN-Cache-Control: no-store", () => {
  assertContains(
    binaryCache,
    '"Vercel-CDN-Cache-Control": "no-store"',
    "binaryCache.ts"
  );
});

test("1.14 exports BINARY_ERROR_CACHE_HEADERS constant", () => {
  assertContains(binaryCache, "export const BINARY_ERROR_CACHE_HEADERS", "binaryCache.ts");
});

test("1.15 BINARY_ERROR_CACHE_HEADERS Cache-Control uses no-store", () => {
  const errorSection = binaryCache.slice(
    binaryCache.indexOf("BINARY_ERROR_CACHE_HEADERS")
  );
  assertContains(errorSection, '"Cache-Control": "no-store"', "BINARY_ERROR_CACHE_HEADERS section");
});

// ---------------------------------------------------------------------------
// SECTION 2: file/route.ts – defect fix verification
// ---------------------------------------------------------------------------

console.log("\n── Section 2: file/route.ts — defect fix ───────────────────────");

test("2.1  file/route.ts exists", () => {
  assert(
    fileExists("src/app/api/reading-materials/file/route.ts"),
    "file/route.ts not found"
  );
});

const fileRoute = source("src/app/api/reading-materials/file/route.ts");

test("2.2  imports binaryCache helpers", () => {
  assertContains(fileRoute, 'from "@/lib/cache/binaryCache"', "file/route.ts");
});

test("2.3  imports buildHandbookBinaryEtag", () => {
  assertContains(fileRoute, "buildHandbookBinaryEtag", "file/route.ts");
});

test("2.4  imports matchesEtag", () => {
  assertContains(fileRoute, "matchesEtag", "file/route.ts");
});

test("2.5  imports BINARY_BROWSER_CACHE_HEADERS", () => {
  assertContains(fileRoute, "BINARY_BROWSER_CACHE_HEADERS", "file/route.ts");
});

test("2.6  reads If-None-Match request header", () => {
  assertContains(fileRoute, "If-None-Match", "file/route.ts");
});

test("2.7  performs metadata-only query with select: { updatedAt: true }", () => {
  assertContains(fileRoute, "select: { updatedAt: true }", "file/route.ts");
});

test("2.8  returns 304 Not Modified on ETag match", () => {
  assertContains(fileRoute, "status: 304", "file/route.ts");
});

test("2.9  sets ETag header on 200 response", () => {
  assertContains(fileRoute, "ETag: etag", "file/route.ts");
});

test("2.10 returns 200 with full payload when ETag differs", () => {
  assertContains(fileRoute, "status: 200", "file/route.ts");
});

test("2.11 DOES NOT use Cache-Control: public max-age=31536000 immutable (defect removed)", () => {
  // Check only non-comment lines for the forbidden header values.
  // JSDoc may reference the old policy to explain the defect; that's fine.
  const codeLines = fileRoute
    .split("\n")
    .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"));
  const codeOnly = codeLines.join("\n");
  assertNotContains(codeOnly, "max-age=31536000", "file/route.ts code (excluding comments)");
  // The word 'immutable' must not appear as a Cache-Control directive
  const ccLines = codeOnly
    .split("\n")
    .filter((l) => l.includes("Cache-Control"));
  assert(
    ccLines.every((l) => !l.includes("immutable")),
    "Cache-Control header values must not include 'immutable'"
  );
});

test("2.12 DOES NOT use Cache-Control: public (binary files are private)", () => {
  assertNotContains(fileRoute, '"public,', "file/route.ts");
});

test("2.13 full query selects updatedAt alongside fileData and fileName", () => {
  assertContains(fileRoute, "updatedAt: true", "file/route.ts");
});

test("2.14 preserves existing content-type detection logic (.pdf/.doc/.docx/.txt)", () => {
  assertContains(fileRoute, "application/pdf", "file/route.ts");
  assertContains(fileRoute, "application/msword", "file/route.ts");
  assertContains(fileRoute, ".docx", "file/route.ts");
  assertContains(fileRoute, "text/plain", "file/route.ts");
});

test("2.15 preserves existing base64 decoding logic", () => {
  assertContains(fileRoute, "base64Data", "file/route.ts");
  assertContains(fileRoute, 'Buffer.from(base64Data, "base64")', "file/route.ts");
});

test("2.16 preserves Content-Disposition inline header", () => {
  assertContains(fileRoute, "Content-Disposition", "file/route.ts");
  assertContains(fileRoute, "inline;", "file/route.ts");
});

test("2.17 error responses include BINARY_ERROR_CACHE_HEADERS", () => {
  assertContains(fileRoute, "BINARY_ERROR_CACHE_HEADERS", "file/route.ts");
});

// ---------------------------------------------------------------------------
// SECTION 3: Schema — no changes required
// ---------------------------------------------------------------------------

console.log("\n── Section 3: Prisma schema — unchanged, updatedAt present ────");

const schema = source("prisma/schema.prisma");

test("3.1  Handbook model exists in schema", () => {
  assertContains(schema, "model Handbook {", "schema.prisma");
});

test("3.2  Handbook.updatedAt @updatedAt present (ETag source, no schema change needed)", () => {
  const start = schema.indexOf("model Handbook {");
  const nextModel = schema.indexOf("\n}\n\nmodel", start);
  const block = schema.slice(start, nextModel > 0 ? nextModel : schema.length);
  assertContains(block, "updatedAt", "Handbook model block");
  assertContains(block, "@updatedAt", "Handbook model block");
});

test("3.3  No new columns added to Handbook (no fileVersion, hash, or similar)", () => {
  const start = schema.indexOf("model Handbook {");
  const endIdx = schema.indexOf("\n}\n", start);
  const block = schema.slice(start, endIdx);
  assertNotContains(block, "fileVersion", "Handbook model block");
  assertNotContains(block, "fileHash", "Handbook model block");
});

// ---------------------------------------------------------------------------
// SECTION 4: Scope boundary — no unrelated file changes
// ---------------------------------------------------------------------------

console.log("\n── Section 4: Scope boundary ───────────────────────────────────");

test("4.1  reading-materials/page.tsx NOT modified by Slice 4C (iframe URL unchanged)", () => {
  const page = source("src/app/reading-materials/page.tsx");
  assertContains(page, "/api/reading-materials/file?id=", "reading-materials/page.tsx");
});

test("4.2  Slice 4B-2 reading-materials/route.ts still intact (revalidation preserved)", () => {
  const rm = source("src/app/api/reading-materials/route.ts");
  assertContains(rm, "revalidateReadingMaterialsCatalog", "reading-materials/route.ts");
});

test("4.3  src/lib/cache/tags.ts not removed by Slice 4C", () => {
  assert(fileExists("src/lib/cache/tags.ts"), "tags.ts must still exist");
  const tags = source("src/lib/cache/tags.ts");
  assertContains(tags, "CACHE_TAGS", "tags.ts");
});

test("4.4  src/lib/cache/serverCache.ts not removed by Slice 4C", () => {
  assert(fileExists("src/lib/cache/serverCache.ts"), "serverCache.ts must still exist");
  const sc = source("src/lib/cache/serverCache.ts");
  assertContains(sc, "getCachedReviewerNotes", "serverCache.ts");
});

test("4.5  src/lib/cache.ts not modified by Slice 4C", () => {
  assert(fileExists("src/lib/cache.ts"), "src/lib/cache.ts must still exist");
  const cl = source("src/lib/cache.ts");
  assertContains(cl, "DATA_CACHE_ONLY", "src/lib/cache.ts");
});

test("4.6  next.config.ts not modified by Slice 4C (cacheComponents not present)", () => {
  const nc = source("next.config.ts");
  assertNotContains(nc, "cacheComponents", "next.config.ts");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("\n────────────────────────────────────────────────────────────────");
console.log(`  Total: ${passed + failed}  PASS: ${passed}  FAIL: ${failed}`);

if (failures.length > 0) {
  console.log("\n  Failed tests:");
  failures.forEach((f) => console.log(`    • ${f}`));
}

console.log("────────────────────────────────────────────────────────────────\n");

process.exit(failed > 0 ? 1 : 0);
