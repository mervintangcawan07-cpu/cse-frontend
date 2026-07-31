import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const filter = searchParams.get("filter") || "ALL";

    const whereCondition: any = {};

    if (filter === "FAILED") whereCondition.status = "FAILED";
    if (filter === "SUCCESS") whereCondition.status = "SUCCESS";

    if (query.trim()) {
      whereCondition.OR = [
        { email: { contains: query, mode: "insensitive" } },
        { ipAddress: { contains: query, mode: "insensitive" } },
        { reason: { contains: query, mode: "insensitive" } },
      ];
    }

    const history = await prisma.loginHistory.findMany({
      where: whereCondition,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const totalFailedAttempts = await prisma.loginHistory.count({
      where: { status: "FAILED" },
    });

    return NextResponse.json({ history, totalFailedAttempts });
  } catch (error) {
    console.error("[LOGIN_HISTORY_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch login history" }, { status: 500 });
  }
}