// Relative Path: src/scripts/test-pwa-safety.ts
// Automated safety and boundary test suite for GovStudyX PWA-1A.

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function findFilesInDir(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findFilesInDir(fullPath, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

async function runTests() {
  console.log("▶ Running GovStudyX PWA-1A Safety Tests...\n");

  // 1. File existence
  console.log("✓ Test 1: Required PWA-1A files exist");
  assert.equal(existsSync(join(process.cwd(), "public/sw.js")), true, "public/sw.js must exist");
  assert.equal(existsSync(join(process.cwd(), "public/offline.html")), true, "public/offline.html must exist");

  const swSource = readSource("public/sw.js");
  const offlineHtmlSource = readSource("public/offline.html");
  const nextConfigSrc = readSource("next.config.ts");

  // 2. Registration absence
  console.log("✓ Test 2: Service Worker registration is completely absent");
  const sourceFiles = [
    ...findFilesInDir(join(process.cwd(), "src"), [".ts", ".tsx", ".js", ".jsx", ".mjs"]),
    ...findFilesInDir(join(process.cwd(), "public"), [".html", ".js"]),
  ].filter((p) => !p.endsWith("test-pwa-safety.ts"));

  for (const file of sourceFiles) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(
      content,
      /navigator\.serviceWorker\.register/i,
      `Service worker registration found in ${file}. PWA-1A must remain inert.`
    );
  }

  // 3. Service-worker forbidden constructs
  console.log("✓ Test 3: sw.js does not contain skipWaiting or clients.claim");
  assert.doesNotMatch(
    swSource,
    /skipWaiting\s*\(/i,
    "public/sw.js must not invoke skipWaiting() in PWA-1A"
  );
  assert.doesNotMatch(
    swSource,
    /clients\.claim\s*\(/i,
    "public/sw.js must not invoke clients.claim() in PWA-1A"
  );

  // 4. API safety boundary
  console.log("✓ Test 4: sw.js enforces broad /api boundary");
  assert.match(
    swSource,
    /url\.pathname\s*===\s*["']\/api["']\s*\|\|\s*url\.pathname\.startsWith\(\s*["']\/api\/["']\s*\)/,
    "public/sw.js must explicitly bypass /api and /api/* routes"
  );

  // 5. Non-GET safety
  console.log("✓ Test 5: sw.js excludes non-GET requests before any handling");
  assert.match(
    swSource,
    /request\.method\s*!==\s*["']GET["'][\s\S]*?return;/,
    "public/sw.js must immediately return on non-GET requests without calling respondWith"
  );

  // 6. Cross-origin safety
  console.log("✓ Test 6: sw.js leaves cross-origin requests untouched");
  assert.match(
    swSource,
    /url\.origin\s*!==\s*self\.location\.origin[\s\S]*?return;/,
    "public/sw.js must immediately return on cross-origin requests"
  );

  // 7. Next.js internal data & RSC safety
  console.log("✓ Test 7: sw.js bypasses Next.js internal data and RSC requests");
  assert.match(
    swSource,
    /_next\/data/,
    "public/sw.js must exclude /_next/data/ requests"
  );
  assert.match(
    swSource,
    /_rsc/,
    "public/sw.js must exclude _rsc query parameter requests"
  );
  assert.match(
    swSource,
    /headers\.get\(\s*["']RSC["']\s*\)/,
    "public/sw.js must exclude requests with RSC header"
  );

  // 8. Offline cache scope
  console.log("✓ Test 8: sw.js only precaches /offline.html");
  assert.match(
    swSource,
    /const\s+OFFLINE_URL\s*=\s*["']\/offline\.html["']/,
    "public/sw.js must define OFFLINE_URL as /offline.html"
  );
  const installMatch = swSource.match(/addEventListener\(\s*["']install["'][\s\S]*?\n\}\);/);
  assert.ok(installMatch, "install event listener must exist in public/sw.js");
  const installBlock = installMatch[0];
  assert.match(
    installBlock,
    /cache\.add\(\s*OFFLINE_URL\s*\)/,
    "public/sw.js must add OFFLINE_URL to cache during install"
  );
  assert.doesNotMatch(
    installBlock,
    /(?:["']\/["']|["']\/(?:dashboard|api|_next|manifest\.json))/i,
    "public/sw.js must not precache root, dashboard, api, static chunks, or manifest"
  );

  // 9. Navigation behavior: network-first with offline fallback, no cache persistence
  console.log("✓ Test 9: sw.js navigation behavior is network-first with offline fallback only");
  assert.match(
    swSource,
    /request\.mode\s*===\s*["']navigate["']/,
    "public/sw.js must gate respondWith to navigation mode"
  );
  assert.match(
    swSource,
    /fetch\(\s*request\s*\)\.catch/,
    "public/sw.js must attempt network fetch first for navigation"
  );
  assert.doesNotMatch(
    swSource,
    /caches\.put|cache\.put/,
    "public/sw.js must not store navigation responses into CacheStorage"
  );

  // 10. Sensitive-token scan
  console.log("✓ Test 10: sw.js contains zero application-specific sensitive targets");
  const sensitiveTokens = [
    "answerIndex",
    "examQuestions",
    "payment",
    "paymongo",
    "cse_session",
    "authorization",
    "cookie",
    "localStorage",
    "indexedDB",
  ];
  for (const token of sensitiveTokens) {
    const regex = new RegExp(`\\b${token}\\b`, "i");
    assert.doesNotMatch(
      swSource,
      regex,
      `public/sw.js must not contain sensitive token: "${token}"`
    );
  }

  // 11. Header rule in next.config.ts
  console.log("✓ Test 11: next.config.ts contains exact /sw.js no-cache header rule");
  assert.match(
    nextConfigSrc,
    /source:\s*["']\/sw\.js["']/,
    "next.config.ts must define an exact source rule for /sw.js"
  );
  assert.match(
    nextConfigSrc,
    /no-cache,\s*no-store,\s*must-revalidate/,
    "next.config.ts must configure Cache-Control: no-cache, no-store, must-revalidate for /sw.js"
  );

  // 12. Offline HTML self-containment
  console.log("✓ Test 12: public/offline.html is static and self-contained");
  assert.doesNotMatch(
    offlineHtmlSource,
    /<script[^>]+src=/i,
    "public/offline.html must not load external scripts"
  );
  assert.doesNotMatch(
    offlineHtmlSource,
    /<link[^>]+rel=["']stylesheet["']/i,
    "public/offline.html must not load external stylesheets"
  );
  assert.match(
    offlineHtmlSource,
    /window\.location\.reload\(\)/,
    "public/offline.html must provide a reload button"
  );
  assert.doesNotMatch(
    offlineHtmlSource,
    /localStorage|sessionStorage|indexedDB|fetch\s*\(|axios/i,
    "public/offline.html must not access application storage or invoke APIs"
  );

  console.log("\n✅ ALL 12 PWA-1A SAFETY TESTS PASSED.");
}

runTests().catch((err) => {
  console.error("\n❌ PWA-1A Safety Test Failed:\n", err);
  process.exit(1);
});
