"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPendingSubmissions, syncPendingSubmissions } from "@/lib/offline-storage";

export interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncNow: () => Promise<void>;
}

/**
 * Monitors network connectivity and automatically syncs pending offline
 * submissions when the device reconnects. Exposes sync state for UI indicators.
 *
 * Safe to use in client components only.
 */
export function useOfflineSync(): OfflineSyncState {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof window !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const syncingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshPendingCount = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const pending = await getPendingSubmissions();
      if (isMountedRef.current) {
        setPendingCount(pending.length);
      }
    } catch {
      // Silently fail — IndexedDB may be unavailable in some environments
    }
  }, []);

  const runSync = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (syncingRef.current) return;
    if (!navigator.onLine) return;

    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const synced = await syncPendingSubmissions();
      if (synced > 0) {
        console.info(`[OFFLINE_SYNC] Successfully synced ${synced} pending submission(s).`);
      }
      if (isMountedRef.current) {
        setLastSyncTime(Date.now());
      }
      await refreshPendingCount();
    } catch (err: unknown) {
      console.warn("[OFFLINE_SYNC] Sync attempt encountered an error:", err);
    } finally {
      syncingRef.current = false;
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [refreshPendingCount]);

  // Listen to online/offline network events and trigger sync on reconnection
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      void runSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Defer initial pending count retrieval out of the synchronous effect body
    const initialTimer = setTimeout(() => {
      void refreshPendingCount();
    }, 0);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearTimeout(initialTimer);
    };
  }, [runSync, refreshPendingCount]);

  // Periodically refresh pending count to stay in sync with IndexedDB changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = setInterval(() => {
      void refreshPendingCount();
    }, 10_000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    syncNow: runSync,
  };
}