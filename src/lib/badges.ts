// Relative Path: src/lib/badges.ts
import { prisma } from "@/lib/prisma";

export interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  description: string;
  category: "exam" | "streak" | "social" | "mastery" | "engagement";
  rarity: "common" | "rare" | "epic" | "legendary";
}

export const BADGE_CATALOGUE: BadgeDef[] = [
  // Exam Milestones
  { id: "FIRST_BLOOD", emoji: "🎯", name: "First Blood", description: "Complete your very first practice exam.", category: "exam", rarity: "common" },
  { id: "HALFWAY_THERE", emoji: "📊", name: "Halfway There", description: "Score 50% or higher in any practice exam.", category: "exam", rarity: "common" },
  { id: "SPEED_DEMON", emoji: "⚡", name: "Speed Demon", description: "Score 80% or higher in any practice exam.", category: "exam", rarity: "rare" },
  { id: "TOPNOTCHER", emoji: "🏆", name: "CSE Topnotcher", description: "Score 90% or higher in any practice exam.", category: "exam", rarity: "epic" },
  { id: "PERFECT_SCORE", emoji: "💎", name: "Perfect Score", description: "Achieve 100% in any practice exam.", category: "exam", rarity: "legendary" },
  { id: "FULLY_DRILLED", emoji: "🎓", name: "Fully Drilled", description: "Complete 5 practice exams total.", category: "exam", rarity: "common" },
  { id: "KNOWLEDGE_SEEKER", emoji: "📚", name: "Knowledge Seeker", description: "Complete 20 practice exams total.", category: "exam", rarity: "rare" },
  { id: "EXAM_VETERAN", emoji: "🧠", name: "Exam Veteran", description: "Complete 50 practice exams total.", category: "exam", rarity: "epic" },
  // Streak Milestones
  { id: "ON_FIRE", emoji: "🔥", name: "On Fire", description: "Maintain a 3-day active study streak.", category: "streak", rarity: "common" },
  { id: "WEEK_WARRIOR", emoji: "🌟", name: "Week Warrior", description: "Maintain a 7-day active study streak.", category: "streak", rarity: "rare" },
  { id: "UNSTOPPABLE", emoji: "🔮", name: "Unstoppable", description: "Maintain a 30-day active study streak.", category: "streak", rarity: "legendary" },
  // Mastery & Study
  { id: "ERROR_HUNTER", emoji: "📕", name: "Error Hunter", description: "Get your first item added to the Mistake Notebook.", category: "mastery", rarity: "common" },
  { id: "MISTAKE_MASTER", emoji: "✨", name: "Mistake Master", description: "Master 10 mistakes in the Balik-Aral notebook.", category: "mastery", rarity: "rare" },
  // Engagement
  { id: "DAILY_CHAMPION", emoji: "☀️", name: "Daily Champion", description: "Answer the Question of the Day correctly.", category: "engagement", rarity: "common" },
  { id: "QUIZ_ARCHITECT", emoji: "🎛️", name: "Quiz Architect", description: "Launch your first Custom Practice Quiz.", category: "engagement", rarity: "common" },
  { id: "QUALITY_GUARDIAN", emoji: "🚩", name: "Quality Guardian", description: "Submit your first question issue flag.", category: "engagement", rarity: "common" },
  // Social
  { id: "SOCIAL_BUTTERFLY", emoji: "👥", name: "Social Butterfly", description: "Send your first classmate connection request.", category: "social", rarity: "common" },
  { id: "TEAM_PLAYER", emoji: "🤝", name: "Team Player", description: "Join a Study Room with other examinees.", category: "social", rarity: "common" },
];

export const BADGE_MAP = new Map<string, BadgeDef>(BADGE_CATALOGUE.map((b) => [b.id, b]));

async function awardBadge(userId: string, badgeId: string): Promise<boolean> {
  try {
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId } },
      create: { userId, badgeId },
      update: {},
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Evaluate and award all applicable badges for a user.
 * This is safe to call multiple times — upsert prevents duplicates.
 */
