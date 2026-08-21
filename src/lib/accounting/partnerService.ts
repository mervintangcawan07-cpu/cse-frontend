// Relative Path: src/lib/accounting/partnerService.ts
import { prisma } from "@/lib/prisma";
import {
  PartnerCommissionModel,
  PartnerStatus,
  PartnerType,
} from "./types";
import {
  calculatePercentageShareCentavos,
  deterministicRound,
  formatCentavosToPesos,
  sanitizePercentage,
} from "./money";
import { LedgerService } from "./ledgerService";
import { encrypt, decrypt } from "@/lib/crypto/encryption";

import bcrypt from "bcryptjs";

export interface CreatePartnerInput {
  name: string;
  code?: string;
  slug?: string;
  password?: string;
  tagline?: string;
  badgeText?: string;
  description?: string;
  type: PartnerType;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  commissionModel?: PartnerCommissionModel;
  commissionRate?: number;
  fixedCommissionCentavos?: number;
  holdingPeriodDays?: number;
  minPayoutCentavos?: number;
  notes?: string;
  adminUserId?: string;
}

export interface UpdatePartnerRateInput {
  partnerId: string;
  commissionModel: PartnerCommissionModel;
  commissionRate: number;
  fixedCommissionCentavos?: number;
  reason: string;
  adminUserId?: string;
}

