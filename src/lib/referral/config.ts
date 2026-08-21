// Relative Path: src/lib/referral/config.ts
import { ReferralProgramConfig } from "./types";

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
