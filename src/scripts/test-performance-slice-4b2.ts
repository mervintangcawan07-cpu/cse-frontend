// Relative Path: src/scripts/test-performance-slice-4b2.ts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function getChangedFiles(): string[] {
  const tracked = execFileSync("git", ["diff", "--name-only"], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);

  const untracked = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    { cwd: process.cwd(), encoding: "utf8" }
  )
    .split(/\r?\n/)
    .filter(Boolean);

  return [...new Set([...tracked, ...untracked])];
}

async function runTests() {
  console.log("▶ Running Slice 4B-2 Verification Tests...\n");

  // Read target source files
  const serverCacheSrc = source("src/lib/cache/serverCache.ts");
  const cacheLibSrc = source("src/lib/cache.ts");
  const reviewerRouteSrc = source("src/app/api/reviewer/route.ts");
  const readingRouteSrc = source("src/app/api/reading-materials/route.ts");
  const readingFileRouteSrc = source("src/app/api/reading-materials/file/route.ts");
  const reviewerPageSrc = source("src/app/reviewer/page.tsx");
  const readingPageSrc = source("src/app/reading-materials/page.tsx");
  const learningPageSrc = source("src/app/learning/page.tsx");
  const clientCacheSrc = source("src/lib/clientCache.ts");
  const nextConfigSrc = source("next.config.ts");
  const architectureDocSrc = source("docs/performance/SLICE_4B2_AUTHORITATIVE_DATA_CACHE.md");

  // Dynamically import tags and cache helpers to verify runtime export contracts
  const tagsModule = await import("../lib/cache/tags");
  const serverCacheModule = await import("../lib/cache/serverCache");

  // Test 1: Canonical cache tags exist
  console.log("✓ Test 1: Canonical cache tags exist");
  assert.equal(tagsModule.CACHE_TAGS.REVIEWER, "reviewer-content");
  assert.equal(tagsModule.CACHE_TAGS.READING_MATERIALS, "reading-materials");

  // Test 2: Reviewer cache key/version exists
  console.log("✓ Test 2: Reviewer cache key/version exists");
  assert.deepEqual(Array.from(tagsModule.CACHE_KEYS.REVIEWER), ["reviewer", "notes-catalog", "v1"]);

  // Test 3: Reading cache key/version exists
  console.log("✓ Test 3: Reading cache key/version exists");
  assert.deepEqual(Array.from(tagsModule.CACHE_KEYS.READING_MATERIALS), ["reading-materials", "catalog-metadata", "v1"]);

  // Test 4: TTL = 3600 for both
  console.log("✓ Test 4: TTL = 3600 for both");
  assert.equal(tagsModule.CACHE_TTLS.REVIEWER, 3600);
  assert.equal(tagsModule.CACHE_TTLS.READING_MATERIALS, 3600);

  // Test 5: Reviewer getter uses unstable_cache
  console.log("✓ Test 5: Reviewer getter uses unstable_cache");
  assert.match(
    serverCacheSrc,
    /export\s+const\s+getCachedReviewerNotes\s*=\s*unstable_cache\(/,
    "getCachedReviewerNotes must be wrapped in unstable_cache"
  );
  assert.match(
    serverCacheSrc,
    /prisma\.studyNote\.findMany/,
    "Reviewer getter must execute prisma.studyNote.findMany"
  );

  // Test 6: Reading getter uses unstable_cache
  console.log("✓ Test 6: Reading getter uses unstable_cache");
  assert.match(
    serverCacheSrc,
    /export\s+const\s+getCachedReadingMaterials\s*=\s*unstable_cache\(/,
    "getCachedReadingMaterials must be wrapped in unstable_cache"
  );
  assert.match(
    serverCacheSrc,
    /prisma\.handbook\.findMany/,
    "Reading Materials getter must execute prisma.handbook.findMany"
  );
  assert.doesNotMatch(
    serverCacheSrc,
    /fileData:\s*true/,
    "Reading Materials getter must never select or cache fileData"
  );

  // Test 7: Reviewer GET no longer directly performs live Prisma query
  console.log("✓ Test 7: Reviewer GET delegates to getCachedReviewerNotes");
  assert.match(
    reviewerRouteSrc,
    /getCachedReviewerNotes\(\)/,
    "GET handler must call getCachedReviewerNotes()"
  );
  // Ensure GET function body does not invoke prisma.studyNote directly
  const reviewerGetMatch = reviewerRouteSrc.match(/export\s+async\s+function\s+GET\s*\(\)[\s\S]*?\n\}/);
  assert.ok(reviewerGetMatch, "Reviewer GET function must exist");
  assert.doesNotMatch(
    reviewerGetMatch[0],
    /prisma\.studyNote/,
    "Reviewer GET must not directly query prisma.studyNote"
  );

  // Test 8: Reading GET no longer directly performs live Prisma metadata query
  console.log("✓ Test 8: Reading GET delegates to getCachedReadingMaterials");
  assert.match(
    readingRouteSrc,
    /getCachedReadingMaterials\(\)/,
    "GET handler must call getCachedReadingMaterials()"
  );
  const readingGetMatch = readingRouteSrc.match(/export\s+async\s+function\s+GET\s*\(\)[\s\S]*?\n\}/);
  assert.ok(readingGetMatch, "Reading Materials GET function must exist");
  assert.doesNotMatch(
    readingGetMatch[0],
    /prisma\.handbook/,
    "Reading Materials GET must not directly query prisma.handbook"
  );

  // Test 9: Reviewer GET returns Data-Cache-backed response with DATA_CACHE_ONLY profile
  console.log("✓ Test 9: Reviewer GET uses DATA_CACHE_ONLY profile");
  assert.match(
    reviewerRouteSrc,
    /cachedJsonResponse\(\s*\{\s*notes\s*\}\s*,\s*["']DATA_CACHE_ONLY["']\s*\)/,
    "Reviewer GET must use DATA_CACHE_ONLY profile"
  );
  assert.doesNotMatch(
    reviewerRouteSrc,
    /"STATIC_METADATA"/,
    "Reviewer GET must not emit STATIC_METADATA response cache headers"
  );

  // Test 10: Reading GET returns Data-Cache-backed response with DATA_CACHE_ONLY profile
  console.log("✓ Test 10: Reading GET uses DATA_CACHE_ONLY profile");
  assert.match(
    readingRouteSrc,
    /cachedJsonResponse\(\s*\{\s*handbooks\s*\}\s*,\s*["']DATA_CACHE_ONLY["']\s*\)/,
    "Reading Materials GET must use DATA_CACHE_ONLY profile"
  );
  assert.doesNotMatch(
    readingRouteSrc,
    /"STATIC_METADATA"/,
    "Reading Materials GET must not emit STATIC_METADATA response cache headers"
  );

  // Test 10A: Data-Cache-only response profile disables browser and shared HTTP caching
  console.log("✓ Test 10A: DATA_CACHE_ONLY disables browser and shared HTTP caching");
  const dataCacheProfile = cacheLibSrc.match(/DATA_CACHE_ONLY:\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(dataCacheProfile, "DATA_CACHE_ONLY profile must exist");
  assert.match(dataCacheProfile[1], /"Cache-Control":\s*"private, no-cache, no-store, max-age=0, must-revalidate"/);
  assert.match(dataCacheProfile[1], /"CDN-Cache-Control":\s*"no-store"/);
  assert.match(dataCacheProfile[1], /"Vercel-CDN-Cache-Control":\s*"no-store"/);
  assert.doesNotMatch(dataCacheProfile[1], /s-maxage|stale-while-revalidate/);

  // Test 11: Reviewer POST invalidates Reviewer tag
  console.log("✓ Test 11: Reviewer POST invalidates Reviewer tag");
  const reviewerPostMatch = reviewerRouteSrc.match(/export\s+async\s+function\s+POST[\s\S]*?\n\}/);
  assert.ok(reviewerPostMatch);
  assert.match(
    reviewerPostMatch[0],
    /revalidateReviewerCatalog\(\)/,
    "Reviewer POST must call revalidateReviewerCatalog()"
  );

  // Test 12: Reviewer PUT invalidates Reviewer tag
  console.log("✓ Test 12: Reviewer PUT invalidates Reviewer tag");
  const reviewerPutMatch = reviewerRouteSrc.match(/export\s+async\s+function\s+PUT[\s\S]*?\n\}/);
  assert.ok(reviewerPutMatch);
  assert.match(
    reviewerPutMatch[0],
    /revalidateReviewerCatalog\(\)/,
    "Reviewer PUT must call revalidateReviewerCatalog()"
  );

  // Test 13: Reviewer DELETE invalidates Reviewer tag
  console.log("✓ Test 13: Reviewer DELETE invalidates Reviewer tag");
  const reviewerDeleteMatch = reviewerRouteSrc.match(/export\s+async\s+function\s+DELETE[\s\S]*?\n\}/);
  assert.ok(reviewerDeleteMatch);
  assert.match(
    reviewerDeleteMatch[0],
    /revalidateReviewerCatalog\(\)/,
    "Reviewer DELETE must call revalidateReviewerCatalog()"
  );

  // Test 14: Handbook POST invalidates Reading Materials tag
  console.log("✓ Test 14: Handbook POST invalidates Reading Materials tag");
  const readingPostMatch = readingRouteSrc.match(/export\s+async\s+function\s+POST[\s\S]*?\n\}/);
  assert.ok(readingPostMatch);
  assert.match(
    readingPostMatch[0],
    /revalidateReadingMaterialsCatalog\(\)/,
    "Handbook POST must call revalidateReadingMaterialsCatalog()"
  );

  // Test 15: Handbook PUT invalidates Reading Materials tag
  console.log("✓ Test 15: Handbook PUT invalidates Reading Materials tag");
  const readingPutMatch = readingRouteSrc.match(/export\s+async\s+function\s+PUT[\s\S]*?\n\}/);
  assert.ok(readingPutMatch);
  assert.match(
    readingPutMatch[0],
    /revalidateReadingMaterialsCatalog\(\)/,
    "Handbook PUT must call revalidateReadingMaterialsCatalog()"
  );

  // Test 16: Handbook DELETE invalidates Reading Materials tag
  console.log("✓ Test 16: Handbook DELETE invalidates Reading Materials tag");
  const readingDeleteMatch = readingRouteSrc.match(/export\s+async\s+function\s+DELETE[\s\S]*?\n\}/);
  assert.ok(readingDeleteMatch);
  assert.match(
    readingDeleteMatch[0],
    /revalidateReadingMaterialsCatalog\(\)/,
    "Handbook DELETE must call revalidateReadingMaterialsCatalog()"
  );

  // Test 17: Invalidation uses the two-argument Next.js 16 form
  console.log("✓ Test 17: Invalidation helper uses two-argument revalidateTag(tag, 'max')");
  assert.match(
    serverCacheSrc,
    /revalidateTag\(\s*tag\s*,\s*["']max["']\s*\)/,
    "Must use Next.js 16 two-argument revalidateTag(tag, 'max')"
  );
  assert.doesNotMatch(
    serverCacheSrc,
    /revalidateTag\(\s*tag\s*\)/,
    "Must not use deprecated single-argument revalidateTag(tag)"
  );

  // Test 18: Invalidation errors produce ERROR-level logging
  console.log("✓ Test 18: Invalidation errors produce ERROR-level logging");
  assert.match(
    serverCacheSrc,
    /console\.error\(\s*["']\[CACHE_INVALIDATION_FAILURE\]["']/,
    "Invalidation helper must log [CACHE_INVALIDATION_FAILURE] via console.error"
  );

  // Test 19: Invalidation errors do not convert successful DB mutation into false failure
  console.log("✓ Test 19: Invalidation errors are caught and do not rethrow");
  assert.match(
    serverCacheSrc,
    /try\s*\{[\s\S]*?revalidateTag[\s\S]*?\}\s*catch\s*\(error\)\s*\{/,
    "revalidateTag must be safely wrapped in try/catch to protect DB mutation success"
  );
  // Verify helper function does not throw when invoked in mock environment
  assert.doesNotThrow(() => {
    serverCacheModule.invalidateCacheTag("test-tag");
  }, "invalidateCacheTag must not throw outside request context");

  // Test 20: /api/reading-materials/file remains unchanged
  console.log("✓ Test 20: /api/reading-materials/file remains unchanged");
  assert.match(
    readingFileRouteSrc,
    /max-age=31536000,\s*immutable/,
    "Binary file route cache header must remain intact and unchanged"
  );

  // Test 21: Reviewer client consumers do not use fetchWithClientCache
  console.log("✓ Test 21: Reviewer page does not use fetchWithClientCache");
  assert.doesNotMatch(
    reviewerPageSrc,
    /fetchWithClientCache/,
    "reviewer/page.tsx must not import or use fetchWithClientCache"
  );
  assert.match(
    reviewerPageSrc,
    /fetch\(\s*["']\/api\/reviewer["']\s*,\s*\{[\s\S]*?cache:\s*["']no-store["']/,
    "reviewer/page.tsx must use direct fetch with cache: 'no-store'"
  );
  assert.match(reviewerPageSrc, /const\s+controller\s*=\s*new\s+AbortController\(\)/);
  assert.match(reviewerPageSrc, /fetch\(\s*["']\/api\/bookmarks["']\s*,\s*\{\s*signal:\s*controller\.signal/);
  assert.match(reviewerPageSrc, /return\s*\(\)\s*=>\s*controller\.abort\(\)/);

  // Test 22: Reading catalog client consumers do not use fetchWithClientCache
  console.log("✓ Test 22: Reading materials and learning pages do not use fetchWithClientCache for catalogs");
  assert.doesNotMatch(
    readingPageSrc,
    /fetchWithClientCache/,
    "reading-materials/page.tsx must not use fetchWithClientCache"
  );
  assert.match(
    readingPageSrc,
    /fetch\(\s*["']\/api\/reading-materials["']\s*,\s*\{[\s\S]*?cache:\s*["']no-store["']/,
    "reading-materials/page.tsx must use direct fetch with cache: 'no-store'"
  );
  assert.doesNotMatch(
    learningPageSrc,
    /fetchWithClientCache/,
    "learning/page.tsx must not use fetchWithClientCache"
  );
  assert.match(
    learningPageSrc,
    /fetch\(\s*["']\/api\/reviewer["']\s*,\s*\{[\s\S]*?cache:\s*["']no-store["'][\s\S]*?signal:\s*controller\.signal/,
    "learning/page.tsx must directly fetch Reviewer through the authoritative server cache"
  );
  assert.match(
    learningPageSrc,
    /fetch\(\s*["']\/api\/reading-materials["']\s*,\s*\{[\s\S]*?cache:\s*["']no-store["'][\s\S]*?signal:\s*controller\.signal/,
    "learning/page.tsx must directly fetch Reading Materials through the authoritative server cache"
  );
  assert.match(readingPageSrc, /const\s+controller\s*=\s*new\s+AbortController\(\)/);
  assert.match(readingPageSrc, /return\s*\(\)\s*=>\s*controller\.abort\(\)/);
  assert.match(learningPageSrc, /const\s+controller\s*=\s*new\s+AbortController\(\)/);
  assert.match(learningPageSrc, /return\s*\(\)\s*=>\s*controller\.abort\(\)/);

  // Test 23: No sessionStorage broad wipe exists
  console.log("✓ Test 23: No sessionStorage broad wipe exists");
  assert.doesNotMatch(reviewerPageSrc, /sessionStorage\.clear\(\)/, "reviewer page must not clear all sessionStorage");
  assert.doesNotMatch(readingPageSrc, /sessionStorage\.clear\(\)/, "reading page must not clear all sessionStorage");
  assert.doesNotMatch(learningPageSrc, /sessionStorage\.clear\(\)/, "learning page must not clear all sessionStorage");
  const catalogClientSources = [reviewerPageSrc, readingPageSrc, learningPageSrc].join("\n");
  assert.doesNotMatch(catalogClientSources, /sessionStorage\.(?:getItem|setItem|removeItem)/);
  assert.doesNotMatch(catalogClientSources, /cse_cache_/);

  // Test 24: src/lib/clientCache.ts remains present and intact
  console.log("✓ Test 24: src/lib/clientCache.ts remains present and intact");
  assert.ok(existsSync("src/lib/clientCache.ts"), "clientCache.ts must exist");
  assert.match(clientCacheSrc, /export function getCachedData/, "clientCache.ts getCachedData intact");
  assert.match(clientCacheSrc, /export async function fetchWithClientCache/, "clientCache.ts fetchWithClientCache intact");

  // Test 25: src/lib/contentEligibility.ts unchanged
  console.log("✓ Test 25: src/lib/contentEligibility.ts unchanged");
  const contentEligSrc = source("src/lib/contentEligibility.ts");
  assert.match(contentEligSrc, /export function isEliminationQuestion/, "contentEligibility isEliminationQuestion intact");
  assert.match(contentEligSrc, /export function activeOrdinaryQuestionWhere/, "contentEligibility activeOrdinaryQuestionWhere intact");

  // Test 26: Question Bank routes unchanged
  console.log("✓ Test 26: Question Bank routes unchanged");
  const changed = getChangedFiles();
  assert.ok(!changed.some((f) => f.includes("admin/questions")), "No question bank routes changed");

  // Test 27: Elimination routes/pages unchanged
  console.log("✓ Test 27: Elimination routes/pages unchanged");
  assert.ok(!changed.some((f) => f.includes("elimination")), "No elimination drill files changed");

  // Test 28: Flashcard routes/pages unchanged
  console.log("✓ Test 28: Flashcard routes/pages unchanged");
  assert.ok(!changed.some((f) => f.includes("flashcards")), "No flashcard files changed");

  // Test 29: No auth/payment/accounting/exam/social files changed
  console.log("✓ Test 29: No auth/payment/accounting/exam/social files changed");
  const forbiddenKeywords = ["payment", "webhook", "ledger", "partner", "serverAuth", "AuthContext", "social", "exam", "grading"];
  for (const file of changed) {
    for (const kw of forbiddenKeywords) {
      assert.ok(!file.toLowerCase().includes(kw.toLowerCase()), `File ${file} matches forbidden keyword ${kw}`);
    }
  }

  // Test 30: No Prisma schema/migration changes
  console.log("✓ Test 30: No Prisma schema or migration changes");
  assert.ok(!changed.some((f) => f.includes("prisma/schema")), "prisma/schema must not be changed");
  assert.ok(!changed.some((f) => f.includes("prisma/migrations")), "prisma/migrations must not be changed");

  // Test 31: No dependency/lockfile changes
  console.log("✓ Test 31: No dependency or lockfile changes");
  assert.ok(!changed.some((f) => f.includes("package.json")), "package.json must not be changed");
  assert.ok(!changed.some((f) => f.includes("package-lock.json")), "package-lock.json must not be changed");

  // Test 32: No Cache Components configuration
  console.log("✓ Test 32: No Cache Components configuration in next.config.ts");
  assert.doesNotMatch(nextConfigSrc, /cacheComponents/, "cacheComponents must not be in next.config.ts");
  assert.doesNotMatch(nextConfigSrc, /"use cache"/, "use cache must not be configured");

  // Test 33: No next.config.ts modifications
  console.log("✓ Test 33: next.config.ts not modified");
  assert.ok(!changed.includes("next.config.ts"), "next.config.ts must be completely untouched");

  // Test 34: Exact Slice 4B-2 file scope includes tracked and untracked files
  console.log("✓ Test 34: Exact Slice 4B-2 file scope is preserved");
  const allowedFiles = new Set([
    "docs/performance/SLICE_4B2_AUTHORITATIVE_DATA_CACHE.md",
    "src/app/api/reading-materials/route.ts",
    "src/app/api/reviewer/route.ts",
    "src/app/learning/page.tsx",
    "src/app/reading-materials/page.tsx",
    "src/app/reviewer/page.tsx",
    "src/lib/cache.ts",
    "src/lib/cache/serverCache.ts",
    "src/lib/cache/tags.ts",
    "src/scripts/test-performance-slice-4b2.ts",
  ]);
  for (const file of changed) {
    assert.ok(allowedFiles.has(file), `Unexpected Slice 4B-2 file: ${file}`);
  }

  // Test 35: Architecture record captures the operational freshness contract
  console.log("✓ Test 35: Architecture record captures the operational freshness contract");
  assert.match(architectureDocSrc, /Next\.js Data Cache[^\n]*authoritative/i);
  assert.match(architectureDocSrc, /revalidateTag\([^\n]*"max"/);
  assert.match(architectureDocSrc, /first request[^\n]*stale/i);
  assert.match(architectureDocSrc, /sessionStorage[^\n]*not[^\n]*authorit/i);
  assert.match(architectureDocSrc, /\/api\/reading-materials\/file[^\n]*Slice 4C/i);

  console.log("\n✅ All Slice 4B-2 Verification Tests Passed Successfully!");
}

runTests().catch((err) => {
  console.error("\n❌ Slice 4B-2 Test Failure:", err);
  process.exit(1);
});
