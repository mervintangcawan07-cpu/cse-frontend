// Relative Path: src/lib/recovery/softDelete.ts

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger/logger";
import {
  TrashItem,
  RestoreResponse,
  PurgeResult,
  SupportedEntityType,
  BatchOperationResult,
} from "@/types/recovery";

const DEFAULT_RETENTION_DAYS = 30;
const USER_HARD_PURGE_DISABLED_CODE = "USER_HARD_PURGE_DISABLED";
const USER_HARD_PURGE_DISABLED_MESSAGE =
  "Physical User purge is disabled pending an approved retention-safe implementation.";

export function calculateRestoreDeadline(
  deletedAt: Date = new Date(),
  retentionDays: number = DEFAULT_RETENTION_DAYS
): Date {
  const deadline = new Date(deletedAt.getTime());
  deadline.setDate(deadline.getDate() + retentionDays);
  return deadline;
}

export function calculateDaysRemaining(
  deletedAt: Date,
  retentionDays: number = DEFAULT_RETENTION_DAYS
): number {
  const deadline = calculateRestoreDeadline(deletedAt, retentionDays);
  const diffMs = deadline.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export async function softDeleteRecord(
  entityType: SupportedEntityType,
  entityId: string,
  deletedBy: string = "system"
): Promise<{ success: boolean; id: string; deletedAt: Date }> {
  const deletedAt = new Date();

  logger.warn(`SOFT DELETE TRIGGERED: ${entityType} ID: ${entityId}`, {
    context: { entityType, entityId, deletedBy, deletedAt: deletedAt.toISOString() },
  });

  const data = { deletedAt, deletedBy };

  switch (entityType) {
    case "user":
      await prisma.user.update({
        where: { id: entityId },
        data: {
          isBanned: true,
          banReason: `[SOFT_DELETED] Account soft-deleted by ${deletedBy} on ${deletedAt.toISOString()}`,
          activeSessionId: null,
          deletedAt,
          deletedBy,
        },
      });
      break;

    case "question":
      await prisma.question.update({ where: { id: entityId }, data });
      break;

    case "flashcard":
      await prisma.flashcard.update({ where: { id: entityId }, data });
      break;

    case "systemSetting":
      await prisma.systemSetting.update({ where: { key: entityId }, data });
      break;
  }

  return { success: true, id: entityId, deletedAt };
}

export async function restoreRecord(
  entityType: SupportedEntityType,
  entityId: string,
  restoredBy: string = "admin"
): Promise<RestoreResponse> {
  logger.info(`RESTORE RECORD TRIGGERED: ${entityType} ID: ${entityId}`, {
    context: { entityType, entityId, restoredBy },
  });

  const clearData = { deletedAt: null, deletedBy: null };

  switch (entityType) {
    case "user":
      await prisma.user.update({
        where: { id: entityId },
        data: { isBanned: false, banReason: null, ...clearData },
      });
      break;

    case "question":
      await prisma.question.update({ where: { id: entityId }, data: clearData });
      break;

    case "flashcard":
      await prisma.flashcard.update({ where: { id: entityId }, data: clearData });
      break;

    case "systemSetting":
      await prisma.systemSetting.update({ where: { key: entityId }, data: clearData });
      break;
  }

  return {
    success: true,
    entityType,
    entityId,
    restoredAt: new Date(),
    message: `${entityType} record ${entityId} successfully restored by ${restoredBy}.`,
  };
}

export async function getTrashBinItems(
  retentionDays: number = DEFAULT_RETENTION_DAYS
): Promise<TrashItem[]> {
  const items: TrashItem[] = [];

  // 1. Users
  const softDeletedUsers = await prisma.user.findMany({
    where: { OR: [{ deletedAt: { not: null } }, { banReason: { startsWith: "[SOFT_DELETED]" } }] },
    select: { id: true, email: true, name: true, updatedAt: true, deletedAt: true, deletedBy: true },
  });
  for (const u of softDeletedUsers) {
    const deletedAt = u.deletedAt || u.updatedAt;
    items.push({
      id: u.id,
      entityType: "user",
      displayName: u.email || u.name || u.id,
      deletedAt,
      deletedBy: u.deletedBy || "admin",
      daysRemaining: calculateDaysRemaining(deletedAt, retentionDays),
      canRestore: true,
    });
  }

  // 2. Questions & Elimination Drill Questions
  const softDeletedQuestions = await prisma.question.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true, prompt: true, category: true, subtopic: true, deletedAt: true, deletedBy: true },
  });
  for (const q of softDeletedQuestions) {
    if (q.deletedAt) {
      const isElimination = q.category === "Elimination Drill" || q.subtopic.includes("Elimination Drill");
      const prefix = isElimination ? "[Elimination Drill] " : "";
      items.push({
        id: q.id,
        entityType: "question",
        displayName: `${prefix}${(q.prompt || `Question ${q.id}`).slice(0, 50)}`,
        deletedAt: q.deletedAt,
        deletedBy: q.deletedBy || "admin",
        daysRemaining: calculateDaysRemaining(q.deletedAt, retentionDays),
        canRestore: true,
      });
    }
  }

  // 3. Flashcards
  const softDeletedCards = await prisma.flashcard.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true, front: true, question: true, topic: true, deletedAt: true, deletedBy: true },
  });
  for (const c of softDeletedCards) {
    if (c.deletedAt) {
      const cardTitle = c.front || c.question || c.topic || `Flashcard ${c.id}`;
      items.push({
        id: c.id,
        entityType: "flashcard",
        displayName: cardTitle.slice(0, 50),
        deletedAt: c.deletedAt,
        deletedBy: c.deletedBy || "admin",
        daysRemaining: calculateDaysRemaining(c.deletedAt, retentionDays),
        canRestore: true,
      });
    }
  }

  // 4. System Settings
  const softDeletedSettings = await prisma.systemSetting.findMany({
    where: { deletedAt: { not: null } },
    select: { key: true, deletedAt: true, deletedBy: true },
  });
  for (const s of softDeletedSettings) {
    if (s.deletedAt) {
      items.push({
        id: s.key,
        entityType: "systemSetting",
        displayName: `Config: ${s.key}`,
        deletedAt: s.deletedAt,
        deletedBy: s.deletedBy || "admin",
        daysRemaining: calculateDaysRemaining(s.deletedAt, retentionDays),
        canRestore: true,
      });
    }
  }

  return items;
}

