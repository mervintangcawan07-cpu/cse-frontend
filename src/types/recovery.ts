// Relative Path: src/types/recovery.ts

export type SupportedEntityType =
  | "user"
  | "question"
  | "eliminationDrill"
  | "flashcard"
  | "readingPassage"
  | "systemSetting";

export interface SoftDeleteMetadata {
  deletedAt: Date;
  deletedBy?: string;
  restoreDeadline: Date;
  isDeleted: boolean;
}

export interface TrashItem {
  id: string;
  entityType: SupportedEntityType;
  displayName: string;
  deletedAt: Date;
  deletedBy?: string;
  daysRemaining: number;
  canRestore: boolean;
  dataSummary?: Record<string, any>;
}

export interface RestoreResponse {
  success: boolean;
  entityType: SupportedEntityType;
  entityId: string;
  restoredAt: Date;
  message: string;
}

export interface PurgeResult {
  entityType: string;
  totalPurged: number;
  retentionDays: number;
  purgedBefore: Date;
}
