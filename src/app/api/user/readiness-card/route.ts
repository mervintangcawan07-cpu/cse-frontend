import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authenticatedUser.id;

    // 1. Fetch User Info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        isPaid: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Fetch User Streak
    const streak = await prisma.userStreak.findUnique({
      where: { userId },
    });

    // 3. Fetch Exam Results Summary
    const results = await prisma.examResult.findMany({
      where: { userId },
      select: {
        score: true,
        totalItems: true,
        correct: true,
        createdAt: true,
      },
    });

    const totalExams = results.length;
    const totalQuestionsSolved = results.reduce((sum, r) => sum + r.totalItems, 0);
    const totalCorrect = results.reduce((sum, r) => sum + r.correct, 0);

    const averageScore = totalExams > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / totalExams)
      : 0;

    // Pass Readiness Calculation (Weighted by average score and total practice)
    let passReadiness = 0;
    if (totalExams > 0) {
      const volumeBonus = Math.min(20, Math.floor(totalQuestionsSolved / 25)); // Up to 20 pts for practice volume
      passReadiness = Math.min(99, Math.round((averageScore * 0.8) + volumeBonus));
    }

    // Rank Tier Determination
    let rankTitle = "CSE Aspirant 🇵🇭";
    let badgeTier = "BRONZE";

    if (passReadiness >= 90) {
      rankTitle = "Topnotcher Candidate 🥇";
      badgeTier = "TOPNOTCHER";
    } else if (passReadiness >= 80) {
      rankTitle = "Certified CSC Eligible 🌟";
      badgeTier = "GOLD";
    } else if (passReadiness >= 65) {
      rankTitle = "Advanced Reviewee 📚";
      badgeTier = "SILVER";
    }

    return NextResponse.json({
      success: true,
      cardData: {
        userName: user.name || "CSE Reviewee",
        memberSince: new Date(user.createdAt).getFullYear(),
        currentStreak: streak?.currentStreak || 0,
        longestStreak: streak?.longestStreak || 0,
        totalExams,
        totalQuestionsSolved,
        totalCorrect,
        averageScore,
        passReadiness,
        rankTitle,
        badgeTier,
      },
    });
  } catch (error: any) {
    console.error("[READINESS_CARD_API_ERROR]", error);
    return NextResponse.json({ error: "Failed to load card metrics." }, { status: 500 });
  }
}
