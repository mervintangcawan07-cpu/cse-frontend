// Relative Path: src/lib/referral/rewardCalculator.ts
import { ReferralRewardType } from "./types";

export interface RewardCalculationResult {
  purchaseAmountCentavos: number;
  rewardType: ReferralRewardType;
  effectiveRate: number;
  rewardAmountCentavos: number;
  currency: string;
  isEligible: boolean;
  notes?: string;
}

/**
 * Validates referral percentage server-side.
 * Range: 0.0% to 100.0%.
 */
export function sanitizeRewardPercentage(rate: unknown, fallback = 20.0): number {
  if (typeof rate !== "number" || isNaN(rate) || !isFinite(rate)) {
    const parsed = parseFloat(String(rate));
    if (isNaN(parsed) || !isFinite(parsed)) return fallback;
    rate = parsed;
  }
  return Math.min(100.0, Math.max(0.0, Math.round(Number(rate) * 100) / 100));
}

/**
 * Calculates referral reward using strict integer centavo arithmetic.
 *
 * 🚨 CRITICAL PRODUCTION RULES:
 * 1. The calculation base is the ACTUAL VERIFIED CUSTOMER PAYMENT AMOUNT (after discounts).
 * 2. PayMongo processing fees are NEVER deducted from the reward base.
 * 3. Rounding is deterministic (Math.round).
 *
 * Example:
 * Customer pays: ₱299.00 = 29900 centavos
 * Rate: 20%
 * Reward: Math.round((29900 * 20) / 100) = 5980 centavos = ₱59.80
 */
export function calculateReferralReward(params: {
  purchaseAmountCentavos: number;
  rewardType?: ReferralRewardType;
  effectiveRate?: number;
  fixedRewardAmountCentavos?: number;
}): RewardCalculationResult {
  const {
    purchaseAmountCentavos,
    rewardType = "PERCENTAGE",
    effectiveRate = 20.0,
    fixedRewardAmountCentavos = 5000,
  } = params;

  if (purchaseAmountCentavos <= 0) {
    return {
      purchaseAmountCentavos: 0,
      rewardType,
      effectiveRate: 0,
      rewardAmountCentavos: 0,
      currency: "PHP",
      isEligible: false,
      notes: "Purchase amount must be positive",
    };
  }

  const safeRate = sanitizeRewardPercentage(effectiveRate, 20.0);
  let calculatedRewardCentavos = 0;

  if (rewardType === "PERCENTAGE") {
    // 💡 Pure Centavo Math: (Centavos * Rate%) -> Deterministic Rounding
    calculatedRewardCentavos = Math.round((purchaseAmountCentavos * safeRate) / 100);
  } else {
    calculatedRewardCentavos = Math.max(0, Math.round(fixedRewardAmountCentavos));
  }

  return {
    purchaseAmountCentavos,
    rewardType,
    effectiveRate: safeRate,
    rewardAmountCentavos: calculatedRewardCentavos,
    currency: "PHP",
    isEligible: calculatedRewardCentavos > 0,
  };
}

/**
 * Formats centavos to Philippine Peso display string.
 * Example: 5980 -> "₱59.80", 29900 -> "₱299.00"
 */
export function formatCentavosToPesos(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined || isNaN(centavos)) return "₱0.00";
  const pesos = centavos / 100;
  return `₱${pesos.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Converts centavos to floating Peso number.
 * Example: 5980 -> 59.8
 */
export function centavosToPesosNumber(centavos: number | null | undefined): number {
  if (!centavos || isNaN(centavos)) return 0;
  return Math.round(centavos) / 100;
}

/**
 * Converts Pesos to integer centavos.
 * Example: 59.80 -> 5980, 299 -> 29900
 */
export function pesosToCentavos(pesos: number | null | undefined): number {
  if (!pesos || isNaN(pesos)) return 0;
  return Math.round(Number(pesos) * 100);
}
