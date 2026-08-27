// Relative Path: src/lib/recovery/softDelete.ts

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger/logger";
import { TrashItem, RestoreResponse, PurgeResult, SupportedEntityType } from "@/types/recovery";

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