export async function purgeExpiredRecords(
  retentionDays: number = DEFAULT_RETENTION_DAYS
): Promise<PurgeResult[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const results: PurgeResult[] = [];

  results.push({
    entityType: "user",
    totalPurged: 0,
    retentionDays,
    purgedBefore: cutoffDate,
    disabled: true,
    code: USER_HARD_PURGE_DISABLED_CODE,
    message: USER_HARD_PURGE_DISABLED_MESSAGE,
  });

  const questionPurge = await prisma.question.deleteMany({
    where: { deletedAt: { lte: cutoffDate } },
  });
  results.push({ entityType: "question", totalPurged: questionPurge.count, retentionDays, purgedBefore: cutoffDate });

  const flashcardPurge = await prisma.flashcard.deleteMany({
    where: { deletedAt: { lte: cutoffDate } },
  });
  results.push({ entityType: "flashcard", totalPurged: flashcardPurge.count, retentionDays, purgedBefore: cutoffDate });

  const settingPurge = await prisma.systemSetting.deleteMany({
    where: { deletedAt: { lte: cutoffDate } },
  });
  results.push({ entityType: "systemSetting", totalPurged: settingPurge.count, retentionDays, purgedBefore: cutoffDate });

  return results;
}

/**
 * Restores multiple selected items from the trash bin.
 */
export async function restoreBatchRecords(
  items: Array<{ entityType: SupportedEntityType; entityId: string }>,
  restoredBy: string = "admin"
): Promise<BatchOperationResult> {
  logger.info("RESTORE BATCH TRIGGERED", {
    context: { count: items.length, restoredBy },
  });

  const details: NonNullable<BatchOperationResult["details"]> = [];
  let processedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const item of items) {
    try {
      const res = await restoreRecord(item.entityType, item.entityId, restoredBy);
      if (res.success) {
        processedCount++;
        details.push({ id: item.entityId, entityType: item.entityType, status: "PROCESSED" });
      } else {
        skippedCount++;
        details.push({ id: item.entityId, entityType: item.entityType, status: "SKIPPED", reason: "Item not eligible" });
      }
    } catch (err: unknown) {
      failedCount++;
      const message = err instanceof Error ? err.message : "Unknown error";
      details.push({ id: item.entityId, entityType: item.entityType, status: "FAILED", reason: message });
    }
  }

  return {
    success: failedCount === 0,
    requestedCount: items.length,
    processedCount,
    skippedCount,
    failedCount,
    details,
  };
}

