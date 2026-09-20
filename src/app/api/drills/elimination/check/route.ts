// Relative Path: src/app/api/drills/elimination/check/route.ts
import { NextResponse } from "next/server";
import { requireProAuth } from "@/lib/serverAuth";
import { CACHE_PROFILES } from "@/lib/cache";
import { verifyDrillSessionToken } from "@/lib/drillSessionToken";
import { andQuestionWhere, findBankQuestions, questionIdsWhere } from "@/lib/questionBank";
import { activeEliminationQuestionWhere } from "@/lib/contentEligibility";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireProAuth(request);
    if (errorResponse || !user) {
      if (errorResponse) {
        const data = await errorResponse.json();
        return NextResponse.json(data, {
          status: errorResponse.status,
          headers: CACHE_PROFILES.PRIVATE,
        });
      }
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    const { drillSessionToken, questionId, eliminatedIndices } = body;

    // 1. Validate session token and bind to authenticated user
    if (!drillSessionToken || typeof drillSessionToken !== "string") {
      return NextResponse.json(
        { error: "Drill session token is required." },
        { status: 401, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    const tokenVerification = await verifyDrillSessionToken(drillSessionToken, user.id);
    if (!tokenVerification.valid) {
      const status = tokenVerification.reason === "EXPIRED" ? 401 : 403;
      return NextResponse.json(
        { error: `Invalid or expired drill session token (${tokenVerification.reason}).` },
        { status, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    // 2. Oracle Protection: Verify questionId belongs to issued session questions
    if (!questionId || typeof questionId !== "string" || !questionId.trim()) {
      return NextResponse.json(
        { error: "Question ID is required." },
        { status: 400, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    const trimmedQuestionId = questionId.trim();
    if (!tokenVerification.claims.questionIds.includes(trimmedQuestionId)) {
      return NextResponse.json(
        { error: "Access denied: Question does not belong to the active drill session." },
        { status: 403, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    // 3. Validate eliminatedIndices
    if (!Array.isArray(eliminatedIndices)) {
      return NextResponse.json(
        { error: "eliminatedIndices must be an array." },
        { status: 400, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    const seenIndices = new Set<number>();
    for (const idx of eliminatedIndices) {
      if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0) {
        return NextResponse.json(
          { error: "eliminatedIndices must contain non-negative integers only." },
          { status: 400, headers: CACHE_PROFILES.PRIVATE }
        );
      }
      if (seenIndices.has(idx)) {
        return NextResponse.json(
          { error: "Duplicate indices are not permitted." },
          { status: 400, headers: CACHE_PROFILES.PRIVATE }
        );
      }
      seenIndices.add(idx);
    }

    // 4. Fetch authoritative question record from database
    const [question] = await findBankQuestions({
      where: andQuestionWhere(
        activeEliminationQuestionWhere(),
        questionIdsWhere([trimmedQuestionId])
      ),
      select: {
        id: true,
        options: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        answerIndex: true,
        explanation: true,
        stepByStep: true,
        whyA: true,
        whyB: true,
        whyC: true,
        whyD: true,
        eliminationStrategy: true,
        commonTrap: true,
      },
      take: 1,
    });

    if (!question) {
      return NextResponse.json(
        { error: "Active question not found." },
        { status: 404, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    const resolvedOptions =
      Array.isArray(question.options) && question.options.length > 0
        ? question.options
        : [question.optionA, question.optionB, question.optionC, question.optionD].filter(Boolean);

    for (const idx of eliminatedIndices) {
      if (idx >= resolvedOptions.length) {
        return NextResponse.json(
          { error: `Index ${idx} exceeds option range for this question.` },
          { status: 400, headers: CACHE_PROFILES.PRIVATE }
        );
      }
    }

    // 5. Server-Authoritative Evaluation
    const struckCorrect = eliminatedIndices.includes(question.answerIndex);

    return NextResponse.json(
      {
        success: true,
        struckCorrect,
        correctAnswerIndex: question.answerIndex,
        explanation: question.explanation || null,
        eliminationStrategy: question.eliminationStrategy || null,
        stepByStep: question.stepByStep || null,
        whyA: question.whyA || null,
        whyB: question.whyB || null,
        whyC: question.whyC || null,
        whyD: question.whyD || null,
        commonTrap: question.commonTrap || null,
      },
      { headers: CACHE_PROFILES.PRIVATE }
    );
  } catch (error: unknown) {
    console.error("[ELIMINATION_DRILL_CHECK_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to evaluate elimination drill answer." },
      { status: 500, headers: CACHE_PROFILES.PRIVATE }
    );
  }
}

