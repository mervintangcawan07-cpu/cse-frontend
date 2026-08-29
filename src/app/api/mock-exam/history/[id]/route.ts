import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: attemptId } = await params;
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authenticatedUser.id;

    let attempt: any = null;

    // 1. Try finding in ExamResult model (JSON details snapshot format)
    try {
      const result = await prisma.examResult.findFirst({
        where: { id: attemptId, userId },
      });

      if (result) {
        let details = [];
        if ((result as any).detailsJson) {
          try {
            details = JSON.parse((result as any).detailsJson);
          } catch (pErr) {
            console.error("Failed to parse detailsJson:", pErr);
          }
        }

        attempt = {
          id: result.id,
          score: result.correct ?? result.score,
          totalItems: result.totalItems,
          percentage: Math.round(((result.correct ?? result.score) / result.totalItems) * 100),
          correct: result.correct,
          incorrect: result.incorrect,
          skipped: result.skipped,
          createdAt: result.createdAt,
          details,
        };
      }
    } catch (e) {
      // Ignore and check secondary model
    }

    // 2. Fallback to examAttempt relational structure if not found in ExamResult
    if (!attempt && (prisma as any).examAttempt) {
      attempt = await (prisma as any).examAttempt.findFirst({
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
    }

    if (!attempt) {
      return NextResponse.json(
        { error: "Exam review record not found or access denied." },
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
