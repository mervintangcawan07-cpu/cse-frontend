// Relative Path: src/components/pwa/ServiceWorkerRegister.tsx
"use client";

import { useEffect, useRef } from "react";

const PWA_UPDATE_EVENT = "govstudyx:pwa-update-available";
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every 1 hour

export default function ServiceWorkerRegister() {
  const hasDispatchedUpdateRef = useRef(false);

  useEffect(() => {
    // 1. Production gate
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    // 2. Feature detection
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | undefined;
    let cleanupListeners: (() => void) | null = null;

    const notifyUpdateAvailable = () => {
      if (hasDispatchedUpdateRef.current) return;
      hasDispatchedUpdateRef.current = true;

      try {
        window.dispatchEvent(new CustomEvent(PWA_UPDATE_EVENT));
      } catch {
        // Non-critical event dispatch failure
      }
    };

    const attachRegistrationWatchers = (registration: ServiceWorkerRegistration) => {
      // Case A: A worker is already waiting in the background
      if (registration.waiting) {
        notifyUpdateAvailable();
      }

      // Case B: A new worker begins installing
      const handleUpdateFound = () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        const handleStateChange = () => {
          if (
            installingWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            notifyUpdateAvailable();
          }
        };

        installingWorker.addEventListener("statechange", handleStateChange);
      };

      registration.addEventListener("updatefound", handleUpdateFound);

      // Periodic check for updates on long-running client sessions
      intervalId = setInterval(() => {
        registration.update().catch(() => {
          // Silent ignore background update check errors
        });
      }, UPDATE_CHECK_INTERVAL_MS);

      cleanupListeners = () => {
        registration.removeEventListener("updatefound", handleUpdateFound);
        if (intervalId) clearInterval(intervalId);
      };
    };

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
        .then((registration) => {
          attachRegistrationWatchers(registration);
        })
        .catch(() => {
          // Graceful silent degradation
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
      if (cleanupListeners) {
        cleanupListeners();
      }
    };
  }, []);

  return null;
}