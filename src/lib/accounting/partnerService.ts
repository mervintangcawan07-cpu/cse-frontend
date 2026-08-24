// Relative Path: src/lib/accounting/partnerService.ts
import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PartnerCommissionModel,
  PartnerStatus,
  PartnerType,
  PayoutMethod,
} from "./types";
import {
  calculatePercentageShareCentavos,
  deterministicRound,
  formatCentavosToPesos,
  sanitizePercentage,
} from "./money";
import { LedgerService } from "./ledgerService";
import { encrypt, decrypt } from "@/lib/crypto/encryption";
import {
  sendPartnerCommissionAlertEmail,
  sendPartnerSetupEmail,
} from "@/lib/email";
import {
  PartnerAuditService,
  type LogPartnerAuditParams,
} from "./partnerAuditService";
import { getSiteUrl } from "@/lib/config/site";
import { IdempotencyService, IdempotencyDomainError } from "./idempotencyService";

export const ELIGIBLE_PARTNER_SETUP_STATUSES = ["ACTIVE", "PENDING"] as const;
export type PartnerSetupDeliveryStatus = "SENT" | "FAILED";
export type PartnerSetupAction = "CREATED" | "APPROVED" | "RESENT";

export interface PartnerCredentialState {
  status: string;
  contactEmail?: string | null;
  passwordHash?: string | null;
  tempPasswordHash?: string | null;
}

export interface PartnerSetupCredential {
  token: string;
  expiresAt: Date;
}

export interface SafePartnerOnboardingPartner {
  id: string;
  partnerId: string | null;
  code: string;
  slug: string | null;
  name: string;
  type: PartnerType;
  status: PartnerStatus;
  contactEmail: string | null;
  readonly setupToken?: never;
  readonly setupTokenExpires?: never;
  readonly passwordHash?: never;
  readonly tempPasswordHash?: never;
  readonly resetToken?: never;
  readonly resetTokenExpires?: never;
  readonly mustChangePassword?: never;
}

export function sanitizePartnerOnboardingPartner(partner: {
  id: string;
  partnerId: string | null;
  code: string;
  slug: string | null;
  name: string;
  type: PartnerType;
  status: PartnerStatus;
  contactEmail: string | null;
}): SafePartnerOnboardingPartner {
  return {
    id: partner.id,
    partnerId: partner.partnerId,
    code: partner.code,
    slug: partner.slug,
    name: partner.name,
    type: partner.type,
    status: partner.status,
    contactEmail: partner.contactEmail,
  };
}

export class PartnerOnboardingError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "MISSING_EMAIL"
      | "ALREADY_CREDENTIALED"
      | "INELIGIBLE_STATUS"
      | "CONFLICT"
      | "DUPLICATE_PARTNER",
    message: string
  ) {
    super(message);
    this.name = "PartnerOnboardingError";
  }
}

export function isPartnerSetupStatusEligible(status: string): boolean {
  return ELIGIBLE_PARTNER_SETUP_STATUSES.includes(
    status as (typeof ELIGIBLE_PARTNER_SETUP_STATUSES)[number]
  );
}

export function hasEstablishedPartnerCredential(
  partner: Pick<PartnerCredentialState, "passwordHash" | "tempPasswordHash">
): boolean {
  return Boolean(partner.passwordHash || partner.tempPasswordHash);
}

export function isUsablePartnerContactEmail(email?: string | null): boolean {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
}

export function canResendPartnerSetupLink(partner: PartnerCredentialState): boolean {
  return (
    isPartnerSetupStatusEligible(partner.status) &&
    isUsablePartnerContactEmail(partner.contactEmail) &&
    !hasEstablishedPartnerCredential(partner)
  );
}

export function canUsePartnerPasswordRecovery(partner: PartnerCredentialState): boolean {
  return partner.status === "ACTIVE" && hasEstablishedPartnerCredential(partner);
}

export function createPartnerSetupCredential(
  now = new Date(),
  randomBytes: (size: number) => Buffer = crypto.randomBytes
): PartnerSetupCredential {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 7);
  return {
    token: randomBytes(32).toString("hex"),
    expiresAt,
  };
}

export function buildPartnerSetupDeliveryResult(
  action: PartnerSetupAction,
  partnerName: string,
  deliveryStatus: PartnerSetupDeliveryStatus
) {
  const actionMessage =
    action === "APPROVED"
      ? `Partner "${partnerName}" approved successfully.`
      : action === "RESENT"
        ? `A new setup link was generated for ${partnerName}.`
        : `Partner ${partnerName} created successfully.`;

  return {
    success: true as const,
    deliveryStatus,
    message:
      deliveryStatus === "SENT"
        ? `${actionMessage} The secure setup email was sent.`
        : `${actionMessage} Email delivery failed; use Resend Setup Link to try again.`,
  };
}

interface SetupResendPartnerRecord extends PartnerCredentialState {
  id: string;
  partnerId: string | null;
  code: string;
  name: string;
  setupToken: string | null;
  contactEmail: string | null;
}

export interface PartnerSetupResendDependencies {
  findPartner(partnerId: string): Promise<SetupResendPartnerRecord | null>;
  rotateSetupToken(params: {
    partnerId: string;
    expectedSetupToken: string | null;
    nextSetupToken: string;
    setupTokenExpires: Date;
  }): Promise<boolean>;
  deliverSetupEmail(params: {
    toEmail: string;
    partnerName: string;
    partnerId: string;
    setupToken: string;
  }): Promise<PartnerSetupDeliveryStatus>;
  createCredential?: () => PartnerSetupCredential;
}

