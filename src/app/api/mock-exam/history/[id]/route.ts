import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: attemptId } = await params;
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

    // 1. Fetch specific exam attempt belonging to the user
    const attempt = await (prisma as any).examAttempt.findFirst({
      where: {
        id: attemptId,
        userId: userId,
      },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Exam review record not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, attempt });
  } catch (error: any) {
    console.error("[EXAM_REVIEW_FETCH_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to load exam review history.", details: error?.message },
      { status: 500 }
    );
  }
}