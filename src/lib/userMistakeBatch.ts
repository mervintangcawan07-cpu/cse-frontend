// Relative Path: src/lib/userMistakeBatch.ts
import type { Prisma, PrismaClient } from "@prisma/client";

export type MistakeDbClient = PrismaClient | Prisma.TransactionClient;

export interface IncorrectMistakeInputItem {
  id?: string;
  questionId?: string;
  selectedIndex: number;
}

/**
 * Batches UserMistake writes within an interactive transaction.
 *
 * This reduces mistake persistence from N sequential database
 * round-trips to one createMany plus at most one updateMany per distinct
 * selectedIndex.
 */
export async function applyUserMistakeBatch(
  tx: MistakeDbClient,
  userId: string,
  incorrectItems: IncorrectMistakeInputItem[],
  timestamp?: Date
): Promise<void> {
  if (!incorrectItems || incorrectItems.length === 0) {
    return;
  }

  // Fail-closed validation for userId
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new Error("Invalid userId: expected non-empty string");
  }

  const now = timestamp ?? new Date();

  // Fail-closed validation for all items BEFORE any Prisma write
  const seenQuestionIds = new Set<string>();
  const validatedItems: Array<{ questionId: string; selectedIndex: number }> = [];

  for (let i = 0; i < incorrectItems.length; i++) {
    const item = incorrectItems[i];
    if (!item || typeof item !== "object") {
      throw new Error(`Invalid mistake item at index ${i}: expected object`);
    }

    const qId = item.id !== undefined ? item.id : item.questionId;
    if (typeof qId !== "string" || qId.trim().length === 0) {
      throw new Error(
        `Invalid questionId at index ${i}: expected non-empty string`
      );
    }

    if (seenQuestionIds.has(qId)) {
      throw new Error(
        `Duplicate questionId detected in incorrectItems at index ${i}: "${qId}"`
      );
    }
    seenQuestionIds.add(qId);

    if (
      typeof item.selectedIndex !== "number" ||
      !Number.isInteger(item.selectedIndex) ||
      item.selectedIndex < -1 ||
      item.selectedIndex > 3
    ) {
      throw new Error(
        `Invalid selectedIndex at index ${i} for question "${qId}": expected integer between -1 and 3, got ${item.selectedIndex}`
      );
    }

    // Preserve exact original question ID without trimming mutation
    validatedItems.push({
      questionId: qId,
      selectedIndex: item.selectedIndex,
    });
  }

  // STEP 1: Insert missing UserMistake rows with incorrectCount = 0.
  // Existing rows are safely skipped via PostgreSQL ON CONFLICT (userId, questionId) DO NOTHING.
  const createData: Prisma.UserMistakeCreateManyInput[] = validatedItems.map((item) => ({
    userId,
    questionId: item.questionId,
    userAnswer: item.selectedIndex,
    incorrectCount: 0,
    isMastered: false,
    lastAttemptAt: now,
  }));

  await tx.userMistake.createMany({
    data: createData,
    skipDuplicates: true,
  });

  // STEP 2: Group by selectedIndex and execute one updateMany per group.
  // This performs the authoritative +1 increment and updates userAnswer/lastAttemptAt.
  const groups = new Map<number, string[]>();
  for (const item of validatedItems) {
    const existing = groups.get(item.selectedIndex);
    if (existing) {
      existing.push(item.questionId);
    } else {
      groups.set(item.selectedIndex, [item.questionId]);
    }
  }

  for (const [selectedIndex, questionIds] of groups.entries()) {
    if (questionIds.length === 0) continue;
    await tx.userMistake.updateMany({
      where: {
        userId,
        questionId: { in: questionIds },
      },
      data: {
        userAnswer: selectedIndex,
        incorrectCount: { increment: 1 },
        isMastered: false,
        lastAttemptAt: now,
      },
    });
  }
}
