import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [totalUsers, paidUsers, totalQuestions, totalExams] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.user.count({ where: { isPaid: true } }).catch(() => 0),
      prisma.question.count({ where: { deletedAt: null } }).catch(() => 0),
      prisma.examResult.count().catch(() => 0),
    ]);

    return NextResponse.json({ totalUsers, paidUsers, totalQuestions, totalExams });
  } catch (error) {
    return NextResponse.json(
      { totalUsers: 0, paidUsers: 0, totalQuestions: 0, totalExams: 0 },
      { status: 200 }
    );
  }
}
