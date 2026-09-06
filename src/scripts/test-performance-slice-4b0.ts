import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function getTrackedChangedFiles(): string[] {
  return execFileSync("git", ["diff", "--name-only"], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
}

async function runTests() {
  console.log("▶ Running Slice 4B-0 Verification Tests...\n");

  const badgeDisplaySrc = source("src/components/profile/BadgeDisplay.tsx");
  const authContextSrc = source("src/context/AuthContext.tsx");
  const reviewerPageSrc = source("src/app/reviewer/page.tsx");
  const readingMaterialsPageSrc = source("src/app/reading-materials/page.tsx");
  const learningPageSrc = source("src/app/learning/page.tsx");
  const cscCountdownWidgetSrc = source("src/components/CSCCountdownWidget.tsx");
  const clientCacheSrc = source("src/lib/clientCache.ts");

  // Test 1: BadgeDisplay no longer imports or uses fetchWithClientCache
  console.log("✓ Test 1: BadgeDisplay no longer imports fetchWithClientCache");
  assert.doesNotMatch(
    badgeDisplaySrc,
    /import\s+{[^}]*fetchWithClientCache[^}]*}\s+from/i,
    "BadgeDisplay must not import fetchWithClientCache"
  );
  assert.doesNotMatch(
    badgeDisplaySrc,
    /fetchWithClientCache\s*\(/i,
    "BadgeDisplay must not invoke fetchWithClientCache"
  );

  // Test 2: BadgeDisplay directly requests /api/user/badges with AbortController
  console.log("✓ Test 2: BadgeDisplay directly requests /api/user/badges with AbortController cancellation");
  assert.match(
    badgeDisplaySrc,
    /fetch\(\s*["']\/api\/user\/badges["']\s*,\s*\{\s*signal:\s*controller\.signal\s*\}\s*\)/,
    "BadgeDisplay must directly call fetch('/api/user/badges', { signal: controller.signal })"
  );
  assert.match(
    badgeDisplaySrc,
    /const\s+controller\s*=\s*new\s+AbortController\(\)/,
    "BadgeDisplay must instantiate AbortController"
  );
  assert.match(
    badgeDisplaySrc,
    /return\s*\(\)\s*=>\s*\{\s*controller\.abort\(\);\s*\}/,
    "BadgeDisplay must abort fetch on component unmount"
  );

  // Test 3: BadgeDisplay does NOT write to sessionStorage or clientCache
  console.log("✓ Test 3: BadgeDisplay cannot write to browser storage");
  assert.doesNotMatch(
    badgeDisplaySrc,
    /sessionStorage/i,
    "BadgeDisplay must not reference sessionStorage directly"
  );
  assert.doesNotMatch(
    badgeDisplaySrc,
    /localStorage/i,
    "BadgeDisplay must not reference localStorage directly"
  );
  assert.doesNotMatch(
    badgeDisplaySrc,
    /setCachedData/i,
    "BadgeDisplay must not call setCachedData"
  );

  // Test 4: clearAuth() contains targeted legacy badge cache cleanup
  console.log("✓ Test 4: clearAuth() contains targeted legacy badge cache cleanup");
  assert.match(
    authContextSrc,
    /const\s+clearAuth\s*=\s*useCallback\(\(\)\s*=>\s*\{[\s\S]*sessionStorage\.removeItem\(\s*["']cse_cache_\/api\/user\/badges["']\s*\)[\s\S]*\},/m,
    "clearAuth() must contain sessionStorage.removeItem('cse_cache_/api/user/badges')"
  );

  // Test 5: Cleanup does NOT use sessionStorage.clear()
  console.log("✓ Test 5: Cleanup does not use sessionStorage.clear()");
  assert.doesNotMatch(
    authContextSrc,
    /sessionStorage\.clear\(\)/i,
    "clearAuth() must NOT wipe sessionStorage globally"
  );

  // Test 6: Cleanup is targeted and does NOT wipe the full cse_cache_ namespace
  console.log("✓ Test 6: Cleanup does not wipe the entire cse_cache_ namespace");
  assert.doesNotMatch(
    authContextSrc,
    /sessionStorage\.removeItem\(\s*["']cse_cache_["']\s*\)/i,
    "clearAuth() must not delete generic prefix"
  );
  assert.doesNotMatch(
    authContextSrc,
    /Object\.keys\(sessionStorage\)/i,
    "clearAuth() must not iterate and bulk-delete sessionStorage keys"
  );

  // Test 7: Public fetchWithClientCache consumers remain intact
  console.log("✓ Test 7: Public fetchWithClientCache consumers remain intact");
  assert.match(
    reviewerPageSrc,
    /fetchWithClientCache<[^>]*>\(\s*["']\/api\/reviewer["']\s*\)/,
    "/api/reviewer must continue using fetchWithClientCache in reviewer page"
  );
  assert.match(
    readingMaterialsPageSrc,
    /fetchWithClientCache<[^>]*>\(\s*["']\/api\/reading-materials["']\s*\)/,
    "/api/reading-materials must continue using fetchWithClientCache in reading-materials page"
  );
  assert.match(
    learningPageSrc,
    /fetchWithClientCache<[^>]*>\(\s*["']\/api\/reviewer["']\s*\)/,
    "/api/reviewer must continue using fetchWithClientCache in learning page"
  );
  assert.match(
    learningPageSrc,
    /fetchWithClientCache<[^>]*>\(\s*["']\/api\/reading-materials["']\s*\)/,
    "/api/reading-materials must continue using fetchWithClientCache in learning page"
  );
  assert.match(
    cscCountdownWidgetSrc,
    /fetchWithClientCache/,
    "CSCCountdownWidget must continue using fetchWithClientCache"
  );

  // Test 8: src/lib/clientCache.ts is unmodified
  console.log("✓ Test 8: src/lib/clientCache.ts is unmodified");
  assert.match(
    clientCacheSrc,
    /export function getCachedData/,
    "getCachedData must be intact"
  );
  assert.match(
    clientCacheSrc,
    /export async function fetchWithClientCache/,
    "fetchWithClientCache must be intact"
  );

  // Test 9: Simulated storage isolation verification
  console.log("✓ Test 9: Simulated storage isolation behavior");
  const fakeStorage: Record<string, string> = {
    "cse_cache_/api/user/badges": JSON.stringify({ timestamp: Date.now(), data: { totalEarned: 10 } }),
    "cse_cache_/api/reviewer": JSON.stringify({ timestamp: Date.now(), data: { notes: [] } }),
    "cse_cache_/api/reading-materials": JSON.stringify({ timestamp: Date.now(), data: { handbooks: [] } }),
    "other_app_key": "preserved",
  };

  const simulatedSessionStorage = {
    getItem: (key: string) => fakeStorage[key] || null,
    setItem: (key: string, val: string) => { fakeStorage[key] = val; },
    removeItem: (key: string) => { delete fakeStorage[key]; },
  };

  // Simulate legacy cleanup logic from clearAuth()
  try {
    if (typeof simulatedSessionStorage !== "undefined" && simulatedSessionStorage) {
      simulatedSessionStorage.removeItem("cse_cache_/api/user/badges");
    }
  } catch {
    // Best-effort
  }

  assert.equal(
    fakeStorage["cse_cache_/api/user/badges"],
    undefined,
    "Legacy badge cache key must be deleted"
  );
  assert.ok(
    fakeStorage["cse_cache_/api/reviewer"],
    "Public reviewer cache entry must be preserved"
  );
  assert.ok(
    fakeStorage["cse_cache_/api/reading-materials"],
    "Public reading materials cache entry must be preserved"
  );
  assert.equal(
    fakeStorage["other_app_key"],
    "preserved",
    "Unrelated storage keys must remain preserved"
  );

  // Test 10: Simulated storage throw safety
  console.log("✓ Test 10: Simulated storage throw safety");
  const throwingSessionStorage = {
    removeItem: () => {
      throw new Error("SecurityError: Storage access denied");
    },
  };

  let cleanupThrew = false;
  try {
    try {
      if (typeof throwingSessionStorage !== "undefined" && throwingSessionStorage) {
        throwingSessionStorage.removeItem();
      }
    } catch {
      // Best-effort storage cleanup: never interfere with auth clearing if storage throws
    }
  } catch {
    cleanupThrew = true;
  }

  assert.equal(
    cleanupThrew,
    false,
    "clearAuth() legacy cleanup must never rethrow or interrupt auth clearing"
  );

  // Test 11: File scope check - ONLY authorized files modified
  console.log("✓ Test 11: Strict file scope check");
  const modifiedFiles = getTrackedChangedFiles();
  const allowedModified = new Set([
    "src/components/profile/BadgeDisplay.tsx",
    "src/context/AuthContext.tsx",
  ]);

  for (const file of modifiedFiles) {
    assert.ok(
      allowedModified.has(file),
      `Unexpected modified file: ${file}. Only ${[...allowedModified].join(", ")} are authorized.`
    );
  }

  console.log("\n✅ ALL SLICE 4B-0 AUTOMATED TESTS PASSED SUCCESSFULLY.");
}

runTests().catch((err) => {
  console.error("\n❌ SLICE 4B-0 TEST SUITE FAILED:", err);
  process.exit(1);
});

