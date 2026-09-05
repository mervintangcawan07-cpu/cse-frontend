// Relative Path: src/lib/referral/config.ts
import { ReferralProgramConfig } from "./types";

/**
 * Evaluates whether the normal-user referral program is enabled.
 * Strictly requires exact "true". Any missing, invalid, or falsy value yields false.
 */
export function isUserReferralEnabled(envValue?: string): boolean {
  const val =
    envValue !== undefined
      ? envValue
      : process.env.NEXT_PUBLIC_USER_REFERRAL_ENABLED;
  return val === "true";
}

/**
 * Master Feature Flag for Normal-User Referral UI Exposure.
 * Soft-launch state: false (hidden completely from desktop nav, mobile drawer, and discovery).
 * Partner referrals, admin controls, and underlying referral engine remain 100% active.
 *
 * Future public launch procedure:
 * 1. Set Vercel/production environment variable NEXT_PUBLIC_USER_REFERRAL_ENABLED="true"
 * 2. Redeploy GovStudyX
 * 3. Normal-user referral UI entry points will automatically reappear
 */
export const USER_REFERRAL_ENABLED: boolean = isUserReferralEnabled();

export const REFERRAL_SETTING_KEYS = {
  PROGRAM_ENABLED: "REFERRAL_PROGRAM_ENABLED",
  REWARD_TYPE: "REFERRAL_REWARD_TYPE",
  REWARD_PERCENTAGE: "REFERRAL_REWARD_PERCENTAGE",
  FIXED_REWARD_AMOUNT_CENTAVOS: "REFERRAL_FIXED_REWARD_AMOUNT_CENTAVOS",
  HOLDING_PERIOD_DAYS: "REFERRAL_HOLDING_PERIOD_DAYS",
  MIN_PAYOUT_AMOUNT_CENTAVOS: "REFERRAL_MIN_PAYOUT_AMOUNT_CENTAVOS",
  ATTRIBUTION_WINDOW_DAYS: "REFERRAL_ATTRIBUTION_WINDOW_DAYS",
  MAX_DAILY_REFERRALS: "REFERRAL_MAX_DAILY_REFERRALS",
  MAX_MONTHLY_REFERRALS: "REFERRAL_MAX_MONTHLY_REFERRALS",
  MAX_MONTHLY_REWARD_CENTAVOS: "REFERRAL_MAX_MONTHLY_REWARD_CENTAVOS",
  REQUIRE_ADMIN_PAYOUT_APPROVAL: "REFERRAL_REQUIRE_ADMIN_PAYOUT_APPROVAL",
  LEADERBOARD_ENABLED: "REFERRAL_LEADERBOARD_ENABLED",
} as const;

export const DEFAULT_REFERRAL_CONFIG: ReferralProgramConfig = {
  programEnabled: false, // 🚨 Stays OFF initially until Admin intentionally activates
  rewardType: "PERCENTAGE",
  rewardPercentage: 20.0, // 20% Default reward rate
  fixedRewardAmountCentavos: 5000, // ₱50.00 fallback if FIXED_AMOUNT is selected
  holdingPeriodDays: 7, // 7-day holding period before rewards become AVAILABLE
  minPayoutAmountCentavos: 15000, // ₱150.00 strictly enforced minimum payout
  attributionWindowDays: 30, // 30-day attribution window
  maxDailyReferrals: 50,
  maxMonthlyReferrals: 500,
  maxMonthlyRewardCentavos: 1000000, // ₱10,000 monthly ceiling
  requireAdminPayoutApproval: true,
  leaderboardEnabled: false,
};
