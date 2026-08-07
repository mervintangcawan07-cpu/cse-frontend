// Relative Path: src/middleware/softDeleteFilter.ts

import { SoftDeleteQueryOptions } from "@/types/softDelete";

export function applySoftDeleteFilter<T extends Record<string, any>>(
  whereClause: T = {} as T,
  options?: SoftDeleteQueryOptions
): T {
  if (options?.includeDeleted) {
    return whereClause;
  }

  if (options?.onlyDeleted) {
    return {
      ...whereClause,
      deletedAt: { not: null },
    };
  }

  return {
    ...whereClause,
    deletedAt: null,
  };
}
