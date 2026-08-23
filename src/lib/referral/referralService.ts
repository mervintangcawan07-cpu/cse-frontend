// Relative Path: src/lib/referral/referralService.ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_REFERRAL_CONFIG, REFERRAL_SETTING_KEYS } from "./config";
import {
  AdminAnalyticsSummary,
  AdminReferralFilterParams,
  AdminReferralItem,
  PayoutMethod,
  PayoutStatus,
  ReferralProgramConfig,
  ReferralRewardType,
  ReferralStatus,
  RewardLedgerStatus,
  UserPayoutHistoryItem,
  UserReferralDashboardData,
  UserReferralHistoryItem,
  UserReferralStats,
} from "./types";
import { generateReferralCode, isValidReferralCodeFormat, normalizeReferralCode } from "./codeGenerator";
import { calculateReferralReward, formatCentavosToPesos, sanitizeRewardPercentage } from "./rewardCalculator";
import { evaluateReferralFraud } from "./fraudEngine";
import { createNotification } from "@/lib/notifications";
import { encrypt, decrypt } from "@/lib/crypto/encryption";
import { siteConfig, getSiteUrl } from "@/lib/config/site";
import { IdempotencyService, IdempotencyDomainError } from "@/lib/accounting/idempotencyService";

export class ReferralService {
  /**
   * 1. GET SYSTEM CONFIGURATION
   * Fetches latest configuration from DB with fallback to defaults.
   */
  public static async getProgramConfig(): Promise<ReferralProgramConfig> {
    try {
      const settings = await prisma.referralProgramSetting.findMany();
      const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

      const programEnabled = settingsMap.has(REFERRAL_SETTING_KEYS.PROGRAM_ENABLED)
        ? settingsMap.get(REFERRAL_SETTING_KEYS.PROGRAM_ENABLED) === "true"
        : DEFAULT_REFERRAL_CONFIG.programEnabled;

      const rewardType = (settingsMap.get(REFERRAL_SETTING_KEYS.REWARD_TYPE) ||
        DEFAULT_REFERRAL_CONFIG.rewardType) as ReferralRewardType;

      const rawPercentage = settingsMap.get(REFERRAL_SETTING_KEYS.REWARD_PERCENTAGE);
      const rewardPercentage = rawPercentage
        ? sanitizeRewardPercentage(parseFloat(rawPercentage), DEFAULT_REFERRAL_CONFIG.rewardPercentage)
        : DEFAULT_REFERRAL_CONFIG.rewardPercentage;

      const fixedRewardAmountCentavos = settingsMap.has(REFERRAL_SETTING_KEYS.FIXED_REWARD_AMOUNT_CENTAVOS)
        ? parseInt(settingsMap.get(REFERRAL_SETTING_KEYS.FIXED_REWARD_AMOUNT_CENTAVOS) || "5000", 10)
        : DEFAULT_REFERRAL_CONFIG.fixedRewardAmountCentavos;

      const holdingPeriodDays = settingsMap.has(REFERRAL_SETTING_KEYS.HOLDING_PERIOD_DAYS)
        ? Math.max(0, parseInt(settingsMap.get(REFERRAL_SETTING_KEYS.HOLDING_PERIOD_DAYS) || "7", 10))
        : DEFAULT_REFERRAL_CONFIG.holdingPeriodDays;

      const minPayoutAmountCentavos = settingsMap.has(REFERRAL_SETTING_KEYS.MIN_PAYOUT_AMOUNT_CENTAVOS)
        ? Math.max(0, parseInt(settingsMap.get(REFERRAL_SETTING_KEYS.MIN_PAYOUT_AMOUNT_CENTAVOS) || "15000", 10))
        : DEFAULT_REFERRAL_CONFIG.minPayoutAmountCentavos;

      const attributionWindowDays = settingsMap.has(REFERRAL_SETTING_KEYS.ATTRIBUTION_WINDOW_DAYS)
        ? Math.max(1, parseInt(settingsMap.get(REFERRAL_SETTING_KEYS.ATTRIBUTION_WINDOW_DAYS) || "30", 10))
        : DEFAULT_REFERRAL_CONFIG.attributionWindowDays;

      const maxDailyReferrals = settingsMap.has(REFERRAL_SETTING_KEYS.MAX_DAILY_REFERRALS)
        ? parseInt(settingsMap.get(REFERRAL_SETTING_KEYS.MAX_DAILY_REFERRALS) || "50", 10)
        : DEFAULT_REFERRAL_CONFIG.maxDailyReferrals;

      const maxMonthlyReferrals = settingsMap.has(REFERRAL_SETTING_KEYS.MAX_MONTHLY_REFERRALS)
        ? parseInt(settingsMap.get(REFERRAL_SETTING_KEYS.MAX_MONTHLY_REFERRALS) || "500", 10)
        : DEFAULT_REFERRAL_CONFIG.maxMonthlyReferrals;

      const maxMonthlyRewardCentavos = settingsMap.has(REFERRAL_SETTING_KEYS.MAX_MONTHLY_REWARD_CENTAVOS)
        ? parseInt(settingsMap.get(REFERRAL_SETTING_KEYS.MAX_MONTHLY_REWARD_CENTAVOS) || "1000000", 10)
        : DEFAULT_REFERRAL_CONFIG.maxMonthlyRewardCentavos;

      const requireAdminPayoutApproval = settingsMap.has(REFERRAL_SETTING_KEYS.REQUIRE_ADMIN_PAYOUT_APPROVAL)
        ? settingsMap.get(REFERRAL_SETTING_KEYS.REQUIRE_ADMIN_PAYOUT_APPROVAL) === "true"
        : DEFAULT_REFERRAL_CONFIG.requireAdminPayoutApproval;

      const leaderboardEnabled = settingsMap.has(REFERRAL_SETTING_KEYS.LEADERBOARD_ENABLED)
        ? settingsMap.get(REFERRAL_SETTING_KEYS.LEADERBOARD_ENABLED) === "true"
        : DEFAULT_REFERRAL_CONFIG.leaderboardEnabled;

      return {
        programEnabled,
        rewardType,
        rewardPercentage,
        fixedRewardAmountCentavos,
        holdingPeriodDays,
        minPayoutAmountCentavos,
        attributionWindowDays,
        maxDailyReferrals,
        maxMonthlyReferrals,
        maxMonthlyRewardCentavos,
        requireAdminPayoutApproval,
        leaderboardEnabled,
      };
    } catch (error) {
      console.error("[ReferralService.getProgramConfig] Error:", error);
      return DEFAULT_REFERRAL_CONFIG;
    }
  }

