// Relative Path: src/app/api/drills/route.ts
import { NextResponse } from "next/server";
import { findBankQuestions } from "@/lib/questionBank";
import { activeEliminationQuestionWhere } from "@/lib/contentEligibility";
import { cachedJsonResponse, CACHE_PROFILES } from "@/lib/cache";
import { requireProAuth } from "@/lib/serverAuth";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireProAuth(request);
    if (errorResponse) {
      const data = await errorResponse.json();
      return NextResponse.json(data, {
        status: errorResponse.status,
        headers: CACHE_PROFILES.PRIVATE,
      });
    }

    const drillQuestions = await findBankQuestions({
      where: activeEliminationQuestionWhere(),
      orderBy: { createdAt: "desc" },
    });

    return cachedJsonResponse(
      {
        success: true,
        drills: drillQuestions,
        count: drillQuestions.length,
      },
      "PRIVATE"
    );
  } catch (error: unknown) {
    console.error("[STUDENT_DRILLS_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch elimination drills" },
      { status: 500, headers: CACHE_PROFILES.PRIVATE }
    );
  }
}
