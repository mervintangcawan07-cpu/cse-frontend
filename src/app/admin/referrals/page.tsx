// Relative Path: src/app/admin/referrals/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Gift,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Users,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Sliders,
  FileText,
  Wallet,
  ArrowRight,
  RefreshCw,
  Eye,
  Check,
  Building2,
  Smartphone,
} from "lucide-react";
import {
  AdminAnalyticsSummary,
  AdminReferralItem,
  ReferralProgramConfig,
  ReferralStatus,
} from "@/lib/referral/types";
import { formatCentavosToPesos } from "@/lib/referral/rewardCalculator";

export default function AdminReferralsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "referrals" | "payouts" | "settings" | "audit">("overview");

  // Telemetry & Analytics
  const [analytics, setAnalytics] = useState<AdminAnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Referrals List State
  const [referrals, setReferrals] = useState<AdminReferralItem[]>([]);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  // Single Referral Inspect Modal
  const [selectedReferral, setSelectedReferral] = useState<AdminReferralItem | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Payouts State
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutsTotal, setPayoutsTotal] = useState(0);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("ALL");
  const [payoutModalItem, setPayoutModalItem] = useState<any | null>(null);
  const [payoutAction, setPayoutAction] = useState<"APPROVE" | "REJECT" | "MARK_PAID">("MARK_PAID");
  const [payoutTxnRef, setPayoutTxnRef] = useState("");
  const [payoutAdminNote, setPayoutAdminNote] = useState("");
  const [processingPayout, setProcessingPayout] = useState(false);

  // Settings State
  const [config, setConfig] = useState<ReferralProgramConfig | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rateAuditLogs, setRateAuditLogs] = useState<any[]>([]);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch("/api/admin/referrals/analytics");
      if (res.ok) {
        const json = await res.json();
        setAnalytics(json.analytics);
      }
    } catch (err) {
      console.error("Failed to load admin analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Fetch Referrals Table
  const fetchReferrals = useCallback(async () => {
    setReferralsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (searchQuery) params.set("q", searchQuery);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (riskFilter !== "ALL") params.set("risk", riskFilter);

      const res = await fetch(`/api/admin/referrals?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setReferrals(json.items || []);
        setTotalReferrals(json.total || 0);
      }
    } catch (err) {
      console.error("Failed to load referrals:", err);
    } finally {
      setReferralsLoading(false);
    }
  }, [page, searchQuery, statusFilter, riskFilter]);

  // Fetch Payouts Table
  const fetchPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (payoutStatusFilter !== "ALL") params.set("status", payoutStatusFilter);

      const res = await fetch(`/api/admin/referrals/payouts?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setPayouts(json.items || []);
        setPayoutsTotal(json.total || 0);
      }
    } catch (err) {
      console.error("Failed to load payouts:", err);
    } finally {
      setPayoutsLoading(false);
    }
  }, [payoutStatusFilter]);

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch("/api/admin/referrals/settings");
      if (res.ok) {
        const json = await res.json();
        setConfig(json.config);
        setRateAuditLogs(json.auditLogs || []);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    fetchReferrals();
    fetchPayouts();
    fetchSettings();
  }, [fetchAnalytics, fetchReferrals, fetchPayouts, fetchSettings]);

  // Handle Manual Referral Action
  const handleReferralAction = async (action: string) => {
    if (!selectedReferral) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/referrals/${selectedReferral.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: actionReason }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSelectedReferral(null);
        setActionReason("");
        await fetchReferrals();
        await fetchAnalytics();
      } else {
        alert(json.error || "Action failed.");
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Payout Processing
  const handleProcessPayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutModalItem) return;
    setProcessingPayout(true);
    try {
      const res = await fetch("/api/admin/referrals/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutId: payoutModalItem.id,
          action: payoutAction,
          adminNotes: payoutAdminNote,
          transactionRef: payoutTxnRef,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setPayoutModalItem(null);
        setPayoutTxnRef("");
        setPayoutAdminNote("");
        await fetchPayouts();
        await fetchAnalytics();
      } else {
        alert(json.error || "Failed to process payout.");
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setProcessingPayout(false);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await fetch("/api/admin/referrals/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSettingsMsg({ type: "success", text: "✅ Referral settings saved successfully!" });
        setConfig(json.config);
        await fetchSettings();
      } else {
        setSettingsMsg({ type: "error", text: json.error || "Failed to save settings." });
      }
    } catch (err) {
      setSettingsMsg({ type: "error", text: "Network error saving settings." });
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 text-slate-100">
      {/* Header Banner */}
      <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase tracking-wide">
              ADMIN CONTROL CENTER
            </span>
            {config && (
              <span
                className={`px-2.5 py-0.5 text-xs font-black rounded-full border ${
                  config.programEnabled
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                }`}
              >
                PROGRAM: {config.programEnabled ? "ACTIVE (ON)" : "DISABLED (OFF)"}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-2">Referral &amp; Reward Management</h1>
          <p className="text-slate-400 text-sm mt-1">
            Authoritative financial ledger, rate configuration, anti-fraud telemetry, and cash payout fulfillment.
          </p>
        </div>

        {/* Quick Tabs Navigation */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer ${
              activeTab === "overview" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("referrals")}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer ${
              activeTab === "referrals" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            Referrals ({totalReferrals})
          </button>
          <button
            onClick={() => setActiveTab("payouts")}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer ${
              activeTab === "payouts" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            Payouts ({payoutsTotal})
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer ${
              activeTab === "settings" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                <span>Qualifying Revenue</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white">
                {formatCentavosToPesos(analytics?.totalQualifyingRevenueCentavos)}
              </div>
              <p className="text-[11px] text-slate-400">Total Premium sales from referrals</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                <span>Rewards Generated</span>
                <Gift className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-black text-white">
                {formatCentavosToPesos(analytics?.totalRewardsGeneratedCentavos)}
              </div>
              <p className="text-[11px] text-slate-400">Default rate: {config?.rewardPercentage || 20}%</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                <span>Total Payouts Paid</span>
                <CheckCircle className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-white">
                {formatCentavosToPesos(analytics?.totalRewardsPaidCentavos)}
              </div>
              <p className="text-[11px] text-slate-400">Fulfillments via GCash/Bank</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                <span>Conversion Rate</span>
                <TrendingUp className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white">{analytics?.conversionRatePercent || 0}%</div>
              <p className="text-[11px] text-slate-400">
                {analytics?.successfulReferrals || 0} / {analytics?.totalClicks || 0} clicks
              </p>
            </div>
          </div>

          {/* Top Referrers Leaderboard */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Top Referrer Leaderboard</span>
            </h3>

            {!analytics?.topReferrers?.length ? (
              <div className="py-10 text-center text-xs text-slate-400">No referral conversions recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                    <tr>
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">Referrer</th>
                      <th className="py-3 px-4">Successful Referrals</th>
                      <th className="py-3 px-4">Generated Revenue</th>
                      <th className="py-3 px-4">Earned Rewards</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {analytics.topReferrers.map((referrer, idx) => (
                      <tr key={referrer.userId} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-bold text-slate-400">#{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{referrer.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{referrer.emailMasked}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-purple-400">{referrer.referralCount}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-200">
                          {formatCentavosToPesos(referrer.qualifyingRevenueCentavos)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {formatCentavosToPesos(referrer.rewardsEarnedCentavos)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REFERRALS TABLE */}
      {activeTab === "referrals" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by code, inviter, or referred student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-3">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300 outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="REGISTERED">Registered</option>
                <option value="PENDING_PREMIUM">Pending Premium</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="REWARD_PENDING">Reward Pending</option>
                <option value="AVAILABLE">Available</option>
                <option value="PAID">Paid</option>
                <option value="REJECTED">Rejected</option>
                <option value="REFUNDED">Refunded</option>
                <option value="REVERSED">Reversed</option>
                <option value="SUSPICIOUS">Suspicious</option>
              </select>

              {/* Risk Filter */}
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300 outline-none"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="LOW_RISK">Low Risk</option>
                <option value="REVIEW">Review</option>
                <option value="SUSPICIOUS">Suspicious</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {referralsLoading ? (
            <div className="py-20 text-center text-xs text-slate-400">Loading referral records...</div>
          ) : !referrals.length ? (
            <div className="py-20 text-center text-xs text-slate-400">No referral relationships matched your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Inviter</th>
                    <th className="py-3 px-4">Referred Student</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Qualifying Purchase</th>
                    <th className="py-3 px-4">Rate</th>
                    <th className="py-3 px-4">Reward</th>
                    <th className="py-3 px-4">Risk Level</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {referrals.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">{item.referralCode}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{item.inviter.name || "Student"}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.inviter.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{item.referredUser.name || "Student"}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.referredUser.email}</div>
                      </td>
                      <td className="py-3 px-4">
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
                      <td className="py-3 px-4 font-mono">
                        {item.qualifyingAmountCentavos ? formatCentavosToPesos(item.qualifyingAmountCentavos) : "—"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-300">
                        {item.effectiveRate ? `${item.effectiveRate}%` : "—"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {item.rewardAmountCentavos ? formatCentavosToPesos(item.rewardAmountCentavos) : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.riskLevel === "LOW_RISK"
                              ? "bg-slate-800 text-slate-300"
                              : item.riskLevel === "REVIEW"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          }`}
                        >
                          {item.riskLevel}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setSelectedReferral(item)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYOUTS MANAGEMENT */}
      {activeTab === "payouts" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-white">Cash Payout Fulfillment Queue</h3>
              <p className="text-xs text-slate-400">Verify user balance and disburse funds via GCash, Maya, or Bank.</p>
            </div>

            <select
              value={payoutStatusFilter}
              onChange={(e) => setPayoutStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300 outline-none"
            >
              <option value="ALL">All Payout Statuses</option>
              <option value="REQUESTED">Requested (Action Needed)</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {payoutsLoading ? (
            <div className="py-20 text-center text-xs text-slate-400">Loading payout requests...</div>
          ) : !payouts.length ? (
            <div className="py-20 text-center text-xs text-slate-400">No payout requests in this queue.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Account Name</th>
                    <th className="py-3 px-4">Account / Mobile Number</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(p.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{p.user?.name || "Student"}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.user?.email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-sm">
                        {formatCentavosToPesos(p.amountCentavos)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        {p.method} {p.bankName ? `(${p.bankName})` : ""}
                      </td>
                      <td className="py-3.5 px-4 text-slate-200">{p.accountName}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300 font-bold bg-slate-950/50 px-2 py-1 rounded">
                        {p.accountNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            p.status === "PAID"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : p.status === "REQUESTED"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => {
                            setPayoutModalItem(p);
                            setPayoutAction(p.status === "REQUESTED" ? "MARK_PAID" : "APPROVE");
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[11px] cursor-pointer transition shadow"
                        >
                          Process
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SETTINGS & CONFIGURATION */}
      {activeTab === "settings" && config && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Settings Form */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <span>Referral Program Configuration</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure rates, holding periods, and minimum payout limits. Changes are recorded in the audit log.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* Program Enabled Master Toggle */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-black text-sm text-white">Referral Program Master Switch</div>
                  <div className="text-xs text-slate-400">
                    When disabled, no referral rewards will accrue from qualifying payments.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.programEnabled}
                    onChange={(e) => setConfig({ ...config, programEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* Reward Percentage */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  Default Referral Reward Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={config.rewardPercentage}
                    onChange={(e) =>
                      setConfig({ ...config, rewardPercentage: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono font-bold text-emerald-400 outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-4 top-3.5 text-slate-400 font-bold">%</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Default is 20%. Historical rewards remain locked to the rate at creation time.
                </p>
              </div>

              {/* Holding Period Days */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  Reward Holding Period (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  required
                  value={config.holdingPeriodDays}
                  onChange={(e) =>
                    setConfig({ ...config, holdingPeriodDays: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Default is 7 days. Rewards become available after this duration without a refund.
                </p>
              </div>

              {/* Minimum Payout Centavos */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  Minimum Payout Threshold (PHP)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-400 font-bold">₱</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={config.minPayoutAmountCentavos / 100}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        minPayoutAmountCentavos: Math.round((parseFloat(e.target.value) || 0) * 100),
                      })
                    }
                    className="w-full pl-8 pr-4 py-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white outline-none focus:border-blue-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Default is ₱150.00.</p>
              </div>

              {/* Attribution Window Days */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  Attribution Cookie &amp; Click Window (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  required
                  value={config.attributionWindowDays}
                  onChange={(e) =>
                    setConfig({ ...config, attributionWindowDays: parseInt(e.target.value, 10) || 30 })
                  }
                  className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white outline-none focus:border-blue-500"
                />
              </div>

              {settingsMsg && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-bold ${
                    settingsMsg.type === "success"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {settingsMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {savingSettings ? "Saving Settings..." : "Save Configuration"}
              </button>
            </form>
          </div>

          {/* Rate History & Audit Trail */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              <span>Configuration Change History</span>
            </h3>

            {!rateAuditLogs.length ? (
              <div className="py-10 text-center text-xs text-slate-400">No configuration changes logged yet.</div>
            ) : (
              <div className="space-y-3">
                {rateAuditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                      <span className="font-mono text-sky-400">{log.action}</span>
                    </div>
                    <p className="text-slate-200 font-medium">{log.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Referral Inspection Modal */}
      {selectedReferral && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black">Referral Detail &amp; Manual Override</h3>
                <p className="text-xs text-slate-400">Code: <strong className="text-emerald-400 font-mono">{selectedReferral.referralCode}</strong></p>
              </div>
              <button
                onClick={() => setSelectedReferral(null)}
                className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Inviter:</span>
                <span className="font-bold text-white">{selectedReferral.inviter.name} ({selectedReferral.inviter.email})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Referred Student:</span>
                <span className="font-bold text-white">{selectedReferral.referredUser.name} ({selectedReferral.referredUser.email})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="font-bold text-emerald-400">{selectedReferral.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Qualifying Purchase:</span>
                <span className="font-mono">{formatCentavosToPesos(selectedReferral.qualifyingAmountCentavos)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Calculated Reward:</span>
                <span className="font-mono font-bold text-emerald-400">{formatCentavosToPesos(selectedReferral.rewardAmountCentavos)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                Admin Action Reason / Audit Note
              </label>
              <textarea
                rows={2}
                placeholder="Reason for manual action..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleReferralAction("FLAG_SUSPICIOUS")}
                disabled={actionLoading}
                className="px-3 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold cursor-pointer"
              >
                Flag Suspicious
              </button>
              <button
                type="button"
                onClick={() => handleReferralAction("REJECT")}
                disabled={actionLoading}
                className="px-3 py-2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold cursor-pointer"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => handleReferralAction("APPROVE")}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black cursor-pointer shadow"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payout Processing Modal */}
      {payoutModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black">Process Payout Request</h3>
                <p className="text-xs text-slate-400">
                  Amount: <strong className="text-emerald-400 font-mono">{formatCentavosToPesos(payoutModalItem.amountCentavos)}</strong>
                </p>
              </div>
              <button
                onClick={() => setPayoutModalItem(null)}
                className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessPayoutSubmit} className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Beneficiary Name:</span>
                  <span className="font-bold text-white">{payoutModalItem.accountName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Method:</span>
                  <span className="font-bold text-white">{payoutModalItem.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Account / Mobile Number:</span>
                  <span className="font-mono font-bold text-emerald-400">{payoutModalItem.accountNumber}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  Action
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["APPROVE", "MARK_PAID", "REJECT"] as const).map((act) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => setPayoutAction(act)}
                      className={`p-2.5 rounded-xl border text-xs font-black transition cursor-pointer text-center ${
                        payoutAction === act
                          ? "bg-blue-600 border-blue-500 text-white shadow-lg"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      {act.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {payoutAction === "MARK_PAID" && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                    GCash / Bank Reference Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GCASH-REF-89218291"
                    value={payoutTxnRef}
                    onChange={(e) => setPayoutTxnRef(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  Admin Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional remarks..."
                  value={payoutAdminNote}
                  onChange={(e) => setPayoutAdminNote(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayoutModalItem(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingPayout}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {processingPayout ? "Processing..." : "Submit Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
