// Relative Path: src/jobs/purgeExpiredRecords.ts

import { logger } from "@/lib/logger/logger";
import { PurgeJobResult } from "@/types/softDelete";

const DEFAULT_BATCH_SIZE = 50;
const USER_HARD_PURGE_DISABLED_CODE = "USER_HARD_PURGE_DISABLED";
const USER_HARD_PURGE_DISABLED_MESSAGE =
  "Physical User purge is disabled pending an approved retention-safe implementation.";

export async function purgeExpiredRecords(batchSize: number = DEFAULT_BATCH_SIZE): Promise<PurgeJobResult> {
  const now = new Date();
  const result: PurgeJobResult = {
    totalExamined: 0,
    totalPurged: 0,
    batchCount: 0,
    errorsCount: 0,
    purgedAt: now,
    disabled: true,
    code: USER_HARD_PURGE_DISABLED_CODE,
    message: USER_HARD_PURGE_DISABLED_MESSAGE,
    details: [
      {
        entityType: "user",
        count: 0,
        disabled: true,
        code: USER_HARD_PURGE_DISABLED_CODE,
        message: USER_HARD_PURGE_DISABLED_MESSAGE,
      },
    ],
  };

  logger.warn("User hard purge request blocked by source-level containment", {
    context: {
      batchSize,
      code: USER_HARD_PURGE_DISABLED_CODE,
      purgeTime: now.toISOString(),
    },
  });

  return result;
}
