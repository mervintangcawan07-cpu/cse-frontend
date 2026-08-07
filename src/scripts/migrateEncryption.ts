// Relative Path: src/scripts/migrateEncryption.ts

import { prisma } from "@/lib/prisma";
import { encrypt, isEncrypted } from "@/lib/crypto/encryption";
import { logger } from "@/lib/logger/logger";

interface BatchMigrationResult {
  modelName: string;
  totalExamined: number;
  encryptedCount: number;
  alreadyEncryptedCount: number;
  errorsCount: number;
}

export async function migrateModelFields(
  modelName: "user",
  fieldNames: string[],
  batchSize: number = 50
): Promise<BatchMigrationResult> {
  const result: BatchMigrationResult = {
    modelName,
    totalExamined: 0,
    encryptedCount: 0,
    alreadyEncryptedCount: 0,
    errorsCount: 0,
  };

  logger.info(`Starting background field encryption migration for ${modelName}`, {
    context: { fields: fieldNames, batchSize },
  });

  try {
    if (modelName === "user") {
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const users = await prisma.user.findMany({
          take: batchSize,
          skip,
          select: { id: true, banReason: true },
        });

        if (users.length === 0) {
          hasMore = false;
          break;
        }

        for (const user of users) {
          result.totalExamined++;

          if (!user.banReason || isEncrypted(user.banReason)) {
            result.alreadyEncryptedCount++;
            continue;
          }

          try {
            const encryptedBanReason = encrypt(user.banReason);
            await prisma.user.update({
              where: { id: user.id },
              data: { banReason: encryptedBanReason },
            });
            result.encryptedCount++;
          } catch (err: any) {
            result.errorsCount++;
            logger.error(`Migration error for user record ID: ${user.id}`, {
              context: { reason: err?.message },
            });
          }
        }

        skip += batchSize;
      }
    }

    logger.info(`Completed field encryption migration for ${modelName}`, {
      context: result as any,
    });
  } catch (err: any) {
    logger.error(`Migration batch failed for model ${modelName}`, {
      context: { reason: err?.message },
    });
  }

  return result;
}