export async function executePartnerSetupResend(
  partnerId: string,
  dependencies: PartnerSetupResendDependencies
) {
  const partner = await dependencies.findPartner(partnerId);
  if (!partner) {
    throw new PartnerOnboardingError("NOT_FOUND", "Partner not found.");
  }
  if (hasEstablishedPartnerCredential(partner)) {
    throw new PartnerOnboardingError(
      "ALREADY_CREDENTIALED",
      "This partner already has an established credential. Use Forgot Password instead."
    );
  }
  if (!isUsablePartnerContactEmail(partner.contactEmail)) {
    throw new PartnerOnboardingError(
      "MISSING_EMAIL",
      "A usable contact email is required before sending a setup link."
    );
  }
  if (!isPartnerSetupStatusEligible(partner.status)) {
    throw new PartnerOnboardingError(
      "INELIGIBLE_STATUS",
      "This partner's current status does not permit account setup."
    );
  }

  const credential = dependencies.createCredential?.() ?? createPartnerSetupCredential();
  const rotated = await dependencies.rotateSetupToken({
    partnerId: partner.id,
    expectedSetupToken: partner.setupToken,
    nextSetupToken: credential.token,
    setupTokenExpires: credential.expiresAt,
  });

  if (!rotated) {
    throw new PartnerOnboardingError(
      "CONFLICT",
      "The partner account changed while the setup link was being refreshed. Reload and try again."
    );
  }

  let deliveryStatus: PartnerSetupDeliveryStatus = "FAILED";
  try {
    deliveryStatus = await dependencies.deliverSetupEmail({
      toEmail: partner.contactEmail!,
      partnerName: partner.name,
      partnerId: partner.partnerId || partner.code,
      setupToken: credential.token,
    });
  } catch {
    console.error("[PARTNER_SETUP_EMAIL_ERROR] Email delivery failed after token rotation.");
  }

  return {
    partnerId: partner.id,
    displayPartnerId: partner.partnerId || partner.code,
    partnerName: partner.name,
    deliveryStatus,
  };
}

export interface CreatePartnerInput {
  name: string;
  partnerId?: string; // Optional manual override, otherwise server-generated PT-XXXXXX
  code?: string;
  slug?: string;
  tagline?: string;
  badgeText?: string;
  description?: string;
  type: PartnerType;
  contactName?: string;
  contactEmail: string;
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

export interface AddPayoutProfileInput {
  partnerId: string;
  method: PayoutMethod;
  accountHolderName: string;
  accountNumber: string;
  bankName?: string | null;
  accountType?: string | null;
  isDefault?: boolean;
}

type PartnerDbClient = Prisma.TransactionClient | typeof prisma;

export class PartnerService {
  private static async recordPostCommitAudit(
    params: LogPartnerAuditParams
  ): Promise<void> {
    try {
      const auditRecord = await PartnerAuditService.logEvent(params);
      if (!auditRecord) {
        console.error(
          "[PARTNER_POST_COMMIT_AUDIT_ERROR] Committed operation completed, but its audit event was not recorded."
        );
      }
    } catch {
      console.error(
        "[PARTNER_POST_COMMIT_AUDIT_ERROR] Committed operation completed, but its audit event was not recorded."
      );
    }
  }

  /**
   * Normalizes any partner ID input (e.g. "pt-000123", "Pt-123", "PT-000123") into canonical "PT-XXXXXX".
   */
  static normalizePartnerId(input: string): string {
    if (!input) return "";
    const clean = input.trim();
    const ptMatch = clean.match(/^pt[-_]?(\d{1,6})$/i);
    if (ptMatch) {
      const numStr = ptMatch[1].padStart(6, "0");
      return `PT-${numStr}`;
    }
    return clean;
  }

  /**
   * Concurrency-safe atomic generation of the next sequential Partner ID: PT-XXXXXX.
   * Utilizes database atomic sequence/counter inside transaction to prevent collisions.
   */
  private static async generateNextPartnerIdWithClient(
    client: PartnerDbClient
  ): Promise<string> {
    const seq = await client.partnerSequence.upsert({
      where: { id: "PARTNER_SEQ" },
      update: { currentVal: { increment: 1 } },
      create: { id: "PARTNER_SEQ", currentVal: 1 },
    });

    let nextVal = seq.currentVal;
    let candidate = `PT-${String(nextVal).padStart(6, "0")}`;

    // Ensure candidate does not already exist (protection against manual inserts)
    let exists = await client.partner.findUnique({
      where: { partnerId: candidate },
      select: { id: true },
    });

    while (exists) {
      nextVal++;
      candidate = `PT-${String(nextVal).padStart(6, "0")}`;
      exists = await client.partner.findUnique({
        where: { partnerId: candidate },
        select: { id: true },
      });
    }

    return candidate;
  }

  static async generateNextPartnerId(): Promise<string> {
    return prisma.$transaction(
      (tx) => this.generateNextPartnerIdWithClient(tx),
      { timeout: 25000, maxWait: 15000 }
    );
  }