/**
 * Restores all Question Bank records currently in the trash bin.
 */
export async function restoreAllTrashQuestions(
  restoredBy: string = "admin"
): Promise<{ success: boolean; restoredCount: number }> {
  logger.info("RESTORE ALL TRASH QUESTIONS TRIGGERED", {
    context: { restoredBy },
  });

  const res = await prisma.question.updateMany({
    where: { deletedAt: { not: null } },
    data: { deletedAt: null, deletedBy: null },
  });

  return {
    success: true,
    restoredCount: res.count,
  };
}

/**
 * Permanently deletes explicitly selected records from the trash bin.
 * Strictly verifies that records are currently in trash (deletedAt !== null).
 * User physical deletion is strictly disabled (containment enforced).
 * Safely cleans up polymorphic bookmarks and related question data in a transaction.
 */
export async function permanentlyDeleteSelectedRecords(
  items: Array<{ entityType: SupportedEntityType; entityId: string }>,
  purgedBy: string = "admin"
): Promise<BatchOperationResult> {
  const details: NonNullable<BatchOperationResult["details"]> = [];
  let processedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  // 1. Check for user records — User hard purge is strictly disabled
  const userItems = items.filter((i) => i.entityType === "user");
  for (const u of userItems) {
    skippedCount++;
    details.push({
      id: u.entityId,
      entityType: "user",
      status: "SKIPPED",
      reason: USER_HARD_PURGE_DISABLED_MESSAGE,
    });
  }

  // 2. Questions
  const questionItems = items.filter((i) => i.entityType === "question");
  if (questionItems.length > 0) {
    const requestedIds = questionItems.map((q) => q.entityId);

    // Only target questions that are actually in trash (deletedAt !== null)
    const eligibleQuestions = await prisma.question.findMany({
      where: {
        id: { in: requestedIds },
        deletedAt: { not: null },
      },
      select: { id: true },
    });

    const eligibleIds = new Set(eligibleQuestions.map((q) => q.id));

    // Mark non-eligible as skipped
    for (const q of questionItems) {
      if (!eligibleIds.has(q.entityId)) {
        skippedCount++;
        details.push({
          id: q.entityId,
          entityType: "question",
          status: "SKIPPED",
          reason: "Question is not currently in trash bin or does not exist",
        });
      }
    }

    if (eligibleQuestions.length > 0) {
      const idsToDelete = Array.from(eligibleIds);
      try {
        await prisma.$transaction(async (tx) => {
          // Clean up polymorphic bookmarks referencing these questions
          await tx.bookmark.deleteMany({
            where: {
              targetType: "QUESTION",
              targetId: { in: idsToDelete },
            },
          });

          // Delete questions (cascades UserMistake, DailyQuestionAttempt, QuestionFlag; sets null on StudyRoom.activeQuestionId)
          await tx.question.deleteMany({
            where: {
              id: { in: idsToDelete },
              deletedAt: { not: null },
            },
          });
        });

        for (const id of idsToDelete) {
          processedCount++;
          details.push({ id, entityType: "question", status: "PROCESSED" });
        }
      } catch (err: unknown) {
        failedCount += idsToDelete.length;
        const message = err instanceof Error ? err.message : "Database transaction failed";
        for (const id of idsToDelete) {
          details.push({ id, entityType: "question", status: "FAILED", reason: message });
        }
      }
    }
  }

  // 3. Flashcards
  const flashcardItems = items.filter((i) => i.entityType === "flashcard");
  if (flashcardItems.length > 0) {
    const requestedIds = flashcardItems.map((f) => f.entityId);
    const eligibleCards = await prisma.flashcard.findMany({
      where: { id: { in: requestedIds }, deletedAt: { not: null } },
      select: { id: true },
    });
    const eligibleIds = new Set(eligibleCards.map((c) => c.id));

    for (const f of flashcardItems) {
      if (!eligibleIds.has(f.entityId)) {
        skippedCount++;
        details.push({
          id: f.entityId,
          entityType: "flashcard",
          status: "SKIPPED",
          reason: "Flashcard is not currently in trash bin or does not exist",
        });
      }
    }

    if (eligibleCards.length > 0) {
      const idsToDelete = Array.from(eligibleIds);
      try {
        await prisma.flashcard.deleteMany({
          where: { id: { in: idsToDelete }, deletedAt: { not: null } },
        });
        for (const id of idsToDelete) {
          processedCount++;
          details.push({ id, entityType: "flashcard", status: "PROCESSED" });
        }
      } catch (err: unknown) {
        failedCount += idsToDelete.length;
        const message = err instanceof Error ? err.message : "Database error";
        for (const id of idsToDelete) {
          details.push({ id, entityType: "flashcard", status: "FAILED", reason: message });
        }
      }
    }
  }

  // 4. System Settings
  const settingItems = items.filter((i) => i.entityType === "systemSetting");
  if (settingItems.length > 0) {
    const requestedKeys = settingItems.map((s) => s.entityId);
    const eligibleSettings = await prisma.systemSetting.findMany({
      where: { key: { in: requestedKeys }, deletedAt: { not: null } },
      select: { key: true },
    });
    const eligibleKeys = new Set(eligibleSettings.map((s) => s.key));

    for (const s of settingItems) {
      if (!eligibleKeys.has(s.entityId)) {
        skippedCount++;
        details.push({
          id: s.entityId,
          entityType: "systemSetting",
          status: "SKIPPED",
          reason: "Setting is not currently in trash bin or does not exist",
        });
      }
    }

    if (eligibleSettings.length > 0) {
      const keysToDelete = Array.from(eligibleKeys);
      try {
        await prisma.systemSetting.deleteMany({
          where: { key: { in: keysToDelete }, deletedAt: { not: null } },
        });
        for (const key of keysToDelete) {
          processedCount++;
          details.push({ id: key, entityType: "systemSetting", status: "PROCESSED" });
        }
      } catch (err: unknown) {
        failedCount += keysToDelete.length;
        const message = err instanceof Error ? err.message : "Database error";
        for (const key of keysToDelete) {
          details.push({ id: key, entityType: "systemSetting", status: "FAILED", reason: message });
        }
      }
    }
  }

  logger.warn("[AUDIT_TRASH_PURGE_SELECTED]", {
    context: {
      purgedBy,
      requestedCount: items.length,
      processedCount,
      skippedCount,
      failedCount,
      timestamp: new Date().toISOString(),
    },
  });

  return {
    success: failedCount === 0,
    requestedCount: items.length,
    processedCount,
    skippedCount,
    failedCount,
    details,
  };
}

