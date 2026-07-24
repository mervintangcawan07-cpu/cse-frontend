import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminUser = await prisma.user.findUnique({
      where: { id: String(session.userId) },
      select: { role: true },
    });

    if (adminUser?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch counts across database models
    const [totalUsers, paidUsers, totalQuestions, totalNotes, totalHandbooks] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isPaid: true } }),
      prisma.question.count(),
      prisma.studyNote.count(),
      prisma.handbook.count(),
    ]);

    // Calculate estimated total revenue based on PRO access price (₱299)
    const totalRevenue = paidUsers * 299;

    return NextResponse.json({
      totalUsers,
      paidUsers,
      totalRevenue,
      totalQuestions,
      totalNotes,
      totalHandbooks,
    });
  } catch (error) {
    console.error("[ADMIN_STATS_ERROR]", error);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}