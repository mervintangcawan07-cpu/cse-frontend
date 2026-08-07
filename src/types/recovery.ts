// Relative Path: src/types/recovery.ts

export type SupportedEntityType = "user" | "question" | "flashcard" | "systemSetting";

export interface TrashItem {
  id: string;
  entityType: SupportedEntityType;
  displayName: string;
  deletedAt: Date;
  deletedBy: string;
  daysRemaining: number;
  canRestore: boolean;
}

export interface RestoreResponse {
  success: boolean;
  entityType: SupportedEntityType;
  entityId: string;
  restoredAt: Date;
  message: string;
}

export interface PurgeResult {
  entityType: SupportedEntityType;
  totalPurged: number;
  retentionDays: number;
  purgedBefore: Date;
}