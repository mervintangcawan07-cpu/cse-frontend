// Relative Path: src/app/api/exam/guided-review/check/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { CACHE_PROFILES } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import {
  GUIDED_CHECK_LIMITER,
  checkRateLimit,
  createRateLimitResponse,
} from "@/lib/ratelimit";
import { verifyGuidedReviewToken } from "@/lib/guidedReviewToken";

interface GuidedCheckRequestBody {
  guidedReviewToken?: unknown;
  questionId?: unknown;
  selectedIndex?: unknown;
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    const userId = authenticatedUser.id;

    // 2. Per-user burst rate limit (120 req / 1 min)
    const rateLimitKey = `guided_check:${userId}`;
    const rateResult = await checkRateLimit(GUIDED_CHECK_LIMITER, rateLimitKey);
    if (!rateResult.success) {
      return createRateLimitResponse(
        rateResult,
        "Too many check requests. Please wait a moment."
      );
    }

    // 3. Parse JSON request body
    let body: GuidedCheckRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    const { guidedReviewToken, questionId, selectedIndex } = body;

    // 4. Validate payload types and bounds
    if (
      typeof guidedReviewToken !== "string" ||
      !guidedReviewToken.trim() ||
      typeof questionId !== "string" ||
      !questionId.trim() ||
      typeof selectedIndex !== "number" ||
      !Number.isInteger(selectedIndex) ||
      selectedIndex < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid request payload: guidedReviewToken, questionId, and selectedIndex (integer >= 0) are required.",
          code: "INVALID_PAYLOAD",
        },
        { status: 400, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    // 5. Cryptographically verify Guided Review token
    const verified = await verifyGuidedReviewToken(guidedReviewToken.trim());
    if (!verified) {
      return NextResponse.json(
        {
          error: "Invalid or expired guided review token",
          code: "INVALID_GUIDED_TOKEN",
        },
        { status: 400, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    // 6. User binding verification
    if (verified.userId !== userId) {
      return NextResponse.json(
        {
          error: "Guided review token does not match authenticated user",
          code: "GUIDED_USER_MISMATCH",
        },
        { status: 403, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    // 7. Verify questionId belongs to the signed questionIds manifest
    if (!verified.questionIds.includes(questionId.trim())) {
      return NextResponse.json(
        {
          error: "Question is not part of this guided review session",
          code: "QUESTION_OUTSIDE_GUIDED_SESSION",
        },
        { status: 400, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    // 8. Fetch question by ID from Prisma without deletedAt filter
    // (Preserves 24h active-attempt soft-delete resolution semantics)
    const q = await prisma.question.findUnique({
      where: { id: questionId.trim() },
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
        examTip: true,
      },
    });

    if (!q) {
      return NextResponse.json(
        {
          error: "Question not found in question bank",
          code: "GUIDED_QUESTION_UNAVAILABLE",
        },
        { status: 422, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    // 9. Resolve options canonically
    const resolvedOptions: string[] =
      Array.isArray(q.options) && q.options.length > 0
        ? (q.options as string[])
        : ([q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean) as string[]);

    // 10. Validate selectedIndex is within valid choice range
    if (selectedIndex >= resolvedOptions.length) {
      return NextResponse.json(
        {
          error: "Selected index is out of bounds for question options",
          code: "SELECTED_INDEX_OUT_OF_BOUNDS",
        },
        { status: 400, headers: CACHE_PROFILES.PRIVATE }
      );
    }

    // 11. Server-authoritative correctness evaluation
    const isCorrect = selectedIndex === q.answerIndex;
    const correctLetter =
      ["A", "B", "C", "D"][q.answerIndex] || String(q.answerIndex + 1);
    const correctText = resolvedOptions[q.answerIndex] || "";

    // 12. Return feedback for this question only
    return NextResponse.json(
      {
        success: true,
        questionId: q.id,
        selectedIndex,
        isCorrect,
        answerIndex: q.answerIndex,
        correctLetter,
        correctText,
        explanation: q.explanation || null,
        stepByStep: q.stepByStep || null,
        whyA: q.whyA || null,
        whyB: q.whyB || null,
        whyC: q.whyC || null,
        whyD: q.whyD || null,
        eliminationStrategy: q.eliminationStrategy || null,
        commonTrap: q.commonTrap || null,
        examTip: q.examTip || null,
      },
      { headers: CACHE_PROFILES.PRIVATE }
    );
  } catch (error: any) {
    console.error("[GUIDED_REVIEW_CHECK_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process guided review check" },
      { status: 500, headers: CACHE_PROFILES.PRIVATE }
    );
  }
}
