// Relative Path: src/lib/db/softDelete.ts

import { SoftDeleteMetadata } from "@/types/softDelete";

const DEFAULT_RETENTION_DAYS = 30;

export function calculateRestorableUntil(
  deletedAt: Date = new Date(),
  retentionDays: number = DEFAULT_RETENTION_DAYS
): Date {
  const deadline = new Date(deletedAt.getTime());
  deadline.setDate(deadline.getDate() + retentionDays);
  return deadline;
}

export function markAsSoftDeleted(
  id: string,
  deletedBy: string = "system",
  retentionDays: number = DEFAULT_RETENTION_DAYS
): SoftDeleteMetadata & { id: string } {
  const deletedAt = new Date();
  const restorableUntil = calculateRestorableUntil(deletedAt, retentionDays);

  return {
    id,
    deletedAt,
    deletedBy,
    restorableUntil,
  };
}

export function isExpired(restorableUntil: Date | string | null): boolean {
  if (!restorableUntil) return false;
  const deadline = new Date(restorableUntil);
  return Date.now() > deadline.getTime();
}

export function calculateDaysRemaining(restorableUntil: Date | string | null): number {
  if (!restorableUntil) return 0;
  const deadline = new Date(restorableUntil);
  const diffMs = deadline.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function restoreRecord(
  metadata: Partial<SoftDeleteMetadata>
): SoftDeleteMetadata {
  return {
    deletedAt: null,
    deletedBy: null,
    restorableUntil: null,
  };
}
