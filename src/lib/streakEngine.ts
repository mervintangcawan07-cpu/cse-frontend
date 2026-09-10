// Relative Path: src/lib/streakEngine.ts
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

type StreakDbClient = PrismaClient | Prisma.TransactionClient;

export async function recordUserActivityStreak(
  userId: string,
  tx: StreakDbClient = prisma
) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingStreak = await tx.userStreak.findUnique({
      where: { userId },
    });

    if (!existingStreak) {
      // First activity recorded
      return await tx.userStreak.create({
        data: {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          lastActiveDate: new Date(),
        },
      });
    }

    const lastActive = new Date(existingStreak.lastActiveDate);
    lastActive.setHours(0, 0, 0, 0);

    const diffInMs = today.getTime() - lastActive.getTime();
    const diffInDays = Math.round(diffInMs / (1000 * 3600 * 24));

    if (diffInDays === 1) {
      // Activity on consecutive day -> increment streak
      const newCurrent = existingStreak.currentStreak + 1;
      const newLongest = Math.max(newCurrent, existingStreak.longestStreak);

      // Create a streak milestone notification if hitting key targets
      if ([3, 7, 14, 30, 60, 100].includes(newCurrent)) {
        await tx.notification.create({
          data: {
            userId,
            title: "🔥 Streak Milestone Reached!",
            message: `Awesome dedication! You have maintained a ${newCurrent}-day study streak on GovStudyX!`,
            type: "STREAK",
          },
        });
      }

      return await tx.userStreak.update({
        where: { userId },
        data: {
          currentStreak: newCurrent,
          longestStreak: newLongest,
          lastActiveDate: new Date(),
        },
      });
    } else if (diffInDays > 1) {
      // Streak broken -> reset to 1
      return await tx.userStreak.update({
        where: { userId },
        data: {
          currentStreak: 1,
          lastActiveDate: new Date(),
        },
      });
    }

    // Same-day activity -> keep current streak
    return existingStreak;
  } catch (error) {
    console.error("Error recording user streak:", error);

    // If running within an explicit interactive transaction (e.g. ENTITLEMENT-1E3B exam submission),
    // propagate the failure so the surrounding prisma.$transaction rolls back atomically.
    // Ordinary legacy callers using the default global prisma client retain previous best-effort null return.
    if (tx !== prisma) {
      throw error;
    }

    return null;
  }
}