// Relative Path: src/app/api/exam/submit/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { recordUserActivityStreak } from "@/lib/streakEngine";
import { evaluateAndAwardBadges } from "@/lib/badges";
import {
  EXAM_SUBMIT_LIMITER,
  checkRateLimit,
  createRateLimitResponse,
} from "@/lib/ratelimit";
import { verifyExamAttemptToken } from "@/lib/examAttemptToken";
import { validateAndCanonicalizeSubmission } from "@/lib/examSubmissionIntegrity";
import { applyUserMistakeBatch } from "@/lib/userMistakeBatch";

interface SubmittedAnswer {
  questionId: string;
  selectedOption?: string | number;
  selectedIndex?: number;
}

export async function POST(request: Request) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authenticatedUser.id;

    // 🔒 Limit: 10 exam submissions per minute per user
    const rateResult = await checkRateLimit(EXAM_SUBMIT_LIMITER, `exam_submit:${userId}`);
    if (!rateResult.success) {
      return createRateLimitResponse(rateResult, "Too many exam submission requests. Please wait a moment.");
    }

    const body = await request.json();
    const { answers, attemptToken } = body as {
      answers?: SubmittedAnswer[];
      attemptToken?: string;
      totalItems?: number;
    };

    // Phase 5: Require attemptToken to be a non-empty string
    if (typeof attemptToken !== "string" || !attemptToken.trim()) {
      return NextResponse.json(
        { error: "Missing exam attempt token", code: "MISSING_ATTEMPT_TOKEN" },
        { status: 400 }
      );
    }

    // Cryptographically verify the attempt token
    const verifiedAttempt = await verifyExamAttemptToken(attemptToken);
    if (!verifiedAttempt) {
      return NextResponse.json(
        { error: "Invalid or expired exam attempt token", code: "INVALID_ATTEMPT_TOKEN" },
        { status: 400 }
      );
    }

    // User binding: token must match authenticated user
    if (verifiedAttempt.userId !== authenticatedUser.id) {
      return NextResponse.json(
        { error: "Exam attempt token does not match authenticated user", code: "ATTEMPT_USER_MISMATCH" },
        { status: 403 }
      );
    }

    // Phase 6 & 7: Ordered manifest and canonical answer validation
    const validation = validateAndCanonicalizeSubmission({
      verifiedAttempt,
      answers,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, code: validation.code },
        { status: 400 }
      );
    }

    const { canonicalAnswers, submissionHash: currentSubmissionHash } = validation;

    // Phase 8: Early idempotency check
    const existingResult = await prisma.examResult.findUnique({
      where: { attemptId: verifiedAttempt.attemptId },
    });

    if (existingResult) {
      if (existingResult.userId !== authenticatedUser.id) {
        return NextResponse.json(
          { error: "Forbidden", code: "ATTEMPT_USER_MISMATCH" },
          { status: 403 }
        );
      }

      if (!existingResult.submissionHash) {
        console.error(
          `[EXAM_SUBMIT_INTEGRITY] Existing attempt has null submissionHash for attemptId: ${verifiedAttempt.attemptId}`
        );
        return NextResponse.json(
          { error: "Attempt integrity check failed", code: "ATTEMPT_INTEGRITY_ERROR" },
          { status: 500 }
        );
      }

      if (existingResult.submissionHash === currentSubmissionHash) {
        // Identical retry: evaluate badges (idempotent, awaited) and return existing result
        await evaluateAndAwardBadges(userId);

        const streakRecord = await prisma.userStreak.findUnique({ where: { userId } }).catch(() => null);

        return NextResponse.json({
          success: true,
          result: existingResult,
          streak: streakRecord?.currentStreak || 1,
          idempotentReplay: true,
        });
      }

      // Conflicting retry: same attemptId but altered answers / different fingerprint
      return NextResponse.json(
        {
          error: "Conflicting attempt submission",
          code: "SUBMISSION_FINGERPRINT_MISMATCH",
        },
        { status: 409 }
      );
    }

    // Phase 9: Question retrieval & soft-delete compatibility
    // Fetch exact verifiedAttempt.questionIds from Question table.
    // Soft-deleted questions (deletedAt !== null) remain valid for active 24h attempts.
    const dbQuestions = await prisma.question.findMany({
      where: {
        id: { in: verifiedAttempt.questionIds },
      },
      select: {
        id: true,
        category: true,
        subtopic: true,
        prompt: true,
        options: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        answerIndex: true,
        explanation: true,
        imageUrl: true,
        stepByStep: true,
        whyA: true,
        whyB: true,
        whyC: true,
        whyD: true,
        eliminationStrategy: true,
        commonTrap: true,
        examTip: true,
        difficulty: true,
        tags: true,
      },
    });

    if (dbQuestions.length !== verifiedAttempt.questionIds.length) {
      return NextResponse.json(
        {
          error: "One or more exam questions are no longer available in the question bank.",
          code: "ATTEMPT_QUESTION_UNAVAILABLE",
        },
        { status: 422 }
      );
    }

    const questionMap = new Map(dbQuestions.map((q) => [q.id, q]));

    // Phase 10: Server-authoritative grading
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    const detailsSnapshot: any[] = [];

    for (const ans of canonicalAnswers) {
      const q = questionMap.get(ans.questionId);
      if (!q) {
        skipped++;
        continue;
      }

      if (ans.selectedIndex === -1) {
        skipped++;
      } else if (ans.selectedIndex === q.answerIndex) {
        correct++;
      } else {
        incorrect++;
      }

      // Format options array
      const resolvedOptions =
        Array.isArray(q.options) && q.options.length > 0
          ? q.options
          : [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean);

      // Build question snapshot item
      detailsSnapshot.push({
        id: q.id,
        category: q.category || "General",
        subtopic: q.subtopic || "General",
        prompt: q.prompt,
        options: resolvedOptions,
        answerIndex: q.answerIndex,
        selectedIndex: ans.selectedIndex >= 0 ? ans.selectedIndex : null,
        explanation: q.explanation || null,
        imageUrl: q.imageUrl || null,
        stepByStep: q.stepByStep || null,
        whyA: q.whyA || null,
        whyB: q.whyB || null,
        whyC: q.whyC || null,
        whyD: q.whyD || null,
        eliminationStrategy: q.eliminationStrategy || null,
        commonTrap: q.commonTrap || null,
        examTip: q.examTip || null,
        difficulty: q.difficulty || "MEDIUM",
        tags: q.tags || [],
      });
    }

    // Calculate score percentage using authoritative itemCount
    const itemsCount = verifiedAttempt.itemCount;
    const score = itemsCount > 0 ? Math.round((correct / itemsCount) * 100) : 0;

    // 4. Ingest incorrect questions into the Smart Mistake Notebook (Balik-Aral) in a single transactional batch
    const incorrectItems = detailsSnapshot.filter(
      (item) => item.selectedIndex !== null && item.selectedIndex !== item.answerIndex
    );

    // Phase 11: Atomic core interactive transaction
    let commitResult: {
      result: any;
      updatedStreak: any;
    };

    try {
      commitResult = await prisma.$transaction(async (tx) => {
        // 1. Create ExamResult with attemptId, submissionHash, examType, and itemCount
        const createdResult = await tx.examResult.create({
          data: {
            userId,
            score,
            totalItems: itemsCount,
            correct,
            incorrect,
            skipped,
            examType: verifiedAttempt.examType,
            attemptId: verifiedAttempt.attemptId,
            submissionHash: currentSubmissionHash,
            detailsJson: JSON.stringify(detailsSnapshot),
          },
        });

        // 2. Batch ingest incorrect questions into the Smart Mistake Notebook (Balik-Aral)
        if (incorrectItems.length > 0) {
          await applyUserMistakeBatch(tx, userId, incorrectItems);
        }

        // 3. User streak update within the interactive transaction
        const updatedStreak = await recordUserActivityStreak(userId, tx);

        // 4. Clean up active exam draft within the transaction
        await tx.examDraft.deleteMany({
          where: { userId },
        });

        return {
          result: createdResult,
          updatedStreak,
        };
      });
    } catch (txError: any) {
      // Phase 12: Handle concurrent same-attempt race condition (Prisma P2002)
      const isUniqueViolation =
        txError?.code === "P2002" ||
        (typeof txError?.message === "string" && txError.message.includes("Unique constraint failed"));

      if (isUniqueViolation) {
        const concurrentResult = await prisma.examResult.findUnique({
          where: { attemptId: verifiedAttempt.attemptId },
        });

        if (concurrentResult) {
          if (concurrentResult.userId !== authenticatedUser.id) {
            return NextResponse.json(
              { error: "Forbidden", code: "ATTEMPT_USER_MISMATCH" },
              { status: 403 }
            );
          }

          if (!concurrentResult.submissionHash) {
            console.error(
              `[EXAM_SUBMIT_INTEGRITY] Concurrent attempt has null submissionHash for attemptId: ${verifiedAttempt.attemptId}`
            );
            return NextResponse.json(
              { error: "Attempt integrity check failed", code: "ATTEMPT_INTEGRITY_ERROR" },
              { status: 500 }
            );
          }

          if (concurrentResult.submissionHash === currentSubmissionHash) {
            // Identical retry: DO NOT mutate streak, evaluate badges (idempotent, awaited) and return existing result
            await evaluateAndAwardBadges(userId);

            const streakRecord = await prisma.userStreak.findUnique({ where: { userId } }).catch(() => null);
            return NextResponse.json({
              success: true,
              result: concurrentResult,
              streak: streakRecord?.currentStreak || 1,
              idempotentReplay: true,
            });
          } else {
            return NextResponse.json(
              {
                error: "Conflicting attempt submission",
                code: "SUBMISSION_FINGERPRINT_MISMATCH",
              },
              { status: 409 }
            );
          }
        }
      }

      console.error("[EXAM_SUBMIT_TX_ERROR]", txError);
      return NextResponse.json(
        { error: "Failed to process exam result" },
        { status: 500 }
      );
    }

    // Phase 13: Badge evaluation happens AFTER the core transaction commits (idempotent, awaited)
    await evaluateAndAwardBadges(userId);

    return NextResponse.json({
      success: true,
      result: commitResult.result,
      streak: commitResult.updatedStreak?.currentStreak || 1,
    });
  } catch (error) {
    console.error("Exam submission error:", error);
    return NextResponse.json({ error: "Failed to process exam result" }, { status: 500 });
  }
}