  /**
   * Generates a unique fallback partner tracking code for URLs.
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
   * Resolves a partner by registered Email OR Partner ID (PT-XXXXXX) OR code OR custom slug.
   */
  static async resolvePartnerByIdentifier(identifier: string) {
    if (!identifier) return null;
    const clean = identifier.trim();
    const normalizedPT = this.normalizePartnerId(clean);

    return prisma.partner.findFirst({
      where: {
        OR: [
          { partnerId: { equals: normalizedPT, mode: "insensitive" } },
          { partnerId: { equals: clean, mode: "insensitive" } },
          { contactEmail: { equals: clean.toLowerCase(), mode: "insensitive" } },
          { code: { equals: clean, mode: "insensitive" } },
          { slug: { equals: clean, mode: "insensitive" } },
        ],
      },
      include: {
        payoutProfiles: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  /**
   * Resolves an active partner by code or custom slug for student referrals.
   */
  static async resolvePartnerByCodeOrSlug(codeOrSlug: string) {
    if (!codeOrSlug) return null;
    const clean = codeOrSlug.trim();
    const normalizedPT = this.normalizePartnerId(clean);

    return prisma.partner.findFirst({
      where: {
        OR: [
          { partnerId: { equals: normalizedPT, mode: "insensitive" } },
          { code: { equals: clean, mode: "insensitive" } },
          { slug: { equals: clean, mode: "insensitive" } },
        ],
        status: "ACTIVE",
      },
    });
  }

  /**
   * Masks sensitive account numbers for safe display throughout UI and logs.
   * e.g., GCash: "09******123", Maya: "09******456", Bank: "******1234"
   */
  static maskAccountNumber(accountNumber: string, method?: string): string {
    if (!accountNumber) return "—";
    const clean = String(accountNumber).trim();
    if (clean.length <= 4) return "******";

    if (method === "GCASH" || method === "MAYA" || clean.startsWith("09")) {
      if (clean.length >= 11) {
        return `${clean.slice(0, 2)}******${clean.slice(-3)}`;
      }
    }
    return `******${clean.slice(-4)}`;
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
   * Registers a new Partner organization with PT-XXXXXX generation and secure one-time onboarding setup token.
   */
  private static async createPartnerRecord(
    input: CreatePartnerInput,
    client: PartnerDbClient,
    credential: PartnerSetupCredential
  ) {
    const contactEmail = input.contactEmail.trim().toLowerCase();
    if (!isUsablePartnerContactEmail(contactEmail)) {
      throw new PartnerOnboardingError(
        "MISSING_EMAIL",
        "A usable contact email is required for secure partner setup."
      );
    }

    const partnerId = input.partnerId
      ? this.normalizePartnerId(input.partnerId)
      : await this.generateNextPartnerIdWithClient(client);

    const code = input.code
      ? input.code.toUpperCase().trim()
      : partnerId; // default tracking code to PT-XXXXXX

    let cleanSlug: string | null = null;
    if (input.slug) {
      cleanSlug = input.slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }

    const duplicateConditions: Prisma.PartnerWhereInput[] = [
      { contactEmail: { equals: contactEmail, mode: "insensitive" } },
    ];
    if (cleanSlug) {
      duplicateConditions.push({ slug: { equals: cleanSlug, mode: "insensitive" } });
    }

    const duplicate = await client.partner.findFirst({
      where: { OR: duplicateConditions },
      select: { id: true },
    });
    if (duplicate) {
      throw new PartnerOnboardingError(
        "DUPLICATE_PARTNER",
        "A partner with this contact email or slug already exists."
      );
    }

    const safeRate = sanitizePercentage(input.commissionRate ?? 10.0, 10.0);

    const partner = await client.partner.create({
      data: {
        partnerId,
        code,
        slug: cleanSlug,
        passwordHash: null,
        tempPasswordHash: null,
        setupToken: credential.token,
        setupTokenExpires: credential.expiresAt,
        mustChangePassword: true,
        name: input.name.trim(),
        tagline: input.tagline?.trim(),
        badgeText: input.badgeText?.trim() || "Official Partner",
        description: input.description?.trim(),
        type: input.type,
        contactName: input.contactName?.trim(),
        contactEmail,
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

    await PartnerAuditService.logEvent({
      action: "PARTNER_ACCOUNT_CREATED",
      partnerId: partner.id,
      actorId: input.adminUserId,
      actorRole: "ADMIN",
      metadata: { partnerId: partner.partnerId, name: partner.name, email: partner.contactEmail },
    }, client);

    return partner;
  }

  private static async sendSetupInvitationAfterCommit(
    partner: {
      id: string;
      partnerId: string | null;
      code: string;
      name: string;
      contactEmail: string | null;
    },
    setupToken: string,
    adminUserId?: string
  ): Promise<PartnerSetupDeliveryStatus> {
    if (!partner.contactEmail) return "FAILED";

    let deliveryStatus: PartnerSetupDeliveryStatus = "FAILED";
    try {
      deliveryStatus = await sendPartnerSetupEmail({
        toEmail: partner.contactEmail,
        partnerName: partner.name,
        partnerId: partner.partnerId || partner.code,
        setupToken,
      });
    } catch {
      console.error("[PARTNER_SETUP_EMAIL_ERROR] Email delivery failed after partner creation.");
    }

    if (deliveryStatus === "SENT") {
      await this.recordPostCommitAudit({
        action: "PARTNER_INVITED",
        partnerId: partner.id,
        actorId: adminUserId,
        actorRole: "ADMIN",
        metadata: { partnerId: partner.partnerId, email: partner.contactEmail },
      });
    }

    return deliveryStatus;
  }

  static async createPartner(input: CreatePartnerInput) {
    const credential = createPartnerSetupCredential();
    const partner = await prisma.$transaction(
      (tx) => this.createPartnerRecord(input, tx, credential),
      {
        isolationLevel: "Serializable",
        timeout: 25000,
        maxWait: 15000,
      }
    );

    const deliveryStatus = await this.sendSetupInvitationAfterCommit(
      partner,
      credential.token,
      input.adminUserId
    );

    return {
      ...sanitizePartnerOnboardingPartner(partner),
      deliveryStatus,
    };
  }

  static async approvePartnerApplication(params: {
    applicationId: string;
    commissionRate: number;
    customSlug?: string;
    adminNotes?: string;
    adminUserId: string;
  }) {
    const credential = createPartnerSetupCredential();
    const result = await prisma.$transaction(
      async (tx) => {
        const application = await tx.partnerApplication.findUnique({
          where: { id: params.applicationId },
        });
        if (!application) {
          throw new PartnerOnboardingError("NOT_FOUND", "Application not found.");
        }
        if (application.status !== "PENDING" || application.createdPartnerId) {
          throw new PartnerOnboardingError(
            "CONFLICT",
            "This application has already been processed."
          );
        }

        const claimed = await tx.partnerApplication.updateMany({
          where: {
            id: application.id,
            status: "PENDING",
            createdPartnerId: null,
          },
          data: {
            status: "APPROVED",
            adminNotes: params.adminNotes || undefined,
            reviewedBy: params.adminUserId,
            reviewedAt: new Date(),
          },
        });
        if (claimed.count !== 1) {
          throw new PartnerOnboardingError(
            "CONFLICT",
            "This application changed while it was being approved."
          );
        }

        const partner = await this.createPartnerRecord(
          {
            name: application.organizationName,
            slug: params.customSlug || application.proposedSlug || undefined,
            type: application.type as PartnerType,
            contactName: application.applicantName,
            contactEmail: application.email,
            contactPhone: application.phone || undefined,
            commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
            commissionRate: params.commissionRate,
            holdingPeriodDays: 7,
            minPayoutCentavos: 15000,
            tagline: "Official Partner for 2026 Civil Service Review",
            badgeText: "Official Partner",
            notes: `Approved from online application (${application.id}). Social: ${application.socialUrl}`,
            adminUserId: params.adminUserId,
          },
          tx,
          credential
        );

        await tx.partnerApplication.update({
          where: { id: application.id },
          data: { createdPartnerId: partner.id },
        });

        return { partner };
      },
      {
        isolationLevel: "Serializable",
        timeout: 25000,
        maxWait: 15000,
      }
    );

    const deliveryStatus = await this.sendSetupInvitationAfterCommit(
      result.partner,
      credential.token,
      params.adminUserId
    );

    return {
      partner: sanitizePartnerOnboardingPartner(result.partner),
      deliveryStatus,
    };
  }

  static async resendPartnerSetupLink(params: {
    partnerId: string;
    adminUserId: string;
  }) {
    const result = await executePartnerSetupResend(params.partnerId, {
      findPartner: (partnerId) =>
        prisma.partner.findUnique({
          where: { id: partnerId },
          select: {
            id: true,
            partnerId: true,
            code: true,
            name: true,
            status: true,
            contactEmail: true,
            passwordHash: true,
            tempPasswordHash: true,
            setupToken: true,
          },
        }),
      rotateSetupToken: async ({
        partnerId,
        expectedSetupToken,
        nextSetupToken,
        setupTokenExpires,
      }) => {
        const rotated = await prisma.partner.updateMany({
          where: {
            id: partnerId,
            passwordHash: null,
            tempPasswordHash: null,
            status: { in: [...ELIGIBLE_PARTNER_SETUP_STATUSES] },
            setupToken: expectedSetupToken,
          },
          data: {
            setupToken: nextSetupToken,
            setupTokenExpires,
            mustChangePassword: true,
          },
        });
        return rotated.count === 1;
      },
      deliverSetupEmail: sendPartnerSetupEmail,
    });

    await this.recordPostCommitAudit({
      action: "PARTNER_INVITED",
      partnerId: result.partnerId,
      actorId: params.adminUserId,
      actorRole: "ADMIN",
      reason: "Partner setup token rotated",
      metadata: {
        partnerId: result.displayPartnerId,
        resent: true,
        tokenRotated: true,
        deliveryStatus: result.deliveryStatus,
      },
    });

    return result;
  }

  /**
   * Activates partner account via secure one-time setup token.
   */
  static async activatePartnerWithSetupToken(params: {
    token: string;
    password: string;
    ipAddress?: string;
  }// eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ success: boolean; partner?: any; error?: string }> {
    const { token, password, ipAddress } = params;
    if (!token || !password) {
      return { success: false, error: "Setup token and password are required." };
    }

    if (password.length < 8) {
      return { success: false, error: "Password must be at least 8 characters long." };
    }

    const lookupTime = new Date();
    const partner = await prisma.partner.findFirst({
      where: {
        setupToken: token,
        setupTokenExpires: { gt: lookupTime },
        status: { in: [...ELIGIBLE_PARTNER_SETUP_STATUSES] },
        passwordHash: null,
        tempPasswordHash: null,
      },
      select: { id: true },
    });

    if (!partner) {
      return {
        success: false,
        error: "This setup link is invalid or has expired. Please contact GovStudyX Admin.",
      };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const consumptionTime = new Date();

    const consumed = await prisma.partner.updateMany({
      where: {
        id: partner.id,
        setupToken: token,
        setupTokenExpires: { gt: consumptionTime },
        status: { in: [...ELIGIBLE_PARTNER_SETUP_STATUSES] },
        passwordHash: null,
        tempPasswordHash: null,
      },
      data: {
        passwordHash,
        setupToken: null,
        setupTokenExpires: null,
        tempPasswordHash: null,
        mustChangePassword: false,
        status: "ACTIVE",
      },
    });

    if (consumed.count !== 1) {
      return {
        success: false,
        error: "This setup link is invalid or has expired. Please contact GovStudyX Admin.",
      };
    }

    const updated = await prisma.partner.findUnique({
      where: { id: partner.id },
      select: {
        id: true,
        partnerId: true,
        code: true,
        name: true,
        status: true,
      },
    });
    if (!updated) {
      return { success: false, error: "Partner account could not be loaded after setup." };
    }

    await PartnerAuditService.logEvent({
      action: "PARTNER_ACTIVATED",
      partnerId: updated.id,
      actorId: updated.id,
      actorRole: "PARTNER",
      ipAddress,
      metadata: { partnerId: updated.partnerId },
    });

    return { success: true, partner: updated };
  }

  /**
   * Updates partner commission rates with historical versioning (preserving past rates).
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

    // Fire real-time commission alert email (non-blocking)
    if (partner.contactEmail) {
      const txn = await prisma.transaction.findUnique({
        where: { id: params.transactionId },
        select: { planType: true },
      }).catch(() => null);

      sendPartnerCommissionAlertEmail({
        toEmail: partner.contactEmail,
        partnerName: partner.name,
        commissionPesos: formatCentavosToPesos(calc.commissionAmountCentavos),
        purchasePesos: formatCentavosToPesos(params.customerPaymentCentavos),
        planType: txn?.planType || "Premium",
        campaignSource: effectiveSource,
        dashboardUrl: `${getSiteUrl()}/partner-portal/dashboard`,
      }).catch((err) =>
        console.error("[PARTNER_COMMISSION_EMAIL_ERROR]", err)
      );
    }

    return commission;
  }

  /**
   * Adds or updates a payout method profile for a partner.
   */
  static async addPayoutProfile(input: AddPayoutProfileInput) {
    const _partner = await prisma.partner.findUnique({
      where: { id: input.partnerId },
    });
    if (!_partner) throw new Error("Partner not found");
    const trimmedAcc = input.accountNumber.trim();
    let encryptedAcc: string;
    try {
      const enc = encrypt(trimmedAcc);
      if (!enc || enc === trimmedAcc) {
        throw new Error("Encryption failed");
      }
      encryptedAcc = enc;
    } catch {
      throw new Error("Unable to securely process account number for payout profile.");
    }

    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.partnerPayoutProfile.updateMany({
          where: { partnerId: input.partnerId },
          data: { isDefault: false },
        });
      }

      const existingProfilesCount = await tx.partnerPayoutProfile.count({
        where: { partnerId: input.partnerId },
      });

      const profile = await tx.partnerPayoutProfile.create({
        data: {
          partnerId: input.partnerId,
          method: input.method,
          accountHolderName: input.accountHolderName.trim(),
          accountNumberEncrypted: encryptedAcc,
          bankName: input.bankName ? input.bankName.trim() : null,
          accountType: input.accountType ? input.accountType.trim() : null,
          isDefault: input.isDefault ?? existingProfilesCount === 0,
          status: "VERIFIED",
        },
      });

      await PartnerAuditService.logEvent({
        action: "PARTNER_PAYOUT_METHOD_ADDED",
        partnerId: input.partnerId,
        metadata: {
          method: input.method,
          accountHolderName: input.accountHolderName,
          maskedAccount: this.maskAccountNumber(input.accountNumber, input.method),
          isDefault: profile.isDefault,
        },
      }, tx);

      return profile;
    }, { timeout: 25000, maxWait: 15000 });
  }

  /**
   * Sets a verified payout profile as the partner's default payout method.
   */
  static async setDefaultPayoutProfile(partnerId: string, profileId: string) {
    return prisma.$transaction(async (tx) => {
      const profile = await tx.partnerPayoutProfile.findFirst({
        where: { id: profileId, partnerId },
      });
      if (!profile) throw new Error("Payout profile not found or does not belong to partner.");

      await tx.partnerPayoutProfile.updateMany({
        where: { partnerId },
        data: { isDefault: false },
      });

      const updated = await tx.partnerPayoutProfile.update({
        where: { id: profileId },
        data: { isDefault: true },
      });

      await PartnerAuditService.logEvent({
        action: "PARTNER_DEFAULT_PAYOUT_METHOD_CHANGED",
        partnerId,
        metadata: { method: updated.method, profileId },
      }, tx);

      return updated;
    }, { timeout: 25000, maxWait: 15000 });
  }

  /**
   * Retrieves decrypted and masked payout profiles for a partner.
   */
  static async listPayoutProfiles(partnerId: string) {
    const profiles = await prisma.partnerPayoutProfile.findMany({
      where: { partnerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return profiles.map((p) => {
      let rawAcc = "";
      try {
        rawAcc = decrypt(p.accountNumberEncrypted) || p.accountNumberEncrypted;
      } catch {
        rawAcc = p.accountNumberEncrypted;
      }

      return {
        id: p.id,
        method: p.method,
        accountHolderName: p.accountHolderName,
        accountNumberMasked: this.maskAccountNumber(rawAcc, p.method),
        bankName: p.bankName,
        accountType: p.accountType,
        isDefault: p.isDefault,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      };
    });
  }

  /**
   * Generates partner financial overview metrics with authoritative server-side calculation.
   */
  static async getPartnerFinancialOverview(partnerId: string) {
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        payoutProfiles: { orderBy: { isDefault: "desc" } },
      },
    });

    if (!partner) throw new Error("Partner not found");

    const now = new Date();

    const [commissions, payouts, totalAttributionsCount] = await Promise.all([
      prisma.partnerCommission.findMany({
        where: { partnerId: partner.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.partnerPayout.findMany({
        where: { partnerId: partner.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.partnerAttribution.count({
        where: { partnerId: partner.id },
      }),
    ]);

    let qualifyingSalesCentavos = 0;
    let totalCommissionCentavos = 0;
    let availableCommissionCentavos = 0;
    let pendingCommissionCentavos = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let paidCommissionCentavos = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let reversedCommissionCentavos = 0;

    const channelMap: Record<
      string,
      { count: number; revenueCentavos: number; commissionCentavos: number }
    > = {};

    commissions.forEach((c) => {
      qualifyingSalesCentavos += c.purchaseAmountCentavos;

      const src = c.campaignSource || "direct";
      if (!channelMap[src]) {
        channelMap[src] = { count: 0, revenueCentavos: 0, commissionCentavos: 0 };
      }
      channelMap[src].count += 1;
      channelMap[src].revenueCentavos += c.purchaseAmountCentavos;
      channelMap[src].commissionCentavos += c.commissionAmountCentavos;

      if (c.status === "PAID") {
        totalCommissionCentavos += c.commissionAmountCentavos;
        paidCommissionCentavos += c.commissionAmountCentavos;
      } else if (
        c.status === "AVAILABLE" ||
        (c.status === "PENDING" && c.holdingUntil && c.holdingUntil <= now)
      ) {
        totalCommissionCentavos += c.commissionAmountCentavos;
        availableCommissionCentavos += c.commissionAmountCentavos;
      } else if (c.status === "PENDING") {
        totalCommissionCentavos += c.commissionAmountCentavos;
        pendingCommissionCentavos += c.commissionAmountCentavos;
      } else if (c.status === "REVERSED" || c.status === "CANCELLED") {
        reversedCommissionCentavos += c.commissionAmountCentavos;
      }
    });

    let reservedForPayoutCentavos = 0;
    let totalPaidPayoutsCentavos = 0;

    payouts.forEach((p) => {
      if (p.status === "PAID") {
        totalPaidPayoutsCentavos += p.amountCentavos;
      } else if (
        p.status === "REQUESTED" ||
        p.status === "RESERVED" ||
        p.status === "UNDER_REVIEW" ||
        p.status === "APPROVED" ||
        p.status === "PROCESSING"
      ) {
        reservedForPayoutCentavos += p.amountCentavos;
      }
    });

    const netAvailableCentavos = Math.max(
      0,
      availableCommissionCentavos - reservedForPayoutCentavos
    );

    const outstandingBalanceCentavos = netAvailableCentavos;

    const channelBreakdown = Object.entries(channelMap).map(([channel, data]) => ({
      channel,
      count: data.count,
      revenueCentavos: data.revenueCentavos,
      commissionCentavos: data.commissionCentavos,
      formattedRevenue: formatCentavosToPesos(data.revenueCentavos),
      formattedCommission: formatCentavosToPesos(data.commissionCentavos),
    }));

    const displayPartnerId = partner.partnerId || partner.code;

    return {
      partner: {
        id: partner.id,
        partnerId: displayPartnerId,
        code: partner.code,
        slug: partner.slug,
        name: partner.name,
        type: partner.type,
        status: partner.status,
        contactEmail: partner.contactEmail,
        contactName: partner.contactName,
        contactPhone: partner.contactPhone,
        tagline: partner.tagline,
        badgeText: partner.badgeText,
        commissionModel: partner.commissionModel,
        commissionRate: partner.commissionRate,
        holdingPeriodDays: partner.holdingPeriodDays,
        minPayoutCentavos: partner.minPayoutCentavos,
        agreementStart: partner.agreementStart.toISOString(),
        agreementEnd: partner.agreementEnd ? partner.agreementEnd.toISOString() : null,
      },
      metrics: {
        qualifyingSalesCentavos,
        formattedQualifyingSales: formatCentavosToPesos(qualifyingSalesCentavos),
        totalSalesCount: commissions.length,
        totalAttributionsCount,

        totalCommissionCentavos,
        formattedTotalCommission: formatCentavosToPesos(totalCommissionCentavos),

        pendingCommissionCentavos,
        formattedPendingCommission: formatCentavosToPesos(pendingCommissionCentavos),

        availableCommissionCentavos: netAvailableCentavos,
        formattedAvailableCommission: formatCentavosToPesos(netAvailableCentavos),

        reservedForPayoutCentavos,
        formattedReservedForPayout: formatCentavosToPesos(reservedForPayoutCentavos),

        totalPaidCentavos: totalPaidPayoutsCentavos,
        formattedTotalPaid: formatCentavosToPesos(totalPaidPayoutsCentavos),

        outstandingBalanceCentavos,
        formattedOutstandingBalance: formatCentavosToPesos(outstandingBalanceCentavos),

        minPayoutCentavos: partner.minPayoutCentavos,
        formattedMinPayout: formatCentavosToPesos(partner.minPayoutCentavos),
        canRequestPayout: netAvailableCentavos >= (partner.minPayoutCentavos || 15000),
      },
      channelBreakdown,
      referralLink: `${getSiteUrl()}/p/${partner.slug || displayPartnerId}`,
    };
  }

  /**
   * Atomically verifies partner balance and creates a payout request within a single transaction,
   * reserving funds immediately to prevent concurrent double-withdrawal race conditions.
   */
  static async requestPayoutAtomic(params: {
    partnerId: string;
    requestedAmountCentavos: number;
    method?: PayoutMethod;
    accountNumber?: string;
    accountName?: string;
    bankName?: string | null;
    profileId?: string;
    ipAddress?: string;
    idempotencyContext?: {
      idempotencyKey: string;
      requestHash: string;
    };
  }) {
    const {
      partnerId,
      requestedAmountCentavos,
      method,
      accountNumber,
      accountName,
      bankName,
      profileId,
      ipAddress,
      idempotencyContext,
    } = params;

    try {
      return await prisma.$transaction(async (tx) => {
        // 🔒 Level 0: Acquire idempotency lock and check existing record if key is supplied
        if (idempotencyContext) {
          await IdempotencyService.acquireIdempotencyLock(
            tx,
            partnerId,
            "PARTNER_PAYOUT_REQUEST",
            idempotencyContext.idempotencyKey
          );

          const existingRecord = await IdempotencyService.findAuthoritativeIdempotencyRecord(
            tx,
            partnerId,
            "PARTNER_PAYOUT_REQUEST",
            idempotencyContext.idempotencyKey
          );

          if (existingRecord) {
            if (existingRecord.requestHash !== idempotencyContext.requestHash) {
              throw new IdempotencyDomainError(
                "IDEMPOTENCY_PAYLOAD_MISMATCH",
                "Idempotency key was previously used with a different request.",
                409
              );
            }

            const existingPayout = await tx.partnerPayout.findFirst({
              where: { id: existingRecord.resourceId, partnerId },
            });

            if (!existingPayout) {
              throw new IdempotencyDomainError(
                "IDEMPOTENCY_RESOURCE_NOT_FOUND",
                "Referenced partner payout record not found or does not belong to partner.",
                500
              );
            }

            return {
              payout: existingPayout,
              remainingBalanceCentavos: 0,
              isReplay: true,
            };
          }
        }

        // 🔒 Level 1: Acquire transaction-scoped advisory lock on partner-finance domain to serialize concurrent payout requests
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`partner-finance:${partnerId}`}, 0)
          )::text AS lock_result
        `;

        const partner = await tx.partner.findUnique({
          where: { id: partnerId },
        });

        if (!partner || partner.status !== "ACTIVE") {
          throw new Error("Partner account is not active or does not exist.");
        }

        const minPayout = partner.minPayoutCentavos || 15000;
        if (requestedAmountCentavos < minPayout) {
          throw new Error(
            `Requested amount is below minimum payout threshold of ${formatCentavosToPesos(minPayout)}.`
          );
        }

        const now = new Date();

        // Query active commissions and payouts inside the transaction
        const [commissions, existingPayouts] = await Promise.all([
          tx.partnerCommission.findMany({
            where: { partnerId: partner.id },
          }),
          tx.partnerPayout.findMany({
            where: { partnerId: partner.id },
          }),
        ]);

        let availableCentavos = 0;
        commissions.forEach((c) => {
          if (
            c.status === "AVAILABLE" ||
            (c.status === "PENDING" && c.holdingUntil && c.holdingUntil <= now)
          ) {
            availableCentavos += c.commissionAmountCentavos;
          }
        });

        let alreadyReservedOrPaidCentavos = 0;
        existingPayouts.forEach((p) => {
          if (
            p.status === "PAID" ||
            p.status === "REQUESTED" ||
            p.status === "RESERVED" ||
            p.status === "UNDER_REVIEW" ||
            p.status === "APPROVED" ||
            p.status === "PROCESSING"
          ) {
            alreadyReservedOrPaidCentavos += p.amountCentavos;
          }
        });

        const trueAvailableCentavos = Math.max(
          0,
          availableCentavos - alreadyReservedOrPaidCentavos
        );

        if (requestedAmountCentavos > trueAvailableCentavos) {
          throw new Error(
            `Insufficient available balance. You currently have ${formatCentavosToPesos(
              trueAvailableCentavos
            )} available for withdrawal.`
          );
        }

        let resolvedMethod: PayoutMethod = method || "GCASH";
        let resolvedAccountName = accountName;
        let resolvedAccountNumber = accountNumber;
        let resolvedBankName = bankName;

        if (profileId) {
          const profile = await tx.partnerPayoutProfile.findUnique({
            where: { id: profileId },
          });

          if (!profile || profile.partnerId !== partner.id) {
            throw new Error("Invalid payout profile selected.");
          }

          resolvedMethod = profile.method;
          resolvedAccountName = profile.accountHolderName;
          resolvedBankName = profile.bankName;

          try {
            const dec = decrypt(profile.accountNumberEncrypted);
            resolvedAccountNumber = dec || profile.accountNumberEncrypted;
          } catch {
            resolvedAccountNumber = profile.accountNumberEncrypted;
          }
        }

        if (!resolvedAccountNumber || !resolvedAccountName) {
          throw new Error("Account name and number are required for payout.");
        }

        // Encrypt account number securely (fail closed)
        const trimmedAcc = resolvedAccountNumber.trim();
        let encryptedAcc: string;
        try {
          const encResult = encrypt(trimmedAcc);
          if (!encResult || encResult === trimmedAcc) {
            throw new Error("Encryption failed");
          }
          encryptedAcc = encResult;
        } catch {
          throw new Error("Unable to securely process account number for payout.");
        }

        const payout = await tx.partnerPayout.create({
          data: {
            partnerId: partner.id,
            amountCentavos: requestedAmountCentavos,
            currency: "PHP",
            method: resolvedMethod,
            accountNumberEncrypted: encryptedAcc,
            accountName: resolvedAccountName.trim(),
            bankName: resolvedBankName ? resolvedBankName.trim() : null,
            status: "RESERVED",
          },
        });

        // Audit log payout reservation
        await PartnerAuditService.logEvent({
          action: "PARTNER_PAYOUT_REQUESTED",
          partnerId: partner.id,
          amountCentavos: requestedAmountCentavos,
          actorId: partner.id,
          actorRole: "PARTNER",
          ipAddress,
          metadata: {
            payoutId: payout.id,
            method: resolvedMethod,
            maskedAccount: this.maskAccountNumber(resolvedAccountNumber, resolvedMethod),
            requestedAmountPesos: formatCentavosToPesos(requestedAmountCentavos),
          },
        }, tx);

        await PartnerAuditService.logEvent({
          action: "PARTNER_PAYOUT_RESERVED",
          partnerId: partner.id,
          amountCentavos: requestedAmountCentavos,
          actorId: "SYSTEM",
          actorRole: "SYSTEM",
          metadata: { payoutId: payout.id, status: "RESERVED" },
        }, tx);

        // Persist durable FinancialIdempotencyKey record inside same transaction
        if (idempotencyContext) {
          await IdempotencyService.recordFinancialIdempotency(tx, {
            actorId: partnerId,
            operationType: "PARTNER_PAYOUT_REQUEST",
            idempotencyKey: idempotencyContext.idempotencyKey,
            requestHash: idempotencyContext.requestHash,
            resourceId: payout.id,
          });
        }

        return {
          payout,
          remainingBalanceCentavos: trueAvailableCentavos - requestedAmountCentavos,
          isReplay: false,
        };
      }, { timeout: 25000, maxWait: 15000 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err instanceof IdempotencyDomainError) {
        throw err;
      }

      // Defensive composite idempotency P2002 recovery from outside aborted transaction
      if (idempotencyContext && IdempotencyService.isIdempotencyCompositeP2002(err)) {
        const fallbackRecord = await IdempotencyService.findAuthoritativeIdempotencyRecord(
          prisma,
          partnerId,
          "PARTNER_PAYOUT_REQUEST",
          idempotencyContext.idempotencyKey
        );

        if (fallbackRecord) {
          if (fallbackRecord.requestHash !== idempotencyContext.requestHash) {
            throw new IdempotencyDomainError(
              "IDEMPOTENCY_PAYLOAD_MISMATCH",
              "Idempotency key was previously used with a different request.",
              409
            );
          }

          const existingPayout = await prisma.partnerPayout.findFirst({
            where: { id: fallbackRecord.resourceId, partnerId },
          });

          if (!existingPayout) {
            throw new IdempotencyDomainError(
              "IDEMPOTENCY_RESOURCE_NOT_FOUND",
              "Referenced partner payout record not found or does not belong to partner.",
              500
            );
          }

          return {
            payout: existingPayout,
            remainingBalanceCentavos: 0,
            isReplay: true,
          };
        } else {
          throw new IdempotencyDomainError(
            "IDEMPOTENCY_INCONSISTENT_STATE",
            "Idempotency record is in an inconsistent state.",
            500
          );
        }
      }

      throw err;
    }
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
      } else if (
        c.status === "AVAILABLE" ||
        (c.status === "PENDING" && c.holdingUntil && c.holdingUntil <= now)
      ) {
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
        partnerId: partner.partnerId || partner.code,
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
      payouts: partner.payouts.map((p) => {
        let rawAcc = "";
        try {
          rawAcc = decrypt(p.accountNumberEncrypted) || p.accountNumberEncrypted;
        } catch {
          rawAcc = p.accountNumberEncrypted;
        }
        return {
          id: p.id,
          amountCentavos: p.amountCentavos,
          formattedAmount: formatCentavosToPesos(p.amountCentavos),
          method: p.method,
          accountName: p.accountName,
          accountNumberMasked: this.maskAccountNumber(rawAcc, p.method),
          bankName: p.bankName,
          status: p.status,
          transactionRef: p.transactionRef,
          createdAt: p.createdAt.toISOString(),
        };
      }),
      rateHistory: partner.rateHistory,
    };
  }
}
