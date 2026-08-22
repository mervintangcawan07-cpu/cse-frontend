// Relative Path: src/lib/referral/referralService.ts
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
  public static async getUserBalances(userId: string): Promise<UserReferralStats> {
    const now = new Date();

    // Fetch all earned rewards
    const rewards = await prisma.referralReward.findMany({
      where: { inviterId: userId },
    });

    // Fetch all payouts
    const payouts = await prisma.referralPayout.findMany({
      where: { userId },
    });

    // Count referrals
    const referrals = await prisma.referral.findMany({
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
   * Enforces ₱150 minimum threshold, validates available balance, reserves funds.
   */
  public static async requestPayout(params: {
    userId: string;
    amountCentavos: number;
    method: PayoutMethod;
    accountNumber: string;
    accountName: string;
    bankName?: string;
    ipAddress?: string;
  }): Promise<{ success: boolean; payoutId?: string; error?: string }> {
    const config = await this.getProgramConfig();
    const { userId, amountCentavos, method, accountNumber, accountName, bankName } = params;

    // 1. Strict Minimum Payout Check (Default: ₱150 = 15000 centavos)
    if (amountCentavos < config.minPayoutAmountCentavos) {
      return {
        success: false,
        error: `Minimum payout is ${formatCentavosToPesos(config.minPayoutAmountCentavos)}. Requested amount is below threshold.`,
      };
    }

    if (!accountNumber || !accountName) {
      return { success: false, error: "Account details are required" };
    }

    // 2. Check Available Balance
    const balances = await this.getUserBalances(userId);
    if (amountCentavos > balances.availableBalanceCentavos) {
      return {
        success: false,
        error: `Insufficient available balance. Available: ${formatCentavosToPesos(balances.availableBalanceCentavos)}.`,
      };
    }

    // 3. Encrypt Account Number
    const accountNumberEncrypted = encrypt(accountNumber.trim()) || accountNumber.trim();

    try {
      const payout = await prisma.$transaction(async (tx) => {
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

        return created;
      });

      // Send Notification to user
      await createNotification({
        userId,
        title: "💸 Payout Request Submitted",
        message: `Your payout request of ${formatCentavosToPesos(amountCentavos)} via ${method} has been received and is being processed.`,
        type: "INFO",
      });

      return { success: true, payoutId: payout.id };
    } catch (err: any) {
      console.error("[ReferralService.requestPayout] Error:", err);
      return { success: false, error: "Failed to submit payout request. Please try again." };
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
   * 14. ADMIN PROCESS PAYOUT (APPROVE / REJECT / MARK PAID)
   */
  public static async adminProcessPayout(params: {
    payoutId: string;
    action: "APPROVE" | "REJECT" | "MARK_PAID";
    adminNotes?: string;
    transactionRef?: string;
    adminUserId: string;
    clientIp?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const payout = await prisma.referralPayout.findUnique({
      where: { id: params.payoutId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!payout) return { success: false, error: "Payout record not found" };

    let newStatus: PayoutStatus = payout.status;
    if (params.action === "APPROVE") newStatus = "APPROVED";
    else if (params.action === "REJECT") newStatus = "REJECTED";
    else if (params.action === "MARK_PAID") newStatus = "PAID";

    await prisma.$transaction(async (tx) => {
      await tx.referralPayout.update({
        where: { id: params.payoutId },
        data: {
          status: newStatus,
          adminNotes: params.adminNotes || payout.adminNotes,
          transactionRef: params.transactionRef || payout.transactionRef,
          processedBy: params.adminUserId,
          processedAt: new Date(),
        },
      });

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
    });

    // Notify User
    const formattedAmount = formatCentavosToPesos(payout.amountCentavos);
    if (params.action === "MARK_PAID") {
      await createNotification({
        userId: payout.userId,
        title: "🎉 Payout Sent!",
        message: `Your referral payout of ${formattedAmount} has been sent via ${payout.method}. Ref: ${params.transactionRef || "N/A"}`,
        type: "INFO",
      });
    } else if (params.action === "REJECT") {
      await createNotification({
        userId: payout.userId,
        title: "❌ Payout Request Rejected",
        message: `Your payout request of ${formattedAmount} was rejected. Reason: ${params.adminNotes || "Please contact support."}`,
        type: "SYSTEM",
      });
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
