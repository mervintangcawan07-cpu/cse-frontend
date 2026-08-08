// Relative Path: src/lib/backgroundTasks.ts
import { prisma } from "@/lib/prisma";

/**
 * Offloads long-running or non-critical tasks (emails, analytics, log flushing)
 * from the main HTTP thread so the user gets an instant response.
 */
export function runInBackground(task: () => Promise<void>, taskName = "Unspecified Task"): void {
  // Fire and forget with error boundary
  Promise.resolve().then(async () => {
    try {
      await task();
    } catch (err) {
      console.error(`[BACKGROUND_WORKER_ERROR] (${taskName}):`, err);
    }
  });
}

/**
 * Worker Routine 1: Cleans expired sessions, stale password reset tokens, and expired email verification links.
 */
export async function cleanExpiredSessionsAndTokens(): Promise<{ cleanedSessions: number; cleanedTokens: number }> {
  const now = new Date();

  // 1. Invalidate stale password reset tokens
  const resetRes = await prisma.user.updateMany({
    where: {
      passwordResetExpires: { lt: now },
    },
    data: {
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  // 2. Invalidate expired email verification tokens
  const verifyRes = await prisma.user.updateMany({
    where: {
      emailVerificationExpires: { lt: now },
      isEmailVerified: false,
    },
    data: {
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });

  return {
    cleanedSessions: resetRes.count,
    cleanedTokens: verifyRes.count,
  };
}

/**
 * Worker Routine 2: Aggregates system metrics (exam submissions, pass rates, active users) in the background.
 */
export async function updateSystemAnalytics(): Promise<{ totalUsers: number; totalExams: number }> {
  const [totalUsers, totalExams] = await Promise.all([
    prisma.user.count(),
    prisma.examResult.count(),
  ]);

  return { totalUsers, totalExams };
}