// Relative Path: src/jobs/purgeExpiredRecords.ts

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger/logger";
import { PurgeJobResult } from "@/types/softDelete";

const DEFAULT_BATCH_SIZE = 50;

export async function purgeExpiredRecords(batchSize: number = DEFAULT_BATCH_SIZE): Promise<PurgeJobResult> {
  const now = new Date();
  const result: PurgeJobResult = {
    totalExamined: 0,
    totalPurged: 0,
    batchCount: 0,
    errorsCount: 0,
    purgedAt: now,
    details: [],
  };

  logger.info("Starting automated background purge job for expired soft-deleted records", {
    context: { batchSize, purgeTime: now.toISOString() },
  });

  try {
    const cutoff30Days = new Date();
    cutoff30Days.setDate(cutoff30Days.getDate() - 30);

    let hasMore = true;
    let skip = 0;
    let userPurgedCount = 0;

    while (hasMore) {
      const candidates = await prisma.user.findMany({
        take: batchSize,
        skip,
        where: {
          isBanned: true,
          banReason: { startsWith: "[SOFT_DELETED]" },
          updatedAt: { lte: cutoff30Days },
        },
        select: { id: true, email: true },
      });

      if (candidates.length === 0) {
        hasMore = false;
        break;
      }

      result.totalExamined += candidates.length;
      result.batchCount++;

      const targetIds = candidates.map((c) => c.id);

      try {
        const deleteBatch = await prisma.user.deleteMany({
          where: { id: { in: targetIds } },
        });

        userPurgedCount += deleteBatch.count;
        result.totalPurged += deleteBatch.count;

        logger.warn(`PERMANENT PURGE BATCH EXECUTED: Removed ${deleteBatch.count} expired user records.`, {
          context: { batchSize: deleteBatch.count, targetIds },
        });
      } catch (err: any) {
        result.errorsCount++;
        logger.error("Failed to execute purge batch for target user IDs", {
          context: { reason: err?.message, targetIds },
        });
      }

      skip += batchSize;
    }

    result.details.push({ entityType: "user", count: userPurgedCount });

    logger.info("Automated purge job completed successfully", {
      context: result as any,
    });
  } catch (err: any) {
    logger.error("Automated purge job encountered a fatal error", {
      context: { reason: err?.message },
    });
  }

  return result;
}