/**
 * Permanently deletes ALL Question Bank records currently in the trash bin.
 * Server-authoritative: queries all questions with deletedAt !== null directly.
 * Cleans up polymorphic bookmarks and deletes questions in a single transaction.
 */
export async function purgeAllTrashQuestions(
  purgedBy: string = "admin"
): Promise<{
  success: boolean;
  requestedCount: number;
  purgedCount: number;
  skippedCount: number;
  failedCount: number;
}> {
  const trashedQuestions = await prisma.question.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true },
  });

  const totalTrashed = trashedQuestions.length;
  if (totalTrashed === 0) {
    return {
      success: true,
      requestedCount: 0,
      purgedCount: 0,
      skippedCount: 0,
      failedCount: 0,
    };
  }

  const questionIds = trashedQuestions.map((q) => q.id);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Clean up polymorphic bookmarks
      await tx.bookmark.deleteMany({
        where: {
          targetType: "QUESTION",
          targetId: { in: questionIds },
        },
      });

      // Permanently purge all trashed questions
      return await tx.question.deleteMany({
        where: {
          id: { in: questionIds },
          deletedAt: { not: null },
        },
      });
    });

    logger.warn("[AUDIT_TRASH_PURGE_ALL_QUESTIONS]", {
      context: {
        purgedBy,
        requestedCount: totalTrashed,
        purgedCount: result.count,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      requestedCount: totalTrashed,
      purgedCount: result.count,
      skippedCount: 0,
      failedCount: 0,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    logger.error("[TRASH_PURGE_ALL_QUESTIONS_ERROR]", err, {
      context: { purgedBy, totalTrashed, message },
    });
    return {
      success: false,
      requestedCount: totalTrashed,
      purgedCount: 0,
      skippedCount: 0,
      failedCount: totalTrashed,
    };
  }
}
