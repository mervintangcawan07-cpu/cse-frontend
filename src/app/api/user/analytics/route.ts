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
    if (!session?.userId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Query exam results for this user from Neon DB
    const results = await prisma.examResult.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
    });

    const totalExams = results.length;
    const totalCorrect = results.reduce((sum, r) => sum + r.correct, 0);
    const totalItems = results.reduce((sum, r) => sum + r.totalItems, 0);

    const overallAccuracy = totalItems > 0 ? Math.round((totalCorrect / totalItems) * 100) : 0;
    const avgScore = totalExams > 0 ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / totalExams) : 0;
    const highestScore = totalExams > 0 ? Math.max(...results.map((r) => r.score)) : 0;
    const passedCount = results.filter((r) => r.score >= 80).length;
    const readinessIndex = totalExams > 0 ? Math.round((passedCount / totalExams) * 100) : 0;

    return NextResponse.json(
      {
        totalExams,
        overallAccuracy,
        avgScore,
        highestScore,
        readinessIndex,
        resultsHistory: results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Analytics API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}