  /**
   * 2. UPDATE SYSTEM CONFIGURATION (ADMIN ONLY)
   * Updates settings and records immutable audit log.
   */
  public static async updateProgramConfig(params: {
    config: Partial<ReferralProgramConfig>;
    adminUserId: string;
    clientIp?: string;
  }): Promise<ReferralProgramConfig> {
    const currentConfig = await this.getProgramConfig();
    const newConfig: ReferralProgramConfig = {
      ...currentConfig,
      ...params.config,
    };

    // Sanitize percentage
    if (params.config.rewardPercentage !== undefined) {
      newConfig.rewardPercentage = sanitizeRewardPercentage(params.config.rewardPercentage, 20.0);
    }

    const updates = [
      { key: REFERRAL_SETTING_KEYS.PROGRAM_ENABLED, value: String(newConfig.programEnabled), desc: "Referral program master toggle" },
      { key: REFERRAL_SETTING_KEYS.REWARD_TYPE, value: newConfig.rewardType, desc: "Default reward type (PERCENTAGE / FIXED_AMOUNT)" },
      { key: REFERRAL_SETTING_KEYS.REWARD_PERCENTAGE, value: String(newConfig.rewardPercentage), desc: "Default reward percentage" },
      { key: REFERRAL_SETTING_KEYS.FIXED_REWARD_AMOUNT_CENTAVOS, value: String(newConfig.fixedRewardAmountCentavos), desc: "Fixed reward amount in centavos" },
      { key: REFERRAL_SETTING_KEYS.HOLDING_PERIOD_DAYS, value: String(newConfig.holdingPeriodDays), desc: "Holding period in days before available" },
      { key: REFERRAL_SETTING_KEYS.MIN_PAYOUT_AMOUNT_CENTAVOS, value: String(newConfig.minPayoutAmountCentavos), desc: "Minimum payout amount in centavos" },
      { key: REFERRAL_SETTING_KEYS.ATTRIBUTION_WINDOW_DAYS, value: String(newConfig.attributionWindowDays), desc: "Attribution window in days" },
      { key: REFERRAL_SETTING_KEYS.MAX_DAILY_REFERRALS, value: String(newConfig.maxDailyReferrals), desc: "Max referrals per day per user" },
      { key: REFERRAL_SETTING_KEYS.MAX_MONTHLY_REFERRALS, value: String(newConfig.maxMonthlyReferrals), desc: "Max referrals per month per user" },
      { key: REFERRAL_SETTING_KEYS.MAX_MONTHLY_REWARD_CENTAVOS, value: String(newConfig.maxMonthlyRewardCentavos), desc: "Max reward per month in centavos" },
      { key: REFERRAL_SETTING_KEYS.REQUIRE_ADMIN_PAYOUT_APPROVAL, value: String(newConfig.requireAdminPayoutApproval), desc: "Require manual admin payout approval" },
      { key: REFERRAL_SETTING_KEYS.LEADERBOARD_ENABLED, value: String(newConfig.leaderboardEnabled), desc: "Referral leaderboard toggle" },
    ];

    await prisma.$transaction(async (tx) => {
      for (const item of updates) {
        await tx.referralProgramSetting.upsert({
          where: { key: item.key },
          update: { value: item.value, updatedBy: params.adminUserId, updatedAt: new Date() },
          create: { key: item.key, value: item.value, description: item.desc, updatedBy: params.adminUserId },
        });
      }

      await tx.referralAuditLog.create({
        data: {
          actorId: params.adminUserId,
          actorRole: "ADMIN",
          action: "REFERRAL_SETTINGS_UPDATED",
          targetType: "SETTING",
          previousState: JSON.stringify(currentConfig),
          newState: JSON.stringify(newConfig),
          reason: "Admin updated referral program settings",
          ipAddress: params.clientIp,
        },
      });
    });

    return newConfig;
  }

  /**
   * 3. GET OR CREATE USER REFERRAL CODE
   * Ensures every registered user has a unique, collision-resistant code.
   */
  public static async getOrCreateReferralCode(userId: string): Promise<string> {
    const existing = await prisma.referralCode.findUnique({
      where: { userId },
      select: { code: true, isActive: true },
    });

    if (existing && existing.isActive) {
      return existing.code;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) throw new Error("User not found.");

    // Collision retry loop
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidateCode = generateReferralCode(user.name || user.email);
      try {
        const created = await prisma.referralCode.create({
          data: {
            userId,
            code: candidateCode,
            isActive: true,
          },
        });
        return created.code;
      } catch (err: any) {
        if (err?.code === "P2002") {
          // Unique collision, retry
          continue;
        }
        throw err;
      }
    }

    // Fallback: Use timestamp suffix
    const fallbackCode = `GSX-${Date.now().toString(36).toUpperCase()}`;
    const fallbackCreated = await prisma.referralCode.upsert({
      where: { userId },
      update: { code: fallbackCode, isActive: true },
      create: { userId, code: fallbackCode, isActive: true },
    });

