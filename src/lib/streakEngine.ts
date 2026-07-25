import { prisma } from "@/lib/prisma";

export async function recordUserActivityStreak(userId: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingStreak = await prisma.userStreak.findUnique({
      where: { userId },
    });

    if (!existingStreak) {
      // First activity recorded
      return await prisma.userStreak.create({
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
        await prisma.notification.create({
          data: {
            userId,
            title: "🔥 Streak Milestone Reached!",
            message: `Awesome dedication! You have maintained a ${newCurrent}-day study streak on CSE Reviewer!`,
            type: "STREAK",
          },
        });
      }

      return await prisma.userStreak.update({
        where: { userId },
        data: {
          currentStreak: newCurrent,
          longestStreak: newLongest,
          lastActiveDate: new Date(),
        },
      });
    } else if (diffInDays > 1) {
      // Streak broken -> reset to 1
      return await prisma.userStreak.update({
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
    return null;
  }
}