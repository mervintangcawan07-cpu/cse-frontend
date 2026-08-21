// Relative Path: src/lib/referral/fraudEngine.ts
import { ReferralRiskLevel } from "./types";

export interface FraudCheckParams {
  inviterId: string;
  referredUserId: string;
  codeOwnerId: string;
  inviterEmail?: string;
  referredEmail?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  recentReferralsCountIn24h?: number;
}

export interface FraudCheckResult {
  isBlocked: boolean;
  riskLevel: ReferralRiskLevel;
  riskReasons: string[];
}

export function evaluateReferralFraud(params: FraudCheckParams): FraudCheckResult {
  const reasons: string[] = [];
  let isBlocked = false;
  let riskLevel: ReferralRiskLevel = "LOW_RISK";

  // 1. Strict Self-Referral Prevention (Account ID match)
  if (params.inviterId === params.referredUserId) {
    reasons.push("Self-referral detected: Inviter ID matches Referred User ID");
    isBlocked = true;
    riskLevel = "BLOCKED";
  }

  // 2. Strict Code Ownership verification
  if (params.codeOwnerId !== params.inviterId) {
    reasons.push("Referral code owner mismatch");
    isBlocked = true;
    riskLevel = "BLOCKED";
  }

  if (params.codeOwnerId === params.referredUserId) {
    reasons.push("Self-referral detected: User cannot redeem their own referral code");
    isBlocked = true;
    riskLevel = "BLOCKED";
  }

  // 3. Email-level duplicate heuristics
  if (params.inviterEmail && params.referredEmail) {
    const cleanInviter = params.inviterEmail.trim().toLowerCase();
    const cleanReferred = params.referredEmail.trim().toLowerCase();

    if (cleanInviter === cleanReferred) {
      reasons.push("Self-referral detected: Identical email address");
      isBlocked = true;
      riskLevel = "BLOCKED";
    }

    // Gmail sub-addressing alias check (e.g. user+1@gmail.com vs user+2@gmail.com)
    const getBaseEmail = (email: string) => {
      const parts = email.split("@");
      if (parts.length !== 2) return email;
      const local = parts[0].split("+")[0].replace(/\./g, "");
      return `${local}@${parts[1]}`;
    };

    if (getBaseEmail(cleanInviter) === getBaseEmail(cleanReferred)) {
      reasons.push("Suspicious alias: Same root email address used with '+' modifier");
      riskLevel = riskLevel === "BLOCKED" ? "BLOCKED" : "SUSPICIOUS";
    }
  }

  // 4. Referral Velocity Check (e.g., > 30 referrals in 24 hours from same inviter)
  if ((params.recentReferralsCountIn24h || 0) > 30) {
    reasons.push(`High velocity detected: ${params.recentReferralsCountIn24h} referrals in past 24 hours`);
    if (riskLevel !== "BLOCKED") {
      riskLevel = "REVIEW";
    }
  }

  return {
    isBlocked,
    riskLevel,
    riskReasons: reasons,
  };
}
