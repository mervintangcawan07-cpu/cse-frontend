import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/serverAuth";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    // Parallel database queries
    const [
      totalUsers,
      paidUsers,
      totalQuestions,
      totalReadingMaterials,
      allResults,
      recentUsers,
      paidTransactions,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "USER" } }),
      prisma.user.count({ where: { role: "USER", isPaid: true } }),
      prisma.question.count(),
      prisma.readingMaterial.count(),
      prisma.examResult.findMany({ select: { score: true, createdAt: true } }),
      prisma.user.findMany({
        where: { role: "USER" },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, name: true, isPaid: true, createdAt: true, planType: true, paidUntil: true },
      }),
      prisma.transaction.findMany({
        where: { status: "PAID" },
        select: { amount: true, planType: true },
      }),
    ]);

    // Calculate detailed revenue from transactions
    let totalRevenue = 0;
    let monthlyRevenue = 0;
    let sixMonthRevenue = 0;
    let lifetimeRevenue = 0;

    paidTransactions.forEach((tx) => {
      totalRevenue += tx.amount;
      if (tx.planType === "1_MONTH") monthlyRevenue += tx.amount;
      else if (tx.planType === "6_MONTHS") sixMonthRevenue += tx.amount;
      else if (tx.planType === "LIFETIME") lifetimeRevenue += tx.amount;
    });

    const totalExamsTaken = allResults.length;
    const estimatedRevenue = totalRevenue > 0 ? totalRevenue : paidUsers * 499;
    const passingExams = allResults.filter((r) => r.score >= 80).length;
    const overallPassRate = totalExamsTaken > 0 ? Math.round((passingExams / totalExamsTaken) * 100) : 0;
    const platformAverageScore =
      totalExamsTaken > 0
        ? Math.round(allResults.reduce((acc, r) => acc + r.score, 0) / totalExamsTaken)
        : 0;

    return NextResponse.json(
      {
        totalUsers,
        paidUsers,
        unpaidUsers: totalUsers - paidUsers,
        estimatedRevenue,
        revenueBreakdown: {
          totalRevenue: estimatedRevenue,
          monthlyRevenue,
          sixMonthRevenue,
          lifetimeRevenue,
          totalTransactions: paidTransactions.length,
        },
        totalQuestions,
        totalReadingMaterials,
        totalExamsTaken,
        overallPassRate,
        platformAverageScore,
        recentUsers,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin Analytics API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}