// Relative Path: src/lib/accounting/partnerAuditService.ts
import { prisma } from "@/lib/prisma";

export type PartnerAuditEvent =
  | "PARTNER_ACCOUNT_CREATED"
  | "PARTNER_INVITED"
  | "PARTNER_ACTIVATED"
  | "PARTNER_LOGIN_SUCCESS"
  | "PARTNER_LOGIN_FAILED"
  | "PARTNER_PASSWORD_CHANGED"
  | "PARTNER_PASSWORD_RESET"
  | "PARTNER_PAYOUT_METHOD_ADDED"
  | "PARTNER_PAYOUT_METHOD_CHANGED"
  | "PARTNER_PAYOUT_METHOD_REMOVED"
  | "PARTNER_DEFAULT_PAYOUT_METHOD_CHANGED"
  | "PARTNER_PAYOUT_REQUESTED"
  | "PARTNER_PAYOUT_RESERVED"
  | "PARTNER_PAYOUT_APPROVED"
  | "PARTNER_PAYOUT_REJECTED"
  | "PARTNER_PAYOUT_PROCESSING"
  | "PARTNER_PAYOUT_PAID"
  | "PARTNER_PAYOUT_FAILED"
  | "PARTNER_PAYOUT_REVERSED"
  | "PARTNER_STATEMENT_EXPORTED";

export interface LogPartnerAuditParams {
  action: PartnerAuditEvent;
  partnerId: string;
  actorId?: string;
  actorRole?: "PARTNER" | "ADMIN" | "SYSTEM";
  amountCentavos?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export class PartnerAuditService {
  /**
   * Records a secure audit log for partner events. Never stores passwords, tokens, or unmasked account numbers.
   */
  static async logEvent(params: LogPartnerAuditParams, client?: any) {
    try {
      const db = client || prisma;
      const sanitizedMeta = params.metadata ? { ...params.metadata } : undefined;

      // Ensure no raw account numbers or secrets leak into metadata
      if (sanitizedMeta) {
        delete (sanitizedMeta as Record<string, unknown>).password;
        delete (sanitizedMeta as Record<string, unknown>).token;
        delete (sanitizedMeta as Record<string, unknown>).rawAccountNumber;
      }

      return await db.accountingAuditLog.create({
        data: {
          action: params.action,
          targetType: "PARTNER",
          targetId: params.partnerId,
          actorId: params.actorId || params.partnerId,
          actorRole: params.actorRole || "PARTNER",
          amountCentavos: params.amountCentavos,
          reason: params.reason,
          metadata: sanitizedMeta ? JSON.parse(JSON.stringify(sanitizedMeta)) : undefined,
          ipAddress: params.ipAddress,
        },
      });
    } catch (error) {
      console.error("[PARTNER_AUDIT_LOG_ERROR]", error);
      return null;
    }
  }

  /**
   * Retrieves recent audit logs for a specific partner.
   */
  static async getPartnerAuditLogs(partnerId: string, limit = 50) {
    return prisma.accountingAuditLog.findMany({
      where: {
        targetType: "PARTNER",
        targetId: partnerId,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
