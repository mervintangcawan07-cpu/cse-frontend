// Relative Path: src/lib/offline-storage.ts
// Client-side only — all access is guarded by typeof window checks.

import { get, set } from "idb-keyval";

const OFFLINE_DRILLS_KEY = "offline_drills";
const PENDING_SUBMISSIONS_KEY = "pending_submissions";

// ─────────────────────────────────────────────────────
// OFFLINE DRILL STORAGE
// ─────────────────────────────────────────────────────

export interface OfflineDrillSet {
  drillId: string;
  label: string;
  savedAt: number;
  questions: any[];
}

/**
 * Saves a drill question set to IndexedDB for offline access.
 * Safe to call only in browser environments.
 */
export async function saveDrillOffline(drillId: string, drillData: Omit<OfflineDrillSet, "drillId" | "savedAt">): Promise<void> {
  if (typeof window === "undefined") return;
  const existing = await getOfflineDrillsMap();
  existing[drillId] = { drillId, savedAt: Date.now(), ...drillData };
  await set(OFFLINE_DRILLS_KEY, existing);
}

/**
 * Returns all locally cached drill sets as an array.
 */
export async function getOfflineDrills(): Promise<OfflineDrillSet[]> {
  if (typeof window === "undefined") return [];
  const map = await getOfflineDrillsMap();
  return Object.values(map);
}

/**
 * Returns a single locally cached drill set by ID, or null if not found.
 */
export async function getOfflineDrillById(drillId: string): Promise<OfflineDrillSet | null> {
  if (typeof window === "undefined") return null;
  const map = await getOfflineDrillsMap();
  return map[drillId] ?? null;
}

/**
 * Deletes a specific locally cached drill set.
 */
export async function removeOfflineDrill(drillId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const map = await getOfflineDrillsMap();
  delete map[drillId];
  await set(OFFLINE_DRILLS_KEY, map);
}

async function getOfflineDrillsMap(): Promise<Record<string, OfflineDrillSet>> {
  const val = await get<Record<string, OfflineDrillSet>>(OFFLINE_DRILLS_KEY);
  return val ?? {};
}

// ─────────────────────────────────────────────────────
// OFFLINE SUBMISSION QUEUE
// ─────────────────────────────────────────────────────

export interface PendingSubmission {
  submissionId: string;
  queuedAt: number;
  payload: {
    totalItems: number;
    answers: Array<{
      questionId: string;
      selectedIndex: number;
      selectedOption: string;
    }>;
  };
}

/**
 * Appends a completed exam/drill attempt to the pending submissions queue in IndexedDB.
 * Records are retained until a confirmed successful server response is received.
 */
export async function queueOfflineSubmission(submissionPayload: PendingSubmission["payload"]): Promise<void> {
  if (typeof window === "undefined") return;
  const existing = await getPendingSubmissions();
  const newEntry: PendingSubmission = {
    submissionId: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    queuedAt: Date.now(),
    payload: submissionPayload,
  };
  await set(PENDING_SUBMISSIONS_KEY, [...existing, newEntry]);
}

/**
 * Returns all pending submissions from IndexedDB.
 */
export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  if (typeof window === "undefined") return [];
  const val = await get<PendingSubmission[]>(PENDING_SUBMISSIONS_KEY);
  return val ?? [];
}

/**
 * Attempts to sync all pending submissions to the server sequentially.
 *
 * Fail-Safe: If a submission fails (network error or server 500), it is NOT
 * removed from the queue and will be retried on the next sync attempt.
 * Only confirmed successes (HTTP 200/201) are removed.
 *
 * Returns the number of successfully synced submissions.
 */
export async function syncPendingSubmissions(): Promise<number> {
  if (typeof window === "undefined") return 0;

  const pending = await getPendingSubmissions();
  if (pending.length === 0) return 0;

  let successCount = 0;
  const remaining: PendingSubmission[] = [];

  for (const submission of pending) {
    try {
      const res = await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission.payload),
      });

      if (res.ok) {
        // Confirmed success — remove from queue
        successCount++;
      } else {
        // Server error (4xx/5xx) — retain for retry
        console.warn(
          `[OFFLINE_SYNC] Server rejected submission ${submission.submissionId} (status ${res.status}). Retaining in queue.`
        );
        remaining.push(submission);
      }
    } catch (err) {
      // Network error — retain for retry
      console.warn(
        `[OFFLINE_SYNC] Network error syncing submission ${submission.submissionId}. Retaining in queue.`,
        err
      );
      remaining.push(submission);
    }
  }

  // Persist the updated queue (only failed/pending items remain)
  await set(PENDING_SUBMISSIONS_KEY, remaining);
  return successCount;
}
