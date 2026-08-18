import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = String(session.userId);

    // Fetch user results, streak, and bookmarks concurrently (excluding heavy detailsJson)
    const [results, streakData, bookmarksCount] = await Promise.all([
      prisma.examResult.findMany({
        where: { userId },
        select: {
          id: true,
          score: true,
          correct: true,
          totalItems: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userStreak.findUnique({
        where: { userId },
      }),
      prisma.bookmark.count({
        where: { userId },
      }),
    ]);

    const totalExams = results.length;

    if (totalExams === 0) {
      return NextResponse.json({
        totalExams: 0,
        averageScore: 0,
        passReadinessScore: 0,
        currentStreak: streakData?.currentStreak || 0,
        longestStreak: streakData?.longestStreak || 0,
        totalBookmarks: bookmarksCount,
        recentHistory: [],
        recommendation: "Take your first practice exam to unlock personalized analytics!",
      });
    }

    // Calculate overall average score
    const totalScoreSum = results.reduce((acc, curr) => acc + curr.score, 0);
    const averageScore = Math.round(totalScoreSum / totalExams);

    // Pass Readiness Probability (weighted benchmark against 80% passing mark)
    const recentFive = results.slice(0, 5);
    const recentAvg = Math.round(recentFive.reduce((acc, curr) => acc + curr.score, 0) / recentFive.length);
    const passReadinessScore = Math.min(100, Math.round(recentAvg * 0.9 + (streakData?.currentStreak || 0) * 2));

    let recommendation = "Maintain your current pace to reach benchmark readiness!";
    if (averageScore < 75) {
      recommendation = "Focus on 10-Second Option Elimination Drills to improve accuracy under time pressure.";
    } else if (averageScore >= 80) {
      recommendation = "Great performance! Keep reviewing official handbooks with Fast-Scanning to solidify your standing.";
    }

    return NextResponse.json({
      totalExams,
      averageScore,
      passReadinessScore,
      currentStreak: streakData?.currentStreak || 0,
      longestStreak: streakData?.longestStreak || 0,
      totalBookmarks: bookmarksCount,
      recentHistory: recentFive.map((r) => ({
        id: r.id,
        score: r.score,
        correct: r.correct,
        totalItems: r.totalItems,
        date: r.createdAt,
      })),
      recommendation,
    });
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    return NextResponse.json({ error: "Failed to compute analytics" }, { status: 500 });
  }
}