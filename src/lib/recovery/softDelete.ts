// Relative Path: src/lib/recovery/softDelete.ts

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger/logger";
import { TrashItem, RestoreResponse, PurgeResult, SupportedEntityType } from "@/types/recovery";

const DEFAULT_RETENTION_DAYS = 30;

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

    case "eliminationDrill":
      await prisma.eliminationDrill.update({ where: { id: entityId }, data });
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

    case "eliminationDrill":
      await prisma.eliminationDrill.update({ where: { id: entityId }, data: clearData });
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

  // 2. Elimination Drills
  const softDeletedDrills = await prisma.eliminationDrill.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true, title: true, deletedAt: true, deletedBy: true },
  });
  for (const d of softDeletedDrills) {
    if (d.deletedAt) {
      items.push({
        id: d.id,
        entityType: "eliminationDrill",
        displayName: d.title || `Drill ${d.id}`,
        deletedAt: d.deletedAt,
        deletedBy: d.deletedBy || "admin",
        daysRemaining: calculateDaysRemaining(d.deletedAt, retentionDays),
        canRestore: true,
      });
    }
  }

  // 3. Questions
  const softDeletedQuestions = await prisma.question.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true, prompt: true, deletedAt: true, deletedBy: true },
  });
  for (const q of softDeletedQuestions) {
    if (q.deletedAt) {
      items.push({
        id: q.id,
        entityType: "question",
        displayName: q.prompt?.slice(0, 50) || `Question ${q.id}`,
        deletedAt: q.deletedAt,
        deletedBy: q.deletedBy || "admin",
        daysRemaining: calculateDaysRemaining(q.deletedAt, retentionDays),
        canRestore: true,
      });
    }
  }

  // 4. Flashcards
  const softDeletedCards = await prisma.flashcard.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true, front: true, deletedAt: true, deletedBy: true },
  });
  for (const c of softDeletedCards) {
    if (c.deletedAt) {
      items.push({
        id: c.id,
        entityType: "flashcard",
        displayName: c.front?.slice(0, 50) || `Flashcard ${c.id}`,
        deletedAt: c.deletedAt,
        deletedBy: c.deletedBy || "admin",
        daysRemaining: calculateDaysRemaining(c.deletedAt, retentionDays),
        canRestore: true,
      });
    }
  }

  // 5. System Settings
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

  const userPurge = await prisma.user.deleteMany({
    where: { deletedAt: { lte: cutoffDate } },
  });
  results.push({ entityType: "user", totalPurged: userPurge.count, retentionDays, purgedBefore: cutoffDate });

  const drillPurge = await prisma.eliminationDrill.deleteMany({
    where: { deletedAt: { lte: cutoffDate } },
  });
  results.push({ entityType: "eliminationDrill", totalPurged: drillPurge.count, retentionDays, purgedBefore: cutoffDate });

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