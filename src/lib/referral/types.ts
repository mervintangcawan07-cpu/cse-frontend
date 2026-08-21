// Relative Path: src/lib/referral/types.ts

export type ReferralRewardType = "PERCENTAGE" | "FIXED_AMOUNT";

export type ReferralStatus =
  | "CLICKED"
  | "REGISTERED"
  | "PENDING_PREMIUM"
  | "QUALIFIED"
  | "REWARD_PENDING"
  | "AVAILABLE"
  | "PAYOUT_REQUESTED"
  | "PAID"
  | "REJECTED"
  | "CANCELLED"
  | "REFUNDED"
  | "REVERSED"
  | "SUSPICIOUS";

export type RewardLedgerStatus =
  | "PENDING"
  | "AVAILABLE"
  | "PAID"
  | "REVERSED"
  | "REFUNDED"
  | "CANCELLED";

export type PayoutStatus =
  | "REQUESTED"
  | "RESERVED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PROCESSING"
  | "PAID"
  | "REJECTED"
  | "CANCELLED"
  | "FAILED"
  | "REVERSED";

export type PayoutMethod = "GCASH" | "BANK_TRANSFER" | "MAYA";

export type ReferralRiskLevel = "LOW_RISK" | "REVIEW" | "SUSPICIOUS" | "BLOCKED";

export interface ReferralProgramConfig {
  programEnabled: boolean;
  rewardType: ReferralRewardType;
  rewardPercentage: number; // e.g. 20.0
  fixedRewardAmountCentavos: number; // e.g. 5000 for ₱50.00
  holdingPeriodDays: number; // e.g. 7
  minPayoutAmountCentavos: number; // e.g. 15000 for ₱150.00
  attributionWindowDays: number; // e.g. 30
  maxDailyReferrals: number; // e.g. 50
  maxMonthlyReferrals: number; // e.g. 500
  maxMonthlyRewardCentavos: number; // e.g. 1000000 (₱10,000)
  requireAdminPayoutApproval: boolean;
  leaderboardEnabled: boolean;
}

export interface UserReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  rejectedReferrals: number;
  totalRewardsCentavos: number;
  pendingRewardsCentavos: number;
  availableBalanceCentavos: number;
  requestedPayoutCentavos: number;
  paidAmountCentavos: number;
  reversedAmountCentavos: number;
}

export interface UserReferralHistoryItem {
  id: string;
  referralId: string;
  referredUserName: string;
  referredUserEmailMasked: string;
  status: ReferralStatus;
  qualifyingPurchaseCentavos: number | null;
  effectiveRate: number | null;
  rewardAmountCentavos: number | null;
  rewardStatus: RewardLedgerStatus | null;
  holdingUntil: string | null;
  availableAt: string | null;
  createdAt: string;
}

export interface UserPayoutHistoryItem {
  id: string;
  amountCentavos: number;
  currency: string;
  method: PayoutMethod;
  accountName: string;
  accountNumberMasked: string;
  bankName: string | null;
  status: PayoutStatus;
  adminNotes: string | null;
  transactionRef: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface UserReferralDashboardData {
  referralCode: string;
  referralLink: string;
  programEnabled: boolean;
  rewardPercentage: number;
  holdingPeriodDays: number;
  minPayoutCentavos: number;
  stats: UserReferralStats;
  history: UserReferralHistoryItem[];
  payouts: UserPayoutHistoryItem[];
}

export interface AdminReferralFilterParams {
  query?: string;
  status?: string;
  riskLevel?: string;
  rewardStatus?: string;
  payoutStatus?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface AdminReferralItem {
  id: string;
  referralCode: string;
  inviter: {
    id: string;
    name: string | null;
    email: string;
  };
  referredUser: {
    id: string;
    name: string | null;
    email: string;
    isPaid: boolean;
    planType: string | null;
  };
  status: ReferralStatus;
  qualifyingAmountCentavos: number | null;
  effectiveRate: number | null;
  rewardAmountCentavos: number | null;
  rewardStatus: RewardLedgerStatus | null;
  riskLevel: ReferralRiskLevel;
  riskNotes: string | null;
  paymentId: string | null;
  holdingUntil: string | null;
  availableAt: string | null;
  createdAt: string;
  qualifiedAt: string | null;
}

export interface AdminAnalyticsSummary {
  totalClicks: number;
  totalRegistrations: number;
  totalConversions: number;
  successfulReferrals: number;
  conversionRatePercent: number;
  totalQualifyingRevenueCentavos: number;
  totalRewardsGeneratedCentavos: number;
  totalRewardsPendingCentavos: number;
  totalRewardsAvailableCentavos: number;
  totalRewardsPaidCentavos: number;
  totalRewardsReversedCentavos: number;
  payoutsRequestedCentavos: number;
  topReferrers: Array<{
    userId: string;
    name: string;
    emailMasked: string;
    referralCount: number;
    qualifyingRevenueCentavos: number;
    rewardsEarnedCentavos: number;
    rewardsPaidCentavos: number;
  }>;
}
