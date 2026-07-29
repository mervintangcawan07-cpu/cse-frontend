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

    const attempts = await (prisma as any).examAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        score: true,
        totalItems: true,
        percentage: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, attempts });
  } catch (error: any) {
    console.error("[EXAM_HISTORY_FETCH_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch exam history.", details: error?.message },
      { status: 500 }
    );
  }
}