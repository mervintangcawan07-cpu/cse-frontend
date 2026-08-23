// Relative Path: src/app/referrals/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Gift,
  Copy,
  Check,
  Share2,
  DollarSign,
  Clock,
  CheckCircle,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Users,
  Wallet,
  Building2,
  Smartphone,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";
import { getOrCreatePendingFinancialKey, clearPendingFinancialKey, abandonPendingFinancialOperation } from "@/lib/idempotency/client";
import {
  UserReferralDashboardData,
  PayoutMethod,
} from "@/lib/referral/types";
import { formatCentavosToPesos } from "@/lib/referral/rewardCalculator";

export default function UserReferralsPage() {
  const [data, setData] = useState<UserReferralDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<"referrals" | "payouts">("referrals");

  // Payout Modal State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("GCASH");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [payoutInfo, setPayoutInfo] = useState<string | null>(null);
  const [idempotencyConflict, setIdempotencyConflict] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/referral/me");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to load referral dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleCopyCode = () => {
    if (!data?.referralCode) return;
    navigator.clipboard.writeText(data.referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyLink = () => {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleNativeShare = async () => {
    if (!data?.referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join GovStudyX — Civil Service Exam Reviewer",
          text: `Prepare for the Philippine Civil Service Examination with me on GovStudyX! Use my referral code ${data.referralCode}:`,
          url: data.referralLink,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  // Handle explicit user action to abandon pending operation after conflict
  const handleStartNewPayout = () => {
    abandonPendingFinancialOperation("REFERRAL_PAYOUT_REQUEST");
    setIdempotencyConflict(false);
    setPayoutMessage(null);
    setPayoutInfo("A new payout request can now be submitted.");
  };

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutMessage(null);
    setPayoutInfo(null);
    setSubmittingPayout(true);

    const trimmedAmount = payoutAmount.trim();
    const amountNum = Number(trimmedAmount);
    if (!trimmedAmount || !Number.isFinite(amountNum) || amountNum <= 0) {
      setPayoutMessage({ type: "error", text: "Please enter a valid payout amount." });
      setSubmittingPayout(false);
      return;
    }

    let requestStarted = false;
    try {
      const idempotencyKey = getOrCreatePendingFinancialKey("REFERRAL_PAYOUT_REQUEST");
      requestStarted = true;

      const res = await fetch("/api/referral/payout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          amountPesos: amountNum,
          method: payoutMethod,
          accountNumber,
          accountName,
          bankName: payoutMethod === "BANK_TRANSFER" ? bankName : undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        clearPendingFinancialKey("REFERRAL_PAYOUT_REQUEST");
        setIdempotencyConflict(false);
        setPayoutMessage({
          type: "success",
          text: "🎉 Payout request submitted! Our finance team will process it shortly.",
        });
        setPayoutAmount("");
        setAccountNumber("");
        setAccountName("");
        setBankName("");
        await fetchDashboard();
        setTimeout(() => setShowPayoutModal(false), 2500);
      } else {
        const errorMsg = json.error || "Failed to submit payout request.";
        setPayoutMessage({ type: "error", text: errorMsg });
        if (
          res.status === 409 &&
          errorMsg === "Idempotency key was previously used with a different request."
        ) {
          setIdempotencyConflict(true);
        }
      }
    } catch (err: any) {
      if (!requestStarted) {
        const msg =
          err instanceof Error && err.message
            ? err.message
            : "Unable to safely initialize this payout request. Please try again.";
        setPayoutMessage({ type: "error", text: msg });
      } else {
        setPayoutMessage({ type: "error", text: "Network error. Please try again." });
      }
    } finally {
      setSubmittingPayout(false);
    }
  };

  const availablePesos = data ? data.stats.availableBalanceCentavos / 100 : 0;
  const minPayoutPesos = data ? data.minPayoutCentavos / 100 : 150;
  const isPayoutEligible = availablePesos >= minPayoutPesos;

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-400">Loading Referral &amp; Reward Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8 text-slate-100">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/20 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-black uppercase tracking-wider">
              <Gift className="w-3.5 h-3.5" />
              <span>20% Student Referral Program</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Invite Classmates, Earn <span className="text-emerald-400">20% Cash Rewards</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Earn {data?.rewardPercentage || 20}% of the qualifying Premium purchase amount every time a friend you refer upgrades their GovStudyX account.
            </p>
          </div>

          {/* Quick Payout Action Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => {
                setPayoutAmount(String(availablePesos));
                setShowPayoutModal(true);
              }}
              disabled={!isPayoutEligible}
              className={`px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
                isPayoutEligible
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25 cursor-pointer hover:scale-[1.02]"
                  : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-75"
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Request Payout</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Share & Code Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Referral Link & Code Card */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>Your Referral Credentials</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Share your link to automatically attribute new sign-ups.</p>
            </div>
            <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-bold font-mono">
              GSX-AUTH
            </span>
          </div>

          <div className="space-y-4">
            {/* Referral Code Box */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Unique Referral Code
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3.5 font-mono text-base font-black text-emerald-400 tracking-wider">
                  {data?.referralCode}
                </div>
                <button
                  onClick={handleCopyCode}
                  className="px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
                </button>
              </div>
            </div>

            {/* Shareable Link Box */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Direct Share Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={data?.referralLink || ""}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3.5 text-xs text-slate-300 font-mono outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? "Copied Link!" : "Copy Link"}</span>
                </button>
                <button
                  onClick={handleNativeShare}
                  className="p-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl border border-slate-700 text-xs font-bold transition cursor-pointer"
                  title="Share Link"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works & Transparency Card */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-wider">
              <Info className="w-4 h-4" />
              <span>Authoritative Reward Formula</span>
            </div>
            <h3 className="text-base font-black text-white">How Your 20% Reward Is Calculated</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your reward is calculated from the <strong>actual amount paid by the customer</strong> for qualifying Premium access. PayMongo processing fees are <strong>not deducted</strong> from your reward base.
            </p>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Standard 1-Year Pass (₱299):</span>
                <span className="font-bold text-emerald-400">₱299 × 20% = ₱59.80</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Discounted Pass (₱199):</span>
                <span className="font-bold text-emerald-400">₱199 × 20% = ₱39.80</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>7-Day Holding Period</span>
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Min. Payout: ₱150.00</span>
            </span>
            <Link href="/terms/referral" className="text-blue-400 hover:underline font-bold">
              Program Terms ➔
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400">
            <span>Available Balance</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">
            {formatCentavosToPesos(data?.stats.availableBalanceCentavos)}
          </div>
          <p className="text-[11px] text-slate-400">
            {isPayoutEligible ? "✅ Eligible for instant payout request" : `Minimum ₱${minPayoutPesos} required to request`}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400">
            <span>Pending Rewards</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {formatCentavosToPesos(data?.stats.pendingRewardsCentavos)}
          </div>
          <p className="text-[11px] text-slate-400">Under standard 7-day holding verification</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400">
            <span>Total Paid Out</span>
            <CheckCircle className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {formatCentavosToPesos(data?.stats.paidAmountCentavos)}
          </div>
          <p className="text-[11px] text-slate-400">Completed cash withdrawals</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400">
            <span>Referrals</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {data?.stats.successfulReferrals || 0}{" "}
            <span className="text-sm font-normal text-slate-400">/ {data?.stats.totalReferrals || 0}</span>
          </div>
          <p className="text-[11px] text-slate-400">Successful PRO upgrades</p>
        </div>
      </div>

      {/* History & Payouts Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("referrals")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === "referrals"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Referral Activity ({data?.history.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("payouts")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === "payouts"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Payout History ({data?.payouts.length || 0})
            </button>
          </div>

          <span className="text-xs text-slate-400">Authoritative Server Ledger</span>
        </div>

        {/* Tab 1: Referral Activity Table */}
        {activeTab === "referrals" && (
          <div>
            {!data?.history.length ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-xl">
                  👥
                </div>
                <h4 className="text-base font-black text-white">No referrals yet</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Invite classmates to GovStudyX using your referral link above. You will see your earnings here once they join and upgrade!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                    <tr>
                      <th className="py-3 px-4">Referral ID</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Qualifying Purchase</th>
                      <th className="py-3 px-4">Rate</th>
                      <th className="py-3 px-4">Your Reward</th>
                      <th className="py-3 px-4">Available Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data.history.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-300">{item.referralId}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white">{item.referredUserName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.referredUserEmailMasked}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                              ["QUALIFIED", "AVAILABLE", "PAID"].includes(item.status)
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : item.status === "REWARD_PENDING"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : item.status === "PENDING_PREMIUM"
                                ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            }`}
                          >
                            {item.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          {item.qualifyingPurchaseCentavos ? formatCentavosToPesos(item.qualifyingPurchaseCentavos) : "—"}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                          {item.effectiveRate ? `${item.effectiveRate}%` : "20%"}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                          {item.rewardAmountCentavos ? formatCentavosToPesos(item.rewardAmountCentavos) : "Pending"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                          {item.holdingUntil
                            ? new Date(item.holdingUntil).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : new Date(item.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Payout History Table */}
        {activeTab === "payouts" && (
          <div>
            {!data?.payouts.length ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-xl">
                  💸
                </div>
                <h4 className="text-base font-black text-white">No payout requests yet</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  When your available reward balance reaches ₱150.00, you can request cash payout via GCash, Maya, or Bank Transfer.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Account Holder</th>
                      <th className="py-3 px-4">Account Number</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data.payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 text-slate-400">
                          {new Date(p.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-1.5">
                          {p.method === "GCASH" && <Smartphone className="w-3.5 h-3.5 text-blue-400" />}
                          {p.method === "BANK_TRANSFER" && <Building2 className="w-3.5 h-3.5 text-indigo-400" />}
                          <span>{p.method.replace("_", " ")}</span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-200">{p.accountName}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">{p.accountNumberMasked}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                          {formatCentavosToPesos(p.amountCentavos)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                              p.status === "PAID"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : p.status === "REQUESTED" || p.status === "PROCESSING"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                          {p.transactionRef || p.adminNotes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payout Request Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-black">Request Reward Payout</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Available Balance: <strong className="text-emerald-400 font-mono">{formatCentavosToPesos(data?.stats.availableBalanceCentavos)}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePayoutSubmit} className="space-y-4">
              {/* Method Selector */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  Payout Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["GCASH", "MAYA", "BANK_TRANSFER"] as PayoutMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayoutMethod(m)}
                      className={`p-3 rounded-xl border text-xs font-black transition cursor-pointer text-center ${
                        payoutMethod === m
                          ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {m.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  Amount in PHP (Min. ₱150.00)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-400 font-bold">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="150"
                    max={availablePesos}
                    required
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono font-bold text-emerald-400 outline-none focus:border-emerald-500"
                    placeholder="150.00"
                  />
                </div>
              </div>

              {/* Bank Name if Bank Transfer */}
              {payoutMethod === "BANK_TRANSFER" && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="BDO, BPI, UnionBank, LandBank, etc."
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Account Holder Name */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  Account Holder Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Juan Dela Cruz"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  {payoutMethod === "BANK_TRANSFER" ? "Bank Account Number" : "Mobile Number (09XX-XXX-XXXX)"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={payoutMethod === "BANK_TRANSFER" ? "1234567890" : "09171234567"}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white outline-none focus:border-blue-500"
                />
              </div>

              {payoutMessage && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-bold space-y-2 ${
                    payoutMessage.type === "success"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  <div>{payoutMessage.text}</div>
                  {idempotencyConflict && payoutMessage.type === "error" && (
                    <button
                      type="button"
                      onClick={handleStartNewPayout}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      Start New Payout Request
                    </button>
                  )}
                </div>
              )}

              {payoutInfo && (
                <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs font-semibold text-blue-300">
                  {payoutInfo}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayout}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {submittingPayout ? "Submitting..." : "Confirm Payout"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
