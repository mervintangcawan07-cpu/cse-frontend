import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyJWT } from "@/lib/auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (session?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    // Parallel execution for high performance database queries
    const [
      totalUsers,
      paidUsers,
      totalQuestions,
      totalReadingMaterials,
      allResults,
      recentUsers,
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
        select: { id: true, email: true, name: true, isPaid: true, createdAt: true },
      }),
    ]);

    const totalExamsTaken = allResults.length;
    const estimatedRevenue = paidUsers * 499; // ₱499 per PRO member
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