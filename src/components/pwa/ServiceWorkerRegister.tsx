// Relative Path: src/components/pwa/ServiceWorkerRegister.tsx
"use client";

import { useEffect, useRef } from "react";

/**
 * Controlled Service Worker Registration Component (PWA-1B)
 *
 * Requirements:
 * - Production-only execution
 * - Registered after window load (or immediately if hydration completes post-load)
 * - Exact root scope ("/") and updateViaCache: "none"
 * - Detection of waiting/new workers without forcing activation or page reloads
 * - Zero visible UI, silent graceful failure
 */
export default function ServiceWorkerRegister() {
  const hasDispatchedUpdateRef = useRef(false);

  useEffect(() => {
    // 1. Production gate: Never register service worker in development or test
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    // 2. Browser feature support guard
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const notifyUpdateAvailable = () => {
      if (hasDispatchedUpdateRef.current) return;
      hasDispatchedUpdateRef.current = true;
      try {
        window.dispatchEvent(
          new CustomEvent("govstudyx:pwa-update-available")
        );
      } catch {
        // Non-critical event dispatch
      }
    };

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
        .then((registration) => {
          // A. Update already waiting
          if (registration.waiting) {
            notifyUpdateAvailable();
          }

          // B. New update discovered
          registration.addEventListener("updatefound", () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;

            installingWorker.addEventListener("statechange", () => {
              if (
                installingWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                notifyUpdateAvailable();
              }
            });
          });
        })
        .catch(() => {
          // Registration failure must not break GovStudyX. Silent graceful degradation.
        });
    };

    // 3. Register only after page load to preserve critical startup performance
    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }

    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  return null;
}
