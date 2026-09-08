// Relative Path: public/sw.js
// GovStudyX PWA Service Worker — Inert Safety Foundation (PWA-1A)
// Default: DO NOTHING. Fail-open to network for all non-navigation traffic.

const OFFLINE_CACHE = "govstudyx-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName.startsWith("govstudyx-offline-") &&
              cacheName !== OFFLINE_CACHE
          )
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 1. NON-GET: Always ignore and leave to standard browser/network handling
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // 2. Cross-origin: Never intercept external requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. API Boundary: Never intercept or cache any API route
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return;
  }

  // 4. Next.js Internal Data & RSC Safety: Never intercept or cache RSC/router payloads
  if (
    url.pathname.startsWith("/_next/data/") ||
    url.searchParams.has("_rsc") ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-State-Tree") ||
    request.headers.get("Next-Router-Prefetch")
  ) {
    return;
  }

  // 5. Navigation: Only HTML document navigation failures receive the generic offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(OFFLINE_CACHE).then((cache) => cache.match(OFFLINE_URL))
      )
    );
    return;
  }

  // 6. All other requests: DO NOTHING. Standard browser/HTTP caching applies.
});