    return fallbackCreated.code;
  }

  /**
   * 4. VALIDATE REFERRAL CODE (PUBLIC LANDING / SIGNUP PREVIEW)
   */
  public static async validateReferralCode(rawCode: string): Promise<{
    isValid: boolean;
    code: string;
    inviterName?: string;
    error?: string;
  }> {
    if (!rawCode) return { isValid: false, code: "", error: "Referral code is required" };
    const normalized = normalizeReferralCode(rawCode);

    if (!isValidReferralCodeFormat(normalized)) {
      return { isValid: false, code: normalized, error: "Invalid referral code format" };
    }

    const record = await prisma.referralCode.findUnique({
      where: { code: normalized },
      include: {
        user: { select: { id: true, name: true, isBanned: true } },
      },
    });

    if (!record || !record.isActive || record.user?.isBanned) {
      return { isValid: false, code: normalized, error: "Referral code does not exist or is inactive" };
    }

    return {
      isValid: true,
      code: normalized,
      inviterName: record.user.name || "A fellow GovStudyX student",
    };
  }

  /**
   * 5. RECORD ATTRIBUTION ON SIGNUP
   * Invoked atomically when a referred student creates an account.
   * Locks attribution permanently to prevent reassignment.
   */
  public static async recordAttributionOnSignup(params: {
    referredUserId: string;
    referralCodeString?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<{ success: boolean; referralId?: string; reason?: string }> {
    if (!params.referralCodeString) return { success: false, reason: "No referral code provided" };

    const normalized = normalizeReferralCode(params.referralCodeString);
    if (!isValidReferralCodeFormat(normalized)) {
      return { success: false, reason: "Invalid referral code format" };
    }

    const codeRecord = await prisma.referralCode.findUnique({
      where: { code: normalized },
      include: { user: { select: { id: true, email: true, isBanned: true } } },
    });

    if (!codeRecord || !codeRecord.isActive || codeRecord.user.isBanned) {
      return { success: false, reason: "Referral code is invalid or inactive" };
    }

    const inviterId = codeRecord.userId;
    const referredUserId = params.referredUserId;

    // Self-referral protection check
    if (inviterId === referredUserId) {
      return { success: false, reason: "Self-referral is not permitted" };
    }

    // Check if user already has attribution
    const existingAttribution = await prisma.referralAttribution.findUnique({
      where: { referredUserId },
    });

    if (existingAttribution) {
      return { success: false, reason: "Attribution already locked for this account" };
    }

    const config = await this.getProgramConfig();
    const expiresAt = new Date(Date.now() + config.attributionWindowDays * 24 * 60 * 60 * 1000);

    const referredUser = await prisma.user.findUnique({
      where: { id: referredUserId },
      select: { email: true, name: true },
    });

    // Fraud evaluation
    const fraudCheck = evaluateReferralFraud({
      inviterId,
      referredUserId,
      codeOwnerId: codeRecord.userId,
      inviterEmail: codeRecord.user.email,
      referredEmail: referredUser?.email,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    if (fraudCheck.isBlocked) {
      return { success: false, reason: fraudCheck.riskReasons.join(", ") };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Increment click/usage count on code
        await tx.referralCode.update({
          where: { id: codeRecord.id },
          data: { clickCount: { increment: 1 } },
        });

        // Create locked attribution record
        await tx.referralAttribution.create({
          data: {
            referredUserId,
            inviterId,
            referralCodeId: codeRecord.id,
            expiresAt,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
            isLocked: true,
          },
        });

        // Create Referral relationship in PENDING_PREMIUM status
        const referral = await tx.referral.create({
          data: {
            inviterId,
            referredUserId,
            referralCodeId: codeRecord.id,
            status: "PENDING_PREMIUM",
            riskLevel: fraudCheck.riskLevel,
            riskNotes: fraudCheck.riskReasons.length ? fraudCheck.riskReasons.join("; ") : null,
          },
        });

        // Audit log
        await tx.referralAuditLog.create({
          data: {
            actorId: referredUserId,
            actorRole: "USER",
            action: "REFERRAL_REGISTERED",
            targetType: "REFERRAL",
            targetId: referral.id,
            reason: `Referred by code ${normalized}`,
            ipAddress: params.ipAddress,
            metadata: {
              inviterId,
              referralCode: normalized,
              riskLevel: fraudCheck.riskLevel,
            },
          },
        });

        return referral;
      });

      // Notify inviter
      await createNotification({
        userId: inviterId,
        title: "👥 New Referral Sign Up!",
        message: `Someone joined GovStudyX using your referral link. You will earn a reward when they upgrade to PRO!`,
        type: "INFO",
      });

      return { success: true, referralId: result.id };
    } catch (err: any) {
      console.error("[ReferralService.recordAttributionOnSignup] Error:", err);
      return { success: false, reason: "Failed to record referral attribution" };
    }
  }

  /**
   * 6. QUALIFY REFERRAL PAYMENT & ACCRUE REWARD
   * Triggered by verified server-side payment (PayMongo Webhook / Verify Route).
   *
   * 🚨 CORE INVARIANTS:
   * - One qualifying payment generates at most ONE referral reward.
   * - Base amount = actual amount paid by customer in centavos (discount-aware).
   * - PayMongo processing fees are NOT deducted from reward calculation base.
   * - Effective rate & calculated amount are immutably stored in the financial ledger.
   * - 7-day holding period applied before moving to AVAILABLE.
   */
  public static async qualifyReferralPayment(params: {
    userId: string;
    transactionId: string;
    purchaseAmountCentavos: number;
    planType?: string;
  }): Promise<{ qualified: boolean; rewardAmountCentavos?: number; reason?: string }> {
    const { userId, transactionId, purchaseAmountCentavos } = params;

    if (purchaseAmountCentavos <= 0) {
      return { qualified: false, reason: "Non-positive purchase amount" };
    }

    // 1. Check if user has an active referral relationship
    const referral = await prisma.referral.findUnique({
      where: { referredUserId: userId },
      include: {
        inviter: { select: { id: true, name: true, email: true, isBanned: true } },
        reward: true,
      },
    });

    if (!referral) {
      return { qualified: false, reason: "No referral attribution for user" };
    }

    // 2. Check if already rewarded (Idempotency)
    if (referral.reward) {
      return {
        qualified: true,
        rewardAmountCentavos: referral.reward.rewardAmountCentavos,
        reason: "Referral reward already accrued for this relationship",
      };
    }

    // 3. Ensure transaction uniqueness
    const existingRewardForTxn = await prisma.referralReward.findUnique({
      where: { transactionId },
    });

    if (existingRewardForTxn) {
      return {
        qualified: true,
        rewardAmountCentavos: existingRewardForTxn.rewardAmountCentavos,
        reason: "Transaction already processed for referral reward",
      };
    }

    // 4. Load effective system config
    const config = await this.getProgramConfig();

    // 🚨 PROGRAM ACTIVE CHECK:
    // If program is disabled, mark referral but do not accrue financial rewards
    if (!config.programEnabled) {
      await prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: "QUALIFIED",
          qualifyingPaymentId: transactionId,
          qualifyingAmount: purchaseAmountCentavos,
          riskNotes: "Referral qualified while program was OFF; no reward accrued",
          qualifiedAt: new Date(),
        },
      });
      return { qualified: false, reason: "Referral program is currently disabled" };
    }

    // 5. Calculate reward with exact centavo math (PayMongo fees excluded from base)
    const calculation = calculateReferralReward({
      purchaseAmountCentavos,
      rewardType: config.rewardType,
      effectiveRate: config.rewardPercentage,
      fixedRewardAmountCentavos: config.fixedRewardAmountCentavos,
    });

    if (!calculation.isEligible || calculation.rewardAmountCentavos <= 0) {
      return { qualified: false, reason: "Reward calculation yielded 0 reward" };
    }

    // 6. Calculate holding period expiration
    const now = new Date();
    const holdingUntil = new Date(now.getTime() + config.holdingPeriodDays * 24 * 60 * 60 * 1000);

    // 7. Atomic DB ledger update
    try {
      const rewardRecord = await prisma.$transaction(async (tx) => {
        // Update Referral status to QUALIFIED / REWARD_PENDING
        await tx.referral.update({
          where: { id: referral.id },
          data: {
            status: "REWARD_PENDING",
            qualifyingPaymentId: transactionId,
            qualifyingAmount: purchaseAmountCentavos,
            effectiveRate: calculation.effectiveRate,
            rewardAmount: calculation.rewardAmountCentavos,
            holdingUntil,
            qualifiedAt: now,
          },
        });

        // Create immutable Financial Ledger Entry
        const reward = await tx.referralReward.create({
          data: {
            referralId: referral.id,
            inviterId: referral.inviterId,
            referredUserId: userId,
            transactionId,
            purchaseAmountCentavos,
            rewardType: calculation.rewardType,
            effectiveRate: calculation.effectiveRate, // 🔒 Snapshot immutable effective rate
            rewardAmountCentavos: calculation.rewardAmountCentavos, // 🔒 Snapshot immutable reward amount
            currency: "PHP",
            status: "PENDING",
            holdingUntil,
          },
        });

        // Audit Log
        await tx.referralAuditLog.create({
          data: {
            actorId: "SYSTEM_PAYMONGO_WEBHOOK",
            actorRole: "SYSTEM",
            action: "REWARD_CREATED",
            targetType: "REWARD",
            targetId: reward.id,
            amountCentavos: calculation.rewardAmountCentavos,
            reason: `Qualified purchase of ${formatCentavosToPesos(purchaseAmountCentavos)} at ${calculation.effectiveRate}%`,
            metadata: {
              referralId: referral.id,
              inviterId: referral.inviterId,
              referredUserId: userId,
              transactionId,
              purchaseAmountCentavos,
              effectiveRate: calculation.effectiveRate,
              rewardAmountCentavos: calculation.rewardAmountCentavos,
              holdingPeriodDays: config.holdingPeriodDays,
              holdingUntil: holdingUntil.toISOString(),
            },
          },
        });

        return reward;
      });

      // Send In-App Notification to Inviter
      const rewardFormatted = formatCentavosToPesos(calculation.rewardAmountCentavos);
      await createNotification({
        userId: referral.inviterId,
        title: "🎉 Referral Reward Earned!",
        message: `Your referral upgraded to PRO! You earned a ${rewardFormatted} reward (${calculation.effectiveRate}% of qualifying purchase). It will become available for payout in ${config.holdingPeriodDays} days.`,
        type: "INFO",
      });

      return {
        qualified: true,
        rewardAmountCentavos: rewardRecord.rewardAmountCentavos,
      };
    } catch (error: any) {
      console.error("[ReferralService.qualifyReferralPayment] Error:", error);
      return { qualified: false, reason: "Transaction failed while creating reward ledger entry" };
    }
  }

  /**
   * 7. RELEASE MATURED REWARDS
   * Moves rewards from PENDING to AVAILABLE once holding period has passed.
   */
  public static async releaseMaturedRewards(): Promise<{ releasedCount: number }> {
    const now = new Date();
    const maturedRewards = await prisma.referralReward.findMany({
      where: {
        status: "PENDING",
        holdingUntil: { lte: now },
      },
      include: { inviter: { select: { id: true } } },
    });

    if (maturedRewards.length === 0) {
      return { releasedCount: 0 };
    }

    let releasedCount = 0;

    for (const reward of maturedRewards) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.referralReward.update({
            where: { id: reward.id },
            data: {
              status: "AVAILABLE",
              availableAt: now,
            },
          });

          await tx.referral.update({
            where: { id: reward.referralId },
            data: {
              status: "AVAILABLE",
              availableAt: now,
            },
          });

          await tx.referralAuditLog.create({
            data: {
              actorId: "SYSTEM_HOLDING_RELEASE",
              actorRole: "SYSTEM",
              action: "REWARD_RELEASED",
              targetType: "REWARD",
              targetId: reward.id,
              amountCentavos: reward.rewardAmountCentavos,
              reason: "7-day holding period completed without refund",
            },
          });
        });

        // Notify user that reward is now available for payout
        await createNotification({
          userId: reward.inviterId,
          title: "💰 Referral Reward Available!",
          message: `Your ${formatCentavosToPesos(reward.rewardAmountCentavos)} referral reward is now unlocked and available for payout!`,
          type: "INFO",
        });

        releasedCount++;
      } catch (err) {
        console.error(`[releaseMaturedRewards] Failed to release reward ${reward.id}:`, err);
      }
    }

    return { releasedCount };
  }

  /**
   * 8. REFUND & CHARGEBACK REVERSAL HANDLER
   * Reverses reward and records audit trail without deleting financial history.
   */
  public static async handlePaymentRefundOrChargeback(params: {
    transactionId: string;
    reason?: string;
    adminActorId?: string;
  }): Promise<{ reversed: boolean; reason?: string }> {
    const reward = await prisma.referralReward.findUnique({
      where: { transactionId: params.transactionId },
      include: { referral: true },
    });

    if (!reward) {
      return { reversed: false, reason: "No referral reward associated with transaction" };
    }

    if (reward.status === "REFUNDED" || reward.status === "REVERSED") {
      return { reversed: true, reason: "Reward is already marked reversed/refunded" };
    }

    const previousStatus = reward.status;
    const newStatus: RewardLedgerStatus = previousStatus === "PENDING" ? "REFUNDED" : "REVERSED";
    const newReferralStatus: ReferralStatus = previousStatus === "PENDING" ? "REFUNDED" : "REVERSED";

    await prisma.$transaction(async (tx) => {
      await tx.referralReward.update({
        where: { id: reward.id },
        data: {
          status: newStatus,
          reversalReason: params.reason || "Payment refunded or chargeback initiated",
          reversedAt: new Date(),
        },
      });

      await tx.referral.update({
        where: { id: reward.referralId },
        data: {
          status: newReferralStatus,
        },
      });

      await tx.referralAuditLog.create({
        data: {
          actorId: params.adminActorId || "SYSTEM_PAYMENT_REFUND",
          actorRole: params.adminActorId ? "ADMIN" : "SYSTEM",
          action: "REWARD_REVERSED",
          targetType: "REWARD",
          targetId: reward.id,
          amountCentavos: reward.rewardAmountCentavos,
          previousState: previousStatus,
          newState: newStatus,
          reason: params.reason || "Payment refund / chargeback triggered reward reversal",
          metadata: {
            transactionId: params.transactionId,
            originalPurchaseCentavos: reward.purchaseAmountCentavos,
          },
        },
      });
    });

    // Notify inviter of reversal
    await createNotification({
      userId: reward.inviterId,
      title: "⚠️ Referral Reward Adjusted",
      message: `A referral reward of ${formatCentavosToPesos(reward.rewardAmountCentavos)} was adjusted due to a refund or payment reversal on the qualifying account.`,
      type: "SYSTEM",
    });

    return { reversed: true };
  }

  /**
   * 9. COMPUTE USER FINANCIAL BALANCES
   * Pure aggregation from authoritative reward & payout ledger records.
   */
  public static async getUserBalances(
    userId: string,
    client?: Prisma.TransactionClient
  ): Promise<UserReferralStats> {
    const db = client || prisma;
    const now = new Date();

    // Fetch all earned rewards
    const rewards = await db.referralReward.findMany({
      where: { inviterId: userId },
    });

    // Fetch all payouts
    const payouts = await db.referralPayout.findMany({
      where: { userId },
    });

    // Count referrals
    const referrals = await db.referral.findMany({
      where: { inviterId: userId },
      select: { status: true },
    });

    const totalReferrals = referrals.length;
    let successfulReferrals = 0;
    let pendingReferrals = 0;
    let rejectedReferrals = 0;

    referrals.forEach((r) => {
      if (["QUALIFIED", "REWARD_PENDING", "AVAILABLE", "PAYOUT_REQUESTED", "PAID"].includes(r.status)) {
        successfulReferrals++;
      } else if (["CLICKED", "REGISTERED", "PENDING_PREMIUM"].includes(r.status)) {
        pendingReferrals++;
      } else if (["REJECTED", "CANCELLED", "REFUNDED", "REVERSED"].includes(r.status)) {
        rejectedReferrals++;
      }
    });

    let totalRewardsCentavos = 0;
    let pendingRewardsCentavos = 0;
    let earnedAvailableCentavos = 0;
    let reversedAmountCentavos = 0;

    rewards.forEach((r) => {
      if (r.status === "PENDING") {
        if (r.holdingUntil && r.holdingUntil <= now) {
          earnedAvailableCentavos += r.rewardAmountCentavos;
          totalRewardsCentavos += r.rewardAmountCentavos;
        } else {
          pendingRewardsCentavos += r.rewardAmountCentavos;
          totalRewardsCentavos += r.rewardAmountCentavos;
        }
      } else if (r.status === "AVAILABLE" || r.status === "PAID") {
        earnedAvailableCentavos += r.rewardAmountCentavos;
        totalRewardsCentavos += r.rewardAmountCentavos;
      } else if (r.status === "REVERSED" || r.status === "REFUNDED") {
        reversedAmountCentavos += r.rewardAmountCentavos;
      }
    });

    let requestedPayoutCentavos = 0;
    let paidAmountCentavos = 0;

    payouts.forEach((p) => {
      if (["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"].includes(p.status)) {
        requestedPayoutCentavos += p.amountCentavos;
      } else if (p.status === "PAID") {
        paidAmountCentavos += p.amountCentavos;
      }
    });

    // Available balance = Unlocked Earned Rewards minus (Active Payout Requests + Already Paid Amounts)
    const availableBalanceCentavos = Math.max(
      0,
      earnedAvailableCentavos - (requestedPayoutCentavos + paidAmountCentavos)
    );

    return {
      totalReferrals,
      successfulReferrals,
      pendingReferrals,
      rejectedReferrals,
      totalRewardsCentavos,
      pendingRewardsCentavos,
      availableBalanceCentavos,
      requestedPayoutCentavos,
      paidAmountCentavos,
      reversedAmountCentavos,
    };
  }

  /**
   * 10. REQUEST PAYOUT (USER)
   * Enforces minimum threshold, validates available balance, reserves funds under referral-finance advisory lock.
   */
  public static async requestPayout(params: {
    userId: string;
    amountCentavos: number;
    method: PayoutMethod;
    accountNumber: string;
    accountName: string;
    bankName?: string;
    ipAddress?: string;
    idempotencyContext?: {
      idempotencyKey: string;
      requestHash: string;
    };
  }): Promise<{
    success: boolean;
    payoutId?: string;
    error?: string;
    isReplay?: boolean;
    status?: number;
  }> {
    const { userId, amountCentavos, method, accountNumber, accountName, bankName } = params;

    if (!accountNumber || !accountName) {
      return { success: false, error: "Account details are required", status: 400 };
    }

    try {
      const payoutResult = await prisma.$transaction(async (tx) => {
        // 🔒 Level 0: Acquire idempotency lock and check existing record if key is supplied
        if (params.idempotencyContext) {
          await IdempotencyService.acquireIdempotencyLock(
            tx,
            userId,
            "REFERRAL_PAYOUT_REQUEST",
            params.idempotencyContext.idempotencyKey
          );

          const existingRecord = await IdempotencyService.findAuthoritativeIdempotencyRecord(
            tx,
            userId,
            "REFERRAL_PAYOUT_REQUEST",
            params.idempotencyContext.idempotencyKey
          );

          if (existingRecord) {
            if (existingRecord.requestHash !== params.idempotencyContext.requestHash) {
              throw new IdempotencyDomainError(
                "IDEMPOTENCY_PAYLOAD_MISMATCH",
                "Idempotency key was previously used with a different request.",
                409
              );
            }

            const existingPayout = await tx.referralPayout.findFirst({
              where: { id: existingRecord.resourceId, userId },
            });

            if (!existingPayout) {
              throw new IdempotencyDomainError(
                "IDEMPOTENCY_RESOURCE_NOT_FOUND",
                "Referenced referral payout record not found or does not belong to user.",
                500
              );
            }

            return {
              payout: existingPayout,
              isReplay: true,
            };
          }
        }

        // 🔒 Level 1: Acquire transaction-scoped advisory lock on referral-finance domain
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`referral-finance:${userId}`}, 0)
          )::text AS lock_result
        `;

        // 1. Strict Minimum Payout Check for NEW request (Default: ₱150 = 15000 centavos)
        const config = await this.getProgramConfig();
        if (amountCentavos < config.minPayoutAmountCentavos) {
          throw new Error(
            `Minimum payout is ${formatCentavosToPesos(config.minPayoutAmountCentavos)}. Requested amount is below threshold.`
          );
        }

        // 2. 🔍 Authoritative balance check inside lock
        const balances = await this.getUserBalances(userId, tx);
        if (amountCentavos > balances.availableBalanceCentavos) {
          throw new Error(
            `Insufficient available balance. Available: ${formatCentavosToPesos(balances.availableBalanceCentavos)}.`
          );
        }

        // 3. Encrypt Account Number (fail closed)
        const trimmedAccountNumber = accountNumber.trim();
        let accountNumberEncrypted: string;
        try {
          const enc = encrypt(trimmedAccountNumber);
          if (!enc || enc === trimmedAccountNumber) {
            throw new Error("Encryption failed");
          }
          accountNumberEncrypted = enc;
        } catch {
          throw new Error("Unable to securely process account number for payout.");
        }

        const created = await tx.referralPayout.create({
          data: {
            userId,
            amountCentavos,
            currency: "PHP",
            method,
            accountNumberEncrypted,
            accountName: accountName.trim(),
            bankName: bankName?.trim() || null,
            status: "REQUESTED",
          },
        });

        await tx.referralAuditLog.create({
          data: {
            actorId: userId,
            actorRole: "USER",
            action: "PAYOUT_REQUESTED",
            targetType: "PAYOUT",
            targetId: created.id,
            amountCentavos,
            reason: `User requested ${formatCentavosToPesos(amountCentavos)} via ${method}`,
            ipAddress: params.ipAddress,
            metadata: {
              method,
              accountName: accountName.trim(),
              bankName: bankName?.trim(),
            },
          },
        });

        // Persist durable FinancialIdempotencyKey record inside same transaction
        if (params.idempotencyContext) {
          await IdempotencyService.recordFinancialIdempotency(tx, {
            actorId: userId,
            operationType: "REFERRAL_PAYOUT_REQUEST",
            idempotencyKey: params.idempotencyContext.idempotencyKey,
            requestHash: params.idempotencyContext.requestHash,
            resourceId: created.id,
          });
        }

        return {
          payout: created,
          isReplay: false,
        };
      });

      // Send Notification to user strictly post-commit if not a replay
      if (!payoutResult.isReplay) {
        await createNotification({
          userId,
          title: "💸 Payout Request Submitted",
          message: `Your payout request of ${formatCentavosToPesos(amountCentavos)} via ${method} has been received and is being processed.`,
          type: "INFO",
        }).catch((err) => console.error("[REFERRAL_PAYOUT_NOTIF_ERROR]", err));
      }

      return {
        success: true,
        payoutId: payoutResult.payout.id,
        isReplay: payoutResult.isReplay,
      };
    } catch (err: any) {
      if (err instanceof IdempotencyDomainError) {
        return { success: false, error: err.message, status: err.status };
      }

      // Defensive composite idempotency P2002 recovery from outside aborted transaction
      if (params.idempotencyContext && IdempotencyService.isIdempotencyCompositeP2002(err)) {
        const fallbackRecord = await IdempotencyService.findAuthoritativeIdempotencyRecord(
          prisma,
          userId,
          "REFERRAL_PAYOUT_REQUEST",
          params.idempotencyContext.idempotencyKey
        );

        if (fallbackRecord) {
          if (fallbackRecord.requestHash !== params.idempotencyContext.requestHash) {
            return {
              success: false,
              error: "Idempotency key was previously used with a different request.",
              status: 409,
            };
          }

          const existingPayout = await prisma.referralPayout.findFirst({
            where: { id: fallbackRecord.resourceId, userId },
          });

          if (!existingPayout) {
            return {
              success: false,
              error: "Referenced referral payout record not found or does not belong to user.",
              status: 500,
            };
          }

          return {
            success: true,
            payoutId: existingPayout.id,
            isReplay: true,
          };
        } else {
          return {
            success: false,
            error: "Idempotency record is in an inconsistent state.",
            status: 500,
          };
        }
      }

      const msg = typeof err?.message === "string" ? err.message : "";
      const isKnownBusinessError =
        msg.startsWith("Minimum payout") ||
        msg.startsWith("Insufficient available") ||
        msg.startsWith("Account details") ||
        msg.startsWith("Unable to securely process");

      if (isKnownBusinessError) {
        return { success: false, error: msg, status: 400 };
      }

      console.error("[ReferralService.requestPayout] Error:", err);
      return { success: false, error: "Failed to process payout request. Please try again.", status: 500 };
    }
  }

  /**
   * 11. USER REFERRAL DASHBOARD DATA
   */
  public static async getUserReferralDashboard(userId: string): Promise<UserReferralDashboardData> {
    // 1. Release any matured holding period rewards
    await this.releaseMaturedRewards().catch(() => null);

    // 2. Fetch Code
    const code = await this.getOrCreateReferralCode(userId);
    const origin = getSiteUrl();
    const referralLink = `${origin}/signup?ref=${code}`;

    // 3. Config
    const config = await this.getProgramConfig();

    // 4. Balances
    const stats = await this.getUserBalances(userId);

    // 5. History
    const referrals = await prisma.referral.findMany({
      where: { inviterId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        referredUser: { select: { name: true, email: true } },
        reward: true,
      },
    });

    const history: UserReferralHistoryItem[] = referrals.map((r) => {
      const email = r.referredUser.email || "";
      const emailParts = email.split("@");
      const maskedEmail =
        emailParts.length === 2
          ? `${emailParts[0].slice(0, 2)}***@${emailParts[1]}`
          : "user@***";

      return {
        id: r.id,
        referralId: `REF-${r.id.slice(-6).toUpperCase()}`,
        referredUserName: r.referredUser.name || "Student",
        referredUserEmailMasked: maskedEmail,
        status: r.status,
        qualifyingPurchaseCentavos: r.qualifyingAmount,
        effectiveRate: r.effectiveRate,
        rewardAmountCentavos: r.rewardAmount,
        rewardStatus: r.reward?.status || null,
        holdingUntil: r.holdingUntil?.toISOString() || null,
        availableAt: r.availableAt?.toISOString() || null,
        createdAt: r.createdAt.toISOString(),
      };
    });

    // 6. Payouts
    const payouts = await prisma.referralPayout.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const payoutHistory: UserPayoutHistoryItem[] = payouts.map((p) => {
      let rawNumber = "";
      try {
        rawNumber = decrypt(p.accountNumberEncrypted) || "";
      } catch {
        rawNumber = "******";
      }

      const maskedNumber =
        rawNumber.length > 4 ? `****${rawNumber.slice(-4)}` : "******";

      return {
        id: p.id,
        amountCentavos: p.amountCentavos,
        currency: p.currency,
        method: p.method,
        accountName: p.accountName,
        accountNumberMasked: maskedNumber,
        bankName: p.bankName,
        status: p.status,
        adminNotes: p.adminNotes,
        transactionRef: p.transactionRef,
        createdAt: p.createdAt.toISOString(),
        processedAt: p.processedAt?.toISOString() || null,
      };
    });

    return {
      referralCode: code,
      referralLink,
      programEnabled: config.programEnabled,
      rewardPercentage: config.rewardPercentage,
      holdingPeriodDays: config.holdingPeriodDays,
      minPayoutCentavos: config.minPayoutAmountCentavos,
      stats,
      history,
      payouts: payoutHistory,
    };
  }

  /**
   * 12. ADMIN REFERRAL MANAGEMENT (LIST & FILTER)
   */
  public static async getAdminReferralList(params: AdminReferralFilterParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.status && params.status !== "ALL") {
      where.status = params.status;
    }

    if (params.riskLevel && params.riskLevel !== "ALL") {
      where.riskLevel = params.riskLevel;
    }

    if (params.query) {
      where.OR = [
        { referralCode: { code: { contains: params.query, mode: "insensitive" } } },
        { inviter: { email: { contains: params.query, mode: "insensitive" } } },
        { inviter: { name: { contains: params.query, mode: "insensitive" } } },
        { referredUser: { email: { contains: params.query, mode: "insensitive" } } },
        { referredUser: { name: { contains: params.query, mode: "insensitive" } } },
      ];
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(params.endDate);
    }

    const [total, items] = await Promise.all([
      prisma.referral.count({ where }),
      prisma.referral.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          inviter: { select: { id: true, name: true, email: true } },
          referredUser: { select: { id: true, name: true, email: true, isPaid: true, planType: true } },
          referralCode: { select: { code: true } },
          reward: true,
        },
      }),
    ]);

    const formattedItems: AdminReferralItem[] = items.map((item) => ({
      id: item.id,
      referralCode: item.referralCode.code,
      inviter: item.inviter,
      referredUser: item.referredUser,
      status: item.status,
      qualifyingAmountCentavos: item.qualifyingAmount,
      effectiveRate: item.effectiveRate,
      rewardAmountCentavos: item.rewardAmount,
      rewardStatus: item.reward?.status || null,
      riskLevel: item.riskLevel,
      riskNotes: item.riskNotes,
      paymentId: item.qualifyingPaymentId,
      holdingUntil: item.holdingUntil?.toISOString() || null,
      availableAt: item.availableAt?.toISOString() || null,
      createdAt: item.createdAt.toISOString(),
      qualifiedAt: item.qualifiedAt?.toISOString() || null,
    }));

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: formattedItems,
    };
  }

  /**
   * 13. ADMIN REFERRAL ANALYTICS
   */
  public static async getAdminAnalytics(): Promise<AdminAnalyticsSummary> {
    const [
      totalClicks,
      totalRegistrations,
      totalConversions,
      rewards,
      payouts,
      topReferrersRaw,
    ] = await Promise.all([
      prisma.referralCode.aggregate({ _sum: { clickCount: true } }),
      prisma.referral.count(),
      prisma.referral.count({ where: { status: { in: ["QUALIFIED", "REWARD_PENDING", "AVAILABLE", "PAYOUT_REQUESTED", "PAID"] } } }),
      prisma.referralReward.findMany({ select: { status: true, purchaseAmountCentavos: true, rewardAmountCentavos: true } }),
      prisma.referralPayout.findMany({ select: { status: true, amountCentavos: true } }),
      prisma.referralReward.groupBy({
        by: ["inviterId"],
        _sum: { purchaseAmountCentavos: true, rewardAmountCentavos: true },
        _count: { id: true },
        orderBy: { _sum: { rewardAmountCentavos: "desc" } },
        take: 10,
      }),
    ]);

    let totalQualifyingRevenueCentavos = 0;
    let totalRewardsGeneratedCentavos = 0;
    let totalRewardsPendingCentavos = 0;
    let totalRewardsAvailableCentavos = 0;
    let totalRewardsPaidCentavos = 0;
    let totalRewardsReversedCentavos = 0;

    rewards.forEach((r) => {
      totalQualifyingRevenueCentavos += r.purchaseAmountCentavos;
      totalRewardsGeneratedCentavos += r.rewardAmountCentavos;

      if (r.status === "PENDING") totalRewardsPendingCentavos += r.rewardAmountCentavos;
      else if (r.status === "AVAILABLE") totalRewardsAvailableCentavos += r.rewardAmountCentavos;
      else if (r.status === "PAID") totalRewardsPaidCentavos += r.rewardAmountCentavos;
      else if (r.status === "REVERSED" || r.status === "REFUNDED") totalRewardsReversedCentavos += r.rewardAmountCentavos;
    });

    let payoutsRequestedCentavos = 0;
    payouts.forEach((p) => {
      if (["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"].includes(p.status)) {
        payoutsRequestedCentavos += p.amountCentavos;
      }
    });

    const topUserIds = topReferrersRaw.map((t) => t.inviterId);
    const topUsers = await prisma.user.findMany({
      where: { id: { in: topUserIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(topUsers.map((u) => [u.id, u]));

    const topReferrers = topReferrersRaw.map((t) => {
      const u = userMap.get(t.inviterId);
      const email = u?.email || "";
      const emailParts = email.split("@");
      const maskedEmail = emailParts.length === 2 ? `${emailParts[0].slice(0, 2)}***@${emailParts[1]}` : "user@***";

      return {
        userId: t.inviterId,
        name: u?.name || "Student Referrer",
        emailMasked: maskedEmail,
        referralCount: t._count.id,
        qualifyingRevenueCentavos: t._sum.purchaseAmountCentavos || 0,
        rewardsEarnedCentavos: t._sum.rewardAmountCentavos || 0,
        rewardsPaidCentavos: 0,
      };
    });

    const clicks = totalClicks._sum.clickCount || 0;
    const conversionRatePercent =
      clicks > 0 ? Math.round((totalConversions / clicks) * 10000) / 100 : 0;

    return {
      totalClicks: clicks,
      totalRegistrations,
      totalConversions,
      successfulReferrals: totalConversions,
      conversionRatePercent,
      totalQualifyingRevenueCentavos,
      totalRewardsGeneratedCentavos,
      totalRewardsPendingCentavos,
      totalRewardsAvailableCentavos,
      totalRewardsPaidCentavos,
      totalRewardsReversedCentavos,
      payoutsRequestedCentavos,
      topReferrers,
    };
  }

  /**
   * 14. ADMIN PROCESS PAYOUT (APPROVE / PROCESSING / REJECT / MARK PAID)
   * Hardened with referral-finance advisory lock, backing check, CAS state transition, and double-entry ledger posting.
   */
  public static async adminProcessPayout(params: {
    payoutId: string;
    action: "APPROVE" | "PROCESSING" | "REJECT" | "MARK_PAID";
    adminNotes?: string;
    transactionRef?: string;
    adminUserId: string;
    clientIp?: string;
  }): Promise<{ success: boolean; error?: string; alreadyProcessed?: boolean }> {
    // 1. Pre-lock lookup to obtain userId
    const preLookup = await prisma.referralPayout.findUnique({
      where: { id: params.payoutId },
      select: { userId: true },
    });

    if (!preLookup) return { success: false, error: "Payout record not found" };

    const { LedgerService } = await import("@/lib/accounting/ledgerService");

    const result = await prisma.$transaction(async (tx) => {
      // 🔒 Acquire transaction-scoped advisory lock on referral-finance domain
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`referral-finance:${preLookup.userId}`}, 0)
        )::text AS lock_result
      `;

      // 🔍 Re-fetch payout inside lock
      const payout = await tx.referralPayout.findUnique({
        where: { id: params.payoutId },
        include: { user: { select: { id: true, email: true, name: true } } },
      });

      if (!payout) return { success: false, error: "Payout record not found" };

      // Define allowed predecessors and target status
      let newStatus: PayoutStatus = payout.status;
      let allowedPredecessors: PayoutStatus[] = [];

      if (params.action === "APPROVE") {
        newStatus = "APPROVED";
        allowedPredecessors = ["REQUESTED", "UNDER_REVIEW"];
      } else if (params.action === "PROCESSING") {
        newStatus = "PROCESSING";
        allowedPredecessors = ["REQUESTED", "UNDER_REVIEW", "APPROVED"];
      } else if (params.action === "MARK_PAID") {
        newStatus = "PAID";
        allowedPredecessors = ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"];
      } else if (params.action === "REJECT") {
        newStatus = "REJECTED";
        allowedPredecessors = ["REQUESTED", "UNDER_REVIEW", "APPROVED"];
      }

      // Check if already in target state (idempotent no-op)
      if (payout.status === newStatus) {
        return { success: true, alreadyProcessed: true, payout };
      }

      // If transition not allowed from current state
      if (!allowedPredecessors.includes(payout.status)) {
        return {
          success: false,
          error: `Cannot perform ${params.action} on payout currently in status '${payout.status}'.`,
        };
      }

      // 🛡️ Backing Revalidation for financial progressions (APPROVE, PROCESSING, MARK_PAID)
      if (["APPROVE", "PROCESSING", "MARK_PAID"].includes(params.action)) {
        const now = new Date();
        const rewards = await tx.referralReward.findMany({
          where: { inviterId: payout.userId },
        });
        const allPayouts = await tx.referralPayout.findMany({
          where: { userId: payout.userId },
        });

        let totalValidEarnedCentavos = 0;
        rewards.forEach((r) => {
          if (
            r.status === "AVAILABLE" ||
            r.status === "PAID" ||
            (r.status === "PENDING" && r.holdingUntil && r.holdingUntil <= now)
          ) {
            totalValidEarnedCentavos += r.rewardAmountCentavos;
          }
        });

        const FINANCIALLY_CONSUMING_STATUSES: string[] = [
          "REQUESTED",
          "RESERVED",
          "UNDER_REVIEW",
          "APPROVED",
          "PROCESSING",
        ];

        let historicalPaidPayoutCentavos = 0;
        let otherActivePayoutCentavos = 0;

        allPayouts.forEach((p) => {
          if (p.status === "PAID") {
            historicalPaidPayoutCentavos += p.amountCentavos;
          } else if (p.id !== params.payoutId && FINANCIALLY_CONSUMING_STATUSES.includes(p.status)) {
            otherActivePayoutCentavos += p.amountCentavos;
          }
        });

        const targetPayoutCentavos = payout.amountCentavos;
        const totalCommittedCentavos =
          historicalPaidPayoutCentavos + targetPayoutCentavos + otherActivePayoutCentavos;

        if (totalCommittedCentavos > totalValidEarnedCentavos) {
          // Log manual-review audit inside tx without throwing
          await tx.referralAuditLog.create({
            data: {
              actorId: params.adminUserId,
              actorRole: "ADMIN",
              action: "PAYOUT_BACKING_CONFLICT_MANUAL_REVIEW_REQUIRED",
              targetType: "PAYOUT",
              targetId: params.payoutId,
              amountCentavos: targetPayoutCentavos,
              reason: `Backing check failed for action ${params.action}. Valid earned: ${totalValidEarnedCentavos}, Already paid: ${historicalPaidPayoutCentavos}, Other active commitments: ${otherActivePayoutCentavos}, Target payout: ${targetPayoutCentavos}`,
              ipAddress: params.clientIp,
              metadata: {
                payoutId: params.payoutId,
                userId: payout.userId,
                action: params.action,
                totalValidEarnedCentavos,
                historicalPaidPayoutCentavos,
                otherActivePayoutCentavos,
                targetPayoutCentavos,
                totalCommittedCentavos,
              },
            },
          });

          return {
            success: false,
            error: `Payout lacks sufficient financial backing earnings (Valid earned: ${formatCentavosToPesos(
              totalValidEarnedCentavos
            )}, Already paid: ${formatCentavosToPesos(
              historicalPaidPayoutCentavos
            )}, Other active commitments: ${formatCentavosToPesos(
              otherActivePayoutCentavos
            )}). Action blocked for manual review.`,
          };
        }
      }

      // Compare-and-Set Atomic Transition
      const updateResult = await tx.referralPayout.updateMany({
        where: {
          id: params.payoutId,
          status: { in: allowedPredecessors },
        },
        data: {
          status: newStatus,
          adminNotes: params.adminNotes || payout.adminNotes,
          transactionRef: params.transactionRef || payout.transactionRef,
          processedBy: params.adminUserId,
          processedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        return { success: false, error: "Concurrent state change detected. Action aborted." };
      }

      // Audit Log
      await tx.referralAuditLog.create({
        data: {
          actorId: params.adminUserId,
          actorRole: "ADMIN",
          action: `PAYOUT_${params.action}`,
          targetType: "PAYOUT",
          targetId: params.payoutId,
          amountCentavos: payout.amountCentavos,
          previousState: payout.status,
          newState: newStatus,
          reason: params.adminNotes || `Admin marked payout ${newStatus}`,
          ipAddress: params.clientIp,
          metadata: {
            transactionRef: params.transactionRef,
          },
        },
      });

      // 📊 Double-Entry Accounting Ledger Posting for MARK_PAID
      if (params.action === "MARK_PAID") {
        await LedgerService.recordPayoutDisbursement(
          {
            payoutId: params.payoutId,
            payoutType: "REFERRAL",
            recipientId: payout.userId,
            amountCentavos: payout.amountCentavos,
            method: payout.method,
            referenceNumber: params.transactionRef || payout.transactionRef || undefined,
            adminUserId: params.adminUserId,
          },
          tx
        );
      }

      return { success: true, payout, newStatus };
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (result.alreadyProcessed) {
      return { success: true };
    }

    // Post-commit Notifications
    const payout = result.payout!;
    const formattedAmount = formatCentavosToPesos(payout.amountCentavos);
    if (params.action === "MARK_PAID") {
      await createNotification({
        userId: payout.userId,
        title: "🎉 Payout Sent!",
        message: `Your referral payout of ${formattedAmount} has been sent via ${payout.method}. Ref: ${params.transactionRef || "N/A"}`,
        type: "INFO",
      }).catch((err) => console.error("[REFERRAL_PAYOUT_PAID_NOTIF_ERROR]", err));
    } else if (params.action === "REJECT") {
      await createNotification({
        userId: payout.userId,
        title: "❌ Payout Request Rejected",
        message: `Your payout request of ${formattedAmount} was rejected. Reason: ${params.adminNotes || "Please contact support."}`,
        type: "SYSTEM",
      }).catch((err) => console.error("[REFERRAL_PAYOUT_REJECT_NOTIF_ERROR]", err));
    }

    return { success: true };
  }

  /**
   * 15. ADMIN MANUAL ACTION ON REFERRAL
   */
  public static async adminActionReferral(params: {
    referralId: string;
    action: "APPROVE" | "REJECT" | "FLAG_SUSPICIOUS" | "RESOLVE_RISK";
    reason: string;
    adminUserId: string;
    clientIp?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const referral = await prisma.referral.findUnique({
      where: { id: params.referralId },
    });

    if (!referral) return { success: false, error: "Referral not found" };

    const updateData: any = {};
    if (params.action === "APPROVE") updateData.status = "QUALIFIED";
    else if (params.action === "REJECT") updateData.status = "REJECTED";
    else if (params.action === "FLAG_SUSPICIOUS") {
      updateData.riskLevel = "SUSPICIOUS";
      updateData.status = "SUSPICIOUS";
    } else if (params.action === "RESOLVE_RISK") {
      updateData.riskLevel = "LOW_RISK";
    }

    updateData.riskNotes = params.reason;

    await prisma.$transaction(async (tx) => {
      await tx.referral.update({
        where: { id: params.referralId },
        data: updateData,
      });

      await tx.referralAuditLog.create({
        data: {
          actorId: params.adminUserId,
          actorRole: "ADMIN",
          action: `ADMIN_REFERRAL_${params.action}`,
          targetType: "REFERRAL",
          targetId: params.referralId,
          previousState: referral.status,
          newState: updateData.status || referral.status,
          reason: params.reason,
          ipAddress: params.clientIp,
        },
      });
    });

    return { success: true };
  }
}
