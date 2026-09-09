// Relative Path: src/scripts/test-pwa-safety.ts
// Automated safety, boundary, and controlled registration test suite for GovStudyX PWA-1B.

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
  console.log("▶ Running GovStudyX PWA-1B Safety & Registration Tests...\n");

  // 1. File existence
  console.log("✓ Test 1: Required PWA files exist");
  assert.equal(existsSync(join(process.cwd(), "public/sw.js")), true, "public/sw.js must exist");
  assert.equal(existsSync(join(process.cwd(), "public/offline.html")), true, "public/offline.html must exist");
  assert.equal(existsSync(join(process.cwd(), "src/components/pwa/ServiceWorkerRegister.tsx")), true, "ServiceWorkerRegister.tsx must exist");

  const swSource = readSource("public/sw.js");
  const offlineHtmlSource = readSource("public/offline.html");
  const nextConfigSrc = readSource("next.config.ts");
  const registerSrc = readSource("src/components/pwa/ServiceWorkerRegister.tsx");
  const layoutSrc = readSource("src/app/layout.tsx");

  // 2. Exactly one controlled registration in runtime code
  console.log("✓ Test 2: Exactly one controlled Service Worker registration exists in runtime code");
  const sourceFiles = [
    ...findFilesInDir(join(process.cwd(), "src"), [".ts", ".tsx", ".js", ".jsx", ".mjs"]),
    ...findFilesInDir(join(process.cwd(), "public"), [".html", ".js"]),
  ].filter((p) => !p.endsWith("test-pwa-safety.ts"));

  const filesWithRegister: string[] = [];
  for (const file of sourceFiles) {
    const content = readFileSync(file, "utf8");
    if (/navigator\s*\.\s*serviceWorker\s*\.\s*register/i.test(content)) {
      filesWithRegister.push(file.replace(/\\/g, "/"));
    }
  }

  assert.equal(
    filesWithRegister.length,
    1,
    `Expected exactly 1 runtime file with navigator.serviceWorker.register, found: ${filesWithRegister.join(", ")}`
  );
  assert.ok(
    filesWithRegister[0].endsWith("src/components/pwa/ServiceWorkerRegister.tsx"),
    `Registration must only exist in ServiceWorkerRegister.tsx, found in: ${filesWithRegister[0]}`
  );

  // 3. Exact registration arguments
  console.log("✓ Test 3: Registration arguments strictly match approved specification");
  assert.match(
    registerSrc,
    /navigator\s*\.\s*serviceWorker\s*\.\s*register\(\s*["']\/sw\.js["']\s*,\s*\{[\s\S]*?scope:\s*["']\/["'][\s\S]*?updateViaCache:\s*["']none["'][\s\S]*?\}\s*\)/,
    "Registration must specify script '/sw.js', scope '/', and updateViaCache 'none'"
  );
  assert.doesNotMatch(
    registerSrc,
    /type:\s*["']module["']/,
    "ServiceWorkerRegister must not use type: 'module' (sw.js is a classic worker)"
  );

  // 4. Production gate requirement
  console.log("✓ Test 4: Service worker registration is strictly gated to production");
  assert.match(
    registerSrc,
    /process\.env\.NODE_ENV\s*!==\s*["']production["'][\s\S]*?return/,
    "ServiceWorkerRegister must return immediately when NODE_ENV is not production"
  );

  // 5. Load-timing & lifecycle safety
  console.log("✓ Test 5: Registration occurs post-load with proper listener cleanup");
  assert.match(
    registerSrc,
    /document\.readyState\s*===\s*["']complete["']/,
    "ServiceWorkerRegister must check document.readyState === 'complete'"
  );
  assert.match(
    registerSrc,
    /window\.addEventListener\(\s*["']load["']/,
    "ServiceWorkerRegister must attach load event listener when document is not yet complete"
  );
  assert.match(
    registerSrc,
    /window\.removeEventListener\(\s*["']load["']/,
    "ServiceWorkerRegister must clean up the load event listener in effect teardown"
  );

  // 6. Forbidden lifecycle actions in registration component
  console.log("✓ Test 6: Registration component contains zero aggressive activation or reload logic");
  assert.doesNotMatch(registerSrc, /skipWaiting\s*\(/i, "Registration must not invoke skipWaiting()");
  assert.doesNotMatch(registerSrc, /clients\.claim\s*\(/i, "Registration must not invoke clients.claim()");
  assert.doesNotMatch(registerSrc, /postMessage\s*\(/i, "Registration must not send postMessage to workers");
  assert.doesNotMatch(registerSrc, /controllerchange/i, "Registration must not listen for controllerchange");
  assert.doesNotMatch(registerSrc, /(?:window\.)?location\.reload\s*\(/i, "Registration must not trigger location.reload()");
  assert.doesNotMatch(registerSrc, /unregister\s*\(/i, "Registration must not call unregister()");
  assert.doesNotMatch(registerSrc, /setInterval\s*\(/i, "Registration must not set polling intervals");

  // 7. Root layout integration
  console.log("✓ Test 7: Root layout imports and mounts ServiceWorkerRegister as Server Component boundary");
  assert.doesNotMatch(
    layoutSrc,
    /^["']use client["']/m,
    "src/app/layout.tsx must remain a Server Component"
  );
  assert.match(
    layoutSrc,
    /import\s+ServiceWorkerRegister\s+from\s+["']@\/components\/pwa\/ServiceWorkerRegister["']/,
    "src/app/layout.tsx must import ServiceWorkerRegister"
  );
  assert.match(
    layoutSrc,
    /<ServiceWorkerRegister\s*\/>/,
    "src/app/layout.tsx must mount <ServiceWorkerRegister />"
  );

  // 8. Service worker forbidden constructs
  console.log("✓ Test 8: sw.js does not contain skipWaiting or clients.claim");
  assert.doesNotMatch(swSource, /skipWaiting\s*\(/i, "public/sw.js must not invoke skipWaiting()");
  assert.doesNotMatch(swSource, /clients\.claim\s*\(/i, "public/sw.js must not invoke clients.claim()");

  // 9. API safety boundary in sw.js
  console.log("✓ Test 9: sw.js enforces broad /api boundary");
  assert.match(
    swSource,
    /url\.pathname\s*===\s*["']\/api["']\s*\|\|\s*url\.pathname\.startsWith\(\s*["']\/api\/["']\s*\)/,
    "public/sw.js must explicitly bypass /api and /api/* routes"
  );

  // 10. Non-GET & cross-origin safety in sw.js
  console.log("✓ Test 10: sw.js excludes non-GET and cross-origin requests before any handling");
  assert.match(
    swSource,
    /request\.method\s*!==\s*["']GET["'][\s\S]*?return;/,
    "public/sw.js must immediately return on non-GET requests without calling respondWith"
  );
  assert.match(
    swSource,
    /url\.origin\s*!==\s*self\.location\.origin[\s\S]*?return;/,
    "public/sw.js must immediately return on cross-origin requests"
  );

  // 11. Next.js internal data & RSC safety in sw.js
  console.log("✓ Test 11: sw.js bypasses Next.js internal data and RSC requests");
  assert.match(swSource, /_next\/data/, "public/sw.js must exclude /_next/data/ requests");
  assert.match(swSource, /_rsc/, "public/sw.js must exclude _rsc query parameter requests");
  assert.match(swSource, /headers\.get\(\s*["']RSC["']\s*\)/, "public/sw.js must exclude requests with RSC header");

  // 12. Offline cache scope in sw.js
  console.log("✓ Test 12: sw.js only precaches /offline.html");
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

  // 13. Navigation behavior in sw.js
  console.log("✓ Test 13: sw.js navigation behavior is network-first with offline fallback only");
  assert.match(swSource, /request\.mode\s*===\s*["']navigate["']/, "public/sw.js must gate respondWith to navigation mode");
  assert.match(swSource, /fetch\(\s*request\s*\)\.catch/, "public/sw.js must attempt network fetch first for navigation");
  assert.doesNotMatch(swSource, /caches\.put|cache\.put/, "public/sw.js must not store navigation responses into CacheStorage");

  // 14. Sensitive-token scan in sw.js
  console.log("✓ Test 14: sw.js contains zero application-specific sensitive targets");
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
    assert.doesNotMatch(swSource, regex, `public/sw.js must not contain sensitive token: "${token}"`);
  }

  // 15. Header rule in next.config.ts
  console.log("✓ Test 15: next.config.ts contains exact /sw.js no-cache header rule");
  assert.match(nextConfigSrc, /source:\s*["']\/sw\.js["']/, "next.config.ts must define an exact source rule for /sw.js");
  assert.match(nextConfigSrc, /no-cache,\s*no-store,\s*must-revalidate/, "next.config.ts must configure Cache-Control: no-cache, no-store, must-revalidate for /sw.js");

  // 16. Offline HTML self-containment
  console.log("✓ Test 16: public/offline.html is static and self-contained");
  assert.doesNotMatch(offlineHtmlSource, /<script[^>]+src=/i, "public/offline.html must not load external scripts");
  assert.doesNotMatch(offlineHtmlSource, /<link[^>]+rel=["']stylesheet["']/i, "public/offline.html must not load external stylesheets");
  assert.match(offlineHtmlSource, /window\.location\.reload\(\)/, "public/offline.html must provide a reload button");
  assert.doesNotMatch(offlineHtmlSource, /localStorage|sessionStorage|indexedDB|fetch\s*\(|axios/i, "public/offline.html must not access application storage or invoke APIs");

  // 17. Manifest existence and JSON validity
  console.log("✓ Test 17: public/manifest.json exists and parses as valid JSON");
  assert.equal(existsSync(join(process.cwd(), "public/manifest.json")), true, "public/manifest.json must exist");
  const manifestRaw = readSource("public/manifest.json");
  let manifest: any;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (e) {
    assert.fail(`public/manifest.json must be valid JSON: ${e}`);
  }

  // 18. Manifest root identity & scope preservation
  console.log("✓ Test 18: manifest identity strictly matches root without tracking params");
  assert.equal(manifest.id, "/", "manifest.id must be strictly '/'");
  assert.equal(manifest.start_url, "/", "manifest.start_url must be strictly '/'");
  assert.equal(manifest.scope, "/", "manifest.scope must be strictly '/'");

  // 19. Required fields & display mode
  console.log("✓ Test 19: manifest required installability fields and categories");
  assert.equal(manifest.name, "GovStudyX", "manifest.name must be 'GovStudyX'");
  assert.equal(manifest.short_name, "GovStudyX", "manifest.short_name must be 'GovStudyX'");
  assert.equal(manifest.display, "standalone", "manifest.display must be 'standalone'");
  assert.equal(manifest.display_override, undefined, "manifest.display_override must not be set in PWA-2A");
  assert.deepEqual(manifest.categories, ["education"], "manifest.categories must be ['education']");
  assert.equal(manifest.lang, "en", "manifest.lang must be 'en'");

  // 20. Manifest icon compliance & maskable protection
  console.log("✓ Test 20: manifest contains required icon sizes without premature maskable marking");
  assert.ok(Array.isArray(manifest.icons), "manifest.icons must be an array");
  const sizes = manifest.icons.map((i: any) => i.sizes);
  assert.ok(sizes.includes("192x192"), "manifest.icons must include 192x192 icon");
  assert.ok(sizes.includes("512x512"), "manifest.icons must include 512x512 icon");
  assert.doesNotMatch(
    manifestRaw,
    /maskable/i,
    "manifest icons must NOT be marked maskable in PWA-2A until artwork safe-zones are verified"
  );

  // 21. Root layout platform metadata
  console.log("✓ Test 21: layout.tsx includes applicationName and appleWebApp metadata");
  assert.match(
    layoutSrc,
    /applicationName:\s*["']GovStudyX["']/,
    "src/app/layout.tsx must configure applicationName: 'GovStudyX'"
  );
  assert.match(
    layoutSrc,
    /appleWebApp:\s*\{[\s\S]*?capable:\s*true[\s\S]*?title:\s*["']GovStudyX["'][\s\S]*?statusBarStyle:\s*["']default["'][\s\S]*?\}/,
    "src/app/layout.tsx must configure appleWebApp with capable: true, title: 'GovStudyX', and statusBarStyle: 'default'"
  );

  console.log("\n✅ ALL 21 PWA-2A SAFETY, REGISTRATION & METADATA TESTS PASSED.");
}

runTests().catch((err) => {
  console.error("\n❌ PWA-2A Safety Test Failed:\n", err);
  process.exit(1);
});
