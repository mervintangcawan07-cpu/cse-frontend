// Relative Path: src/types/softDelete.ts
import { SupportedEntityType } from "./recovery";

export interface SoftDeleteMetadata {
  deletedAt: Date | string | null;
  deletedBy: string | null;
  restorableUntil: Date | string | null;
}

export interface SoftDeleteQueryOptions {
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
}

export interface SoftDeletedRecord {
  id: string;
  entityType: SupportedEntityType;
  displayName: string;
  deletedAt: Date;
  deletedBy: string;
  restorableUntil: Date;
  daysRemaining: number;
  dataSummary?: Record<string, any>;
}

export interface PurgeJobResult {
  totalExamined: number;
  totalPurged: number;
  batchCount: number;
  errorsCount: number;
  purgedAt: Date;
  details: Array<{ entityType: string; count: number }>;
}