export async function evaluateAndAwardBadges(userId: string): Promise<string[]> {
  const newlyAwarded: string[] = [];

  try {
    // Load all relevant data in parallel
    const [
      examResults,
      streakData,
      mistakeStats,
      dailyAttempts,
      questionFlags,
      classmateRequests,
      existingBadges,
    ] = await Promise.all([
      prisma.examResult.findMany({
        where: { userId },
        select: { score: true, totalItems: true, correct: true },
      }),
      prisma.userStreak.findUnique({
        where: { userId },
        select: { currentStreak: true },
      }).catch(() => null),
      prisma.userMistake.aggregate({ where: { userId }, _count: { id: true } }),
      prisma.dailyQuestionAttempt.findMany({
        where: { userId, isCorrect: true },
        select: { id: true },
        take: 1,
      }),
      prisma.questionFlag.findMany({
        where: { userId },
        select: { id: true },
        take: 1,
      }),
      prisma.classmateRelation.findMany({
        where: { senderId: userId },
        select: { id: true },
        take: 1,
      }),
      prisma.userBadge.findMany({
        where: { userId },
        select: { badgeId: true },
      }),
    ]);

    const earned = new Set(existingBadges.map((b: { badgeId: string }) => b.badgeId));
    const award = async (badgeId: string) => {
      if (!earned.has(badgeId)) {
        await awardBadge(userId, badgeId);
        newlyAwarded.push(badgeId);
        earned.add(badgeId);
      }
    };

    // --- Exam badges ---
    const totalExams = examResults.length;
    if (totalExams >= 1) await award("FIRST_BLOOD");
    if (totalExams >= 5) await award("FULLY_DRILLED");
    if (totalExams >= 20) await award("KNOWLEDGE_SEEKER");
    if (totalExams >= 50) await award("EXAM_VETERAN");

    const bestScore = examResults.reduce(
      (best: number, r: { score: number; totalItems: number; correct: number }) => {
        const pct = r.totalItems > 0 ? Math.round((r.correct / r.totalItems) * 100) : 0;
        return Math.max(best, pct);
      },
      0
    );

    if (bestScore >= 50) await award("HALFWAY_THERE");
    if (bestScore >= 80) await award("SPEED_DEMON");
    if (bestScore >= 90) await award("TOPNOTCHER");
    if (bestScore === 100) await award("PERFECT_SCORE");

    // --- Streak badges ---
    const currentStreak = streakData?.currentStreak ?? 0;
    if (currentStreak >= 3) await award("ON_FIRE");
    if (currentStreak >= 7) await award("WEEK_WARRIOR");
    if (currentStreak >= 30) await award("UNSTOPPABLE");

    // --- Mastery badges ---
    const mistakeCount = mistakeStats._count.id;
    if (mistakeCount >= 1) await award("ERROR_HUNTER");

    const masteredCount = await prisma.userMistake.count({ where: { userId, isMastered: true } });
    if (masteredCount >= 10) await award("MISTAKE_MASTER");

    // --- Engagement badges ---
    if (dailyAttempts.length >= 1) await award("DAILY_CHAMPION");
    if (questionFlags.length >= 1) await award("QUALITY_GUARDIAN");

    // --- Social badges ---
    if (classmateRequests.length >= 1) await award("SOCIAL_BUTTERFLY");

    // Room participation: check via study room participants if model exists
    try {
      const roomCount = await (prisma as unknown as Record<string, { count: (args: { where: { userId: string } }) => Promise<number> }>)
        .studyRoomParticipant?.count({ where: { userId } });
      if (roomCount && roomCount >= 1) await award("TEAM_PLAYER");
    } catch {
      // Model may not exist; skip silently
    }
  } catch (err) {
    console.error("[BADGE_ENGINE_ERROR]", err);
  }

  return newlyAwarded;
}