export class PartnerService {
  /**
   * Generates a unique, collision-resistant Partner tracking code.
   */
  static generatePartnerCode(name: string): string {
    const clean = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .substring(0, 8);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PTR-${clean || "ORG"}${rand}`;
  }

  /**
   * Resolves a partner by code or custom slug.
   */
  static async resolvePartnerByCodeOrSlug(codeOrSlug: string) {
    if (!codeOrSlug) return null;
    const clean = codeOrSlug.trim();
    return prisma.partner.findFirst({
      where: {
        OR: [
          { code: { equals: clean, mode: "insensitive" } },
          { slug: { equals: clean, mode: "insensitive" } },
        ],
        status: "ACTIVE",
      },
    });
  }

  /**
   * Records partner attribution upon referred student signup.
   */
  static async recordPartnerAttributionOnSignup(params: {
    referredUserId: string;
    codeOrSlug: string;
    campaignSource?: string;
  }): Promise<{ success: boolean; partnerId?: string; reason?: string }> {
    const partner = await this.resolvePartnerByCodeOrSlug(params.codeOrSlug);
    if (!partner) {
      return { success: false, reason: "Partner not found or inactive" };
    }

    const existing = await prisma.partnerAttribution.findUnique({
      where: { referredUserId: params.referredUserId },
    });
    if (existing) {
      return { success: false, reason: "Attribution already exists" };
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day attribution window

    await prisma.partnerAttribution.create({
      data: {
        referredUserId: params.referredUserId,
        partnerId: partner.id,
        campaignSource: params.campaignSource?.toLowerCase().trim() || "direct",
        expiresAt,
        isLocked: true,
      },
    });

    return { success: true, partnerId: partner.id };
  }

  /**
   * Registers a new Partner organization or collaborator.
   */
  static async createPartner(input: CreatePartnerInput) {
    const code = input.code
      ? input.code.toUpperCase().trim()
      : this.generatePartnerCode(input.name);

    let cleanSlug: string | null = null;
    if (input.slug) {
      cleanSlug = input.slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }

    let passwordHash: string | null = null;
    if (input.password) {
      passwordHash = await bcrypt.hash(input.password, 10);
    }

    const safeRate = sanitizePercentage(input.commissionRate ?? 10.0, 10.0);

    const partner = await prisma.partner.create({
      data: {
        code,
        slug: cleanSlug,
        passwordHash,
        name: input.name.trim(),
        tagline: input.tagline?.trim(),
        badgeText: input.badgeText?.trim() || "Official Partner",
        description: input.description?.trim(),
        type: input.type,
        contactName: input.contactName?.trim(),
        contactEmail: input.contactEmail?.trim(),
        contactPhone: input.contactPhone?.trim(),
        commissionModel: input.commissionModel ?? "PERCENTAGE_OF_CUSTOMER_PAYMENT",
        commissionRate: safeRate,
        fixedCommissionCentavos: input.fixedCommissionCentavos ?? 0,
        holdingPeriodDays: input.holdingPeriodDays ?? 7,
        minPayoutCentavos: input.minPayoutCentavos ?? 15000,
        notes: input.notes?.trim(),
        createdBy: input.adminUserId,
        rateHistory: {
          create: {
            commissionModel: input.commissionModel ?? "PERCENTAGE_OF_CUSTOMER_PAYMENT",
            commissionRate: safeRate,
            fixedCommissionCentavos: input.fixedCommissionCentavos ?? 0,
            reason: "Initial partner agreement creation",
            updatedBy: input.adminUserId,
          },
        },
      },
      include: { rateHistory: true },
    });

    return partner;
  }

  /**
   * Updates partner commission rates with historical versioning.
   */
  static async updatePartnerRate(input: UpdatePartnerRateInput) {
    const safeRate = sanitizePercentage(input.commissionRate, 10.0);

    const partner = await prisma.partner.findUnique({
      where: { id: input.partnerId },
    });
    if (!partner) throw new Error("Partner not found");

    const [updatedPartner] = await prisma.$transaction([
      prisma.partner.update({
        where: { id: input.partnerId },
        data: {
          commissionModel: input.commissionModel,
          commissionRate: safeRate,
          fixedCommissionCentavos: input.fixedCommissionCentavos ?? 0,
        },
      }),
      prisma.partnerRateHistory.create({
        data: {
          partnerId: input.partnerId,
          commissionModel: input.commissionModel,
          commissionRate: safeRate,
          fixedCommissionCentavos: input.fixedCommissionCentavos ?? 0,
          reason: input.reason || "Rate adjustment",
          updatedBy: input.adminUserId,
        },
      }),
    ]);

    return updatedPartner;
  }

  /**
   * Calculates partner commission using integer centavos and the configured commission model.
   */
  static calculateCommission(params: {
    customerPaymentCentavos: number;
    grossAmountCentavos: number;
    commissionModel: PartnerCommissionModel;
    commissionRate: number;
    fixedCommissionCentavos?: number;
  }): {
    commissionAmountCentavos: number;
    effectiveRate: number;
    calculationBasis: string;
  } {
    const {
      customerPaymentCentavos,
      grossAmountCentavos,
      commissionModel,
      commissionRate,
      fixedCommissionCentavos = 0,
    } = params;

    const safeRate = sanitizePercentage(commissionRate, 10.0);
    let amountCentavos = 0;
    let basis = "CUSTOMER_PAYMENT";

    if (commissionModel === "PERCENTAGE_OF_GROSS") {
      amountCentavos = calculatePercentageShareCentavos(grossAmountCentavos, safeRate);
      basis = "GROSS_PRICE";
    } else if (commissionModel === "FIXED_PER_PURCHASE" || commissionModel === "FIXED_PER_REFERRAL") {
      amountCentavos = deterministicRound(fixedCommissionCentavos);
      basis = "FIXED_AMOUNT";
    } else {
      // Default: PERCENTAGE_OF_CUSTOMER_PAYMENT
      amountCentavos = calculatePercentageShareCentavos(customerPaymentCentavos, safeRate);
      basis = "CUSTOMER_PAYMENT";
    }

    return {
      commissionAmountCentavos: amountCentavos,
      effectiveRate: safeRate,
      calculationBasis: basis,
    };
  }

  /**
   * Qualifies partner payment, creating commission record & double-entry ledger entries.
   */
  static async qualifyPartnerPayment(params: {
    userId: string;
    transactionId: string;
    customerPaymentCentavos: number;
    grossAmountCentavos?: number;
    campaignSource?: string;
  }) {
    const attribution = await prisma.partnerAttribution.findUnique({
      where: { referredUserId: params.userId },
      include: { partner: true },
    });

    if (!attribution || attribution.partner.status !== "ACTIVE") {
      return null;
    }

    // Check if commission already exists (idempotency check)
    const existing = await prisma.partnerCommission.findUnique({
      where: { transactionId: params.transactionId },
    });
    if (existing) return existing;

    const partner = attribution.partner;
    const calc = this.calculateCommission({
      customerPaymentCentavos: params.customerPaymentCentavos,
      grossAmountCentavos: params.grossAmountCentavos || params.customerPaymentCentavos,
      commissionModel: partner.commissionModel,
      commissionRate: partner.commissionRate,
      fixedCommissionCentavos: partner.fixedCommissionCentavos || 0,
    });

    if (calc.commissionAmountCentavos <= 0) return null;

    const holdingUntil = new Date();
    holdingUntil.setDate(holdingUntil.getDate() + (partner.holdingPeriodDays || 7));

    const effectiveSource = params.campaignSource || attribution.campaignSource || "direct";

    const commission = await prisma.partnerCommission.create({
      data: {
        partnerId: partner.id,
        transactionId: params.transactionId,
        purchaseAmountCentavos: params.customerPaymentCentavos,
        commissionModel: partner.commissionModel,
        effectiveRate: calc.effectiveRate,
        commissionAmountCentavos: calc.commissionAmountCentavos,
        currency: "PHP",
        status: "PENDING",
        campaignSource: effectiveSource,
        holdingUntil,
      },
    });

    // Record in double-entry ledger
    await LedgerService.recordPartnerLiability({
      transactionId: params.transactionId,
      commissionId: commission.id,
      partnerId: partner.id,
      amountCentavos: calc.commissionAmountCentavos,
    });

    return commission;
  }

  /**
   * Generates partner financial statement with transaction drill-downs.
   */
  static async getPartnerStatement(partnerId: string) {
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        rateHistory: { orderBy: { effectiveDate: "desc" } },
        commissions: {
          orderBy: { createdAt: "desc" },
          include: {
            transaction: {
              include: {
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
        payouts: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!partner) throw new Error("Partner not found");

    let totalRevenueCentavos = 0;
    let totalCommissionsCentavos = 0;
    let pendingCommissionsCentavos = 0;
    let availableCommissionsCentavos = 0;
    let paidCommissionsCentavos = 0;
    let reversedCommissionsCentavos = 0;

    const channelMap: Record<
      string,
      { count: number; revenueCentavos: number; commissionCentavos: number }
    > = {};

    const now = new Date();

    partner.commissions.forEach((c) => {
      totalRevenueCentavos += c.purchaseAmountCentavos;

      const src = c.campaignSource || "direct";
      if (!channelMap[src]) {
        channelMap[src] = { count: 0, revenueCentavos: 0, commissionCentavos: 0 };
      }
      channelMap[src].count += 1;
      channelMap[src].revenueCentavos += c.purchaseAmountCentavos;
      channelMap[src].commissionCentavos += c.commissionAmountCentavos;

      if (c.status === "PAID") {
        totalCommissionsCentavos += c.commissionAmountCentavos;
        paidCommissionsCentavos += c.commissionAmountCentavos;
      } else if (c.status === "AVAILABLE" || (c.status === "PENDING" && c.holdingUntil && c.holdingUntil <= now)) {
        totalCommissionsCentavos += c.commissionAmountCentavos;
        availableCommissionsCentavos += c.commissionAmountCentavos;
      } else if (c.status === "PENDING") {
        totalCommissionsCentavos += c.commissionAmountCentavos;
        pendingCommissionsCentavos += c.commissionAmountCentavos;
      } else if (c.status === "REVERSED" || c.status === "CANCELLED") {
        reversedCommissionsCentavos += c.commissionAmountCentavos;
      }
    });

    let totalPayoutsDisbursedCentavos = 0;
    partner.payouts.forEach((p) => {
      if (p.status === "PAID") {
        totalPayoutsDisbursedCentavos += p.amountCentavos;
      }
    });

    const outstandingBalanceCentavos = availableCommissionsCentavos;

    const channelBreakdown = Object.entries(channelMap).map(([channel, data]) => ({
      channel,
      count: data.count,
      revenueCentavos: data.revenueCentavos,
      commissionCentavos: data.commissionCentavos,
      formattedRevenue: formatCentavosToPesos(data.revenueCentavos),
      formattedCommission: formatCentavosToPesos(data.commissionCentavos),
    }));

    return {
      partner: {
        id: partner.id,
        code: partner.code,
        slug: partner.slug,
        name: partner.name,
        type: partner.type,
        status: partner.status,
        commissionModel: partner.commissionModel,
        commissionRate: partner.commissionRate,
        holdingPeriodDays: partner.holdingPeriodDays,
        minPayoutCentavos: partner.minPayoutCentavos,
      },
      statement: {
        totalTransactionsCount: partner.commissions.length,
        totalRevenueCentavos,
        totalCommissionsCentavos,
        pendingCommissionsCentavos,
        availableCommissionsCentavos,
        paidCommissionsCentavos,
        reversedCommissionsCentavos,
        totalPayoutsDisbursedCentavos,
        outstandingBalanceCentavos,
        channelBreakdown,
        formattedRevenue: formatCentavosToPesos(totalRevenueCentavos),
        formattedCommissions: formatCentavosToPesos(totalCommissionsCentavos),
        formattedAvailable: formatCentavosToPesos(availableCommissionsCentavos),
        formattedOutstanding: formatCentavosToPesos(outstandingBalanceCentavos),
      },
      commissions: partner.commissions.map((c) => ({
        id: c.id,
        date: c.createdAt.toISOString(),
        transactionId: c.transactionId,
        campaignSource: c.campaignSource || "direct",
        customerName: c.transaction?.user?.name || "Student",
        customerEmailMasked: c.transaction?.user?.email
          ? c.transaction.user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3")
          : "—",
        purchaseAmountCentavos: c.purchaseAmountCentavos,
        effectiveRate: c.effectiveRate,
        commissionAmountCentavos: c.commissionAmountCentavos,
        status: c.status,
        holdingUntil: c.holdingUntil?.toISOString() || null,
      })),
      payouts: partner.payouts,
      rateHistory: partner.rateHistory,
    };
  }
}
