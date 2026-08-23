// Relative Path: src/app/partner/dashboard/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  Copy,
  ExternalLink,
  ShieldCheck,
  Award,
  Info,
  LogOut,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { formatCentavosToPesos } from "@/lib/accounting/money";
import SocialQuizCardExporter from "@/components/partner/SocialQuizCardExporter";
import { getOrCreatePendingFinancialKey, clearPendingFinancialKey, abandonPendingFinancialOperation } from "@/lib/idempotency/client";

export default function PartnerDashboardPage() {
  const router = useRouter();
  const [partnerData, setPartnerData] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "media-kit">("overview");
  const [copiedScriptIndex, setCopiedScriptIndex] = useState<number | null>(null);
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const [copiedPromo, setCopiedPromo] = useState(false);

  // Payout Modal State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"GCASH" | "MAYA" | "BANK_TRANSFER">("GCASH");
  const [payoutAccountName, setPayoutAccountName] = useState("");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");
  const [payoutBankName, setPayoutBankName] = useState("");
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState<string | null>(null);
  const [payoutInfo, setPayoutInfo] = useState<string | null>(null);
  const [idempotencyConflict, setIdempotencyConflict] = useState(false);

  // Fetch Partner Portal Overview & Transactions
  const fetchPortalData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, txnRes] = await Promise.all([
        fetch("/api/partner/portal/overview"),
        fetch("/api/partner/portal/transactions"),
      ]);

      if (overviewRes.status === 401 || txnRes.status === 401) {
        router.push("/partner/login");
        return;
      }

      if (overviewRes.ok) {
        const json = await overviewRes.json();
        setPartnerData(json);
      }

      if (txnRes.ok) {
        const txnJson = await txnRes.json();
        setTransactions(txnJson.items || []);
      }
    } catch (err) {
      console.error("Failed to load partner portal data:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchPortalData();
  }, [fetchPortalData]);

  // Copy Referral Link
  const handleCopyLink = () => {
    if (!partnerData?.referralDetails?.link) return;
    navigator.clipboard.writeText(partnerData.referralDetails.link);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Copy Promo Script
  const handleCopyScript = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedScriptIndex(index);
    setTimeout(() => setCopiedScriptIndex(null), 2500);
  };

  // Copy Channel-Specific Campaign Link
  const handleCopyChannelLink = (src: string) => {
    const base = partnerData?.referralDetails?.link || `https://govstudyx.com/p/${partnerData?.partner?.slug || partnerData?.partner?.code || ""}`;
    const fullUrl = `${base}?src=${src}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedChannel(src);
    setTimeout(() => setCopiedChannel(null), 2500);
  };

  // Copy Checkout Promo Code
  const handleCopyPromo = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedPromo(true);
    setTimeout(() => setCopiedPromo(false), 2500);
  };

  // Logout Handler
  const handleLogout = async () => {
    await fetch("/api/partner/auth/logout", { method: "POST" });
    router.push("/partner/login");
  };

  // Handle explicit user action to abandon pending operation after conflict
  const handleStartNewPayout = () => {
    abandonPendingFinancialOperation("PARTNER_PAYOUT_REQUEST");
    setIdempotencyConflict(false);
    setPayoutError(null);
    setPayoutInfo("A new payout request can now be submitted.");
  };

  // Submit Cash Payout
  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPayout(true);
    setPayoutError(null);
    setPayoutSuccessMsg(null);
    setPayoutInfo(null);

    try {
      const idempotencyKey = getOrCreatePendingFinancialKey("PARTNER_PAYOUT_REQUEST");

      const res = await fetch("/api/partner/portal/payout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          amountPesos: payoutAmount,
          method: payoutMethod,
          accountName: payoutAccountName,
          accountNumber: payoutAccountNumber,
          bankName: payoutMethod === "BANK_TRANSFER" ? payoutBankName : undefined,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        clearPendingFinancialKey("PARTNER_PAYOUT_REQUEST");
        setIdempotencyConflict(false);
        setPayoutSuccessMsg(json.message);
        setPayoutAmount("");
        setPayoutAccountNumber("");
        setPayoutAccountName("");
        await fetchPortalData();
        setTimeout(() => {
          setShowPayoutModal(false);
          setPayoutSuccessMsg(null);
        }, 3000);
      } else {
        const errorMsg = json.error || "Failed to submit payout request.";
        setPayoutError(errorMsg);
        if (
          res.status === 409 &&
          errorMsg === "Idempotency key was previously used with a different request."
        ) {
          setIdempotencyConflict(true);
        }
      }
    } catch (err: any) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Network error. Please try again.";
      setPayoutError(msg);
    } finally {
      setSubmittingPayout(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading Partner Portal...</p>
        </div>
      </div>
    );
  }

  const { partner, accounting, referralDetails, calculationExplanation } = partnerData || {};
  const partnerLink = referralDetails?.link || `https://govstudyx.com/p/${partner?.slug || partner?.code || ""}`;

  const promoScripts = [
    {
      title: "📱 15-Second Video Hook (TikTok / Reels / Shorts)",
      duration: "15 Seconds",
      badge: "Highest Conversion",
      content: `Kung mag-e-exam ka sa Civil Service Exam ngayong 2026, huwag kang mag-memorize nang walang system! Gamitin mo ang GovStudyX — may 2,500+ updated practice questions, timed mock exams, at complete rationalizations. Click the link in my bio or visit ${partnerLink} para makapag-practice ka nang libre today! 🚀`,
    },
    {
      title: "🎬 30-Second Vlog / YouTube Integration",
      duration: "30 Seconds",
      badge: "In-Depth Review",
      content: `Quick announcement for everyone reviewing for the 2026 Civil Service Exam: I've officially partnered with GovStudyX to give our community exclusive access to the best CSE online review platform in the Philippines. 

Unlike traditional PDFs, GovStudyX gives you real-time timed mock exams covering Verbal, Math, Analytical, and General Information with instant diagnostic scoring so you know exactly which subjects to focus on. 

Go to ${partnerLink} right now to start your free diagnostic exam and secure your 80%+ passing rating!`,
    },
    {
      title: "💬 Facebook Page / Group Post Copy",
      duration: "Post Template",
      badge: "Social Media",
      content: `📚 Civil Service Exam 2026 Aspirants (Professional & Sub-Professional)!

I am proud to announce our official partnership with GovStudyX (https://govstudyx.com) — the most advanced CSE preparation and practice exam platform in the country! 🇵🇭

🔥 What our community gets:
✅ 2,500+ CSC Scope-Aligned Practice Questions
✅ Realistic Timed Mock Exam Simulator (with Passing Score Predictor)
✅ Detailed Rationalizations for every single answer
✅ Mobile & Desktop Friendly (Ad-Free & Cloud-Based)

👉 Start your free practice test here:
🔗 ${partnerLink}

I-tag mo na ang study buddy mo! Sama-sama tayong papasa ngayong 2026! 🎓💪`,
    },
    {
      title: "📲 Study Group Chat Message (Messenger / Viber / Telegram)",
      duration: "Direct Message",
      badge: "Group Chats",
      content: `Hello future Civil Servants! 👋 Share ko lang itong gamit kong online reviewer for CSE 2026. Sobrang ganda ng system dahil may timed mock exams at complete rationalizations:

👉 ${partnerLink}

May free practice test agad pagka-sign up niyo. Good luck sa review natin! 💯`,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-emerald-500/20">
              G
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                <span>{partner?.name || "Partner Portal"}</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                  {partner?.badgeText || "Official Partner"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">Code: {partner?.code}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href={`/p/${referralDetails?.slug || referralDetails?.code}`}
              target="_blank"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 transition"
            >
              <span>View Landing Page</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <button
              onClick={() => setShowPayoutModal(true)}
              disabled={!accounting?.canWithdraw}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer ${
                accounting?.canWithdraw
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
                  : "bg-slate-800 text-slate-500 opacity-60 cursor-not-allowed"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Withdraw Cash</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded-xl transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === "overview"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Financial Overview &amp; Students</span>
          </button>

          <button
            onClick={() => setActiveTab("media-kit")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === "media-kit"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                : "bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Creator Media Kit &amp; Promo Scripts</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Unique Referral Link Hero Box */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Verified Educational Partnership</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white">
                    Welcome back, {partner?.name}!
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                    Share your official co-branded GovStudyX referral link with your community to earn{" "}
                    <strong className="text-emerald-400 font-black">{accounting?.commissionRate}%</strong> commission on every student upgrade.
                  </p>
                </div>
              </div>

              {/* High-Trust Referral Link & Promo Code Copy Box */}
              <div className="p-4 sm:p-6 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Your Official Partner Referral Link (Non-Scam Verified URL)</span>
                  </span>
                  <span className="text-[11px] text-emerald-400 font-semibold">
                    ✓ 30-Day Attribution Cookie Locked Automatically
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="w-full p-3.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-emerald-300 font-bold truncate">
                    {partnerLink}
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="w-full sm:w-auto px-5 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition cursor-pointer flex-shrink-0 shadow-lg shadow-emerald-500/20"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copySuccess ? "Copied!" : "Copy Official Link"}</span>
                  </button>
                </div>

                {/* Checkout Promo Code Card */}
                <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-black uppercase text-purple-400 tracking-wider">
                      Checkout Promo Code (For Videos &amp; Live Streams)
                    </div>
                    <p className="text-xs text-slate-300">
                      Students can enter this code manually on the PayMongo checkout page to credit your commission.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3.5 py-2 bg-slate-950 border border-purple-500/30 rounded-xl font-mono text-xs font-black text-purple-300 tracking-wider">
                      {partner?.slug || partner?.code}
                    </span>
                    <button
                      onClick={() => handleCopyPromo(partner?.slug || partner?.code || "")}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-purple-600/20"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedPromo ? "Copied!" : "Copy Code"}</span>
                    </button>
                  </div>
                </div>

                {/* Multi-Channel Sub-Tracking Links Generator */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block">
                    1-Click Channel-Specific Sub-Tracking Links:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    {[
                      { id: "youtube", label: "📹 YouTube", desc: "For Video Descriptions" },
                      { id: "tiktok", label: "📱 TikTok / Reels", desc: "For Bio Links" },
                      { id: "fbgroup", label: "👥 FB Group", desc: "For Community Posts" },
                      { id: "messenger", label: "💬 Messenger", desc: "For Direct Chats" },
                      { id: "email", label: "📧 Email / SMS", desc: "For Newsletters" },
                    ].map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => handleCopyChannelLink(ch.id)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          copiedChannel === ch.id
                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                            : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <span className="font-bold">{ch.label}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-1">
                          {copiedChannel === ch.id ? "✓ Copied Link" : "Copy Link"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Accounting Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
                <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>Total Revenue Generated</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-white">
                  {accounting?.formattedTotalRevenue || "₱0.00"}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  {accounting?.totalPurchasesCount || 0} student purchases
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
                <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>Total Earned Commissions</span>
                  <Award className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-black text-purple-400">
                  {accounting?.formattedTotalCommissions || "₱0.00"}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  At {accounting?.commissionRate}% partner rate
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
                <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>Available for Withdrawal</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  {accounting?.formattedAvailableBalance || "₱0.00"}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Min. payout: {accounting?.formattedMinPayout}
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
                <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>Pending Settlement</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400">
                  {accounting?.formattedPendingCommissions || "₱0.00"}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  {accounting?.holdingPeriodDays}-day holding period
                </p>
              </div>
            </div>

            {/* Multi-Channel Traffic & Commission Breakdown */}
            {accounting?.channelBreakdown && accounting.channelBreakdown.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-black text-white">Traffic Channel Analytics</h3>
                    <p className="text-xs text-slate-400">
                      Conversions and accrued commissions by referral campaign source.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold">
                    Sub-Tracking Active
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  {accounting.channelBreakdown.map((ch: any) => (
                    <div
                      key={ch.channel}
                      className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase text-slate-300 font-mono text-[11px]">
                          {ch.channel === "youtube"
                            ? "📹 YouTube"
                            : ch.channel === "tiktok"
                            ? "📱 TikTok"
                            : ch.channel === "fbgroup"
                            ? "👥 FB Group"
                            : ch.channel === "messenger"
                            ? "💬 Messenger"
                            : ch.channel === "email"
                            ? "📧 Email"
                            : "🌐 Direct"}
                        </span>
                        <span className="font-mono text-xs font-bold text-white">
                          {ch.count} {ch.count === 1 ? "sale" : "sales"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex justify-between">
                        <span>Revenue:</span>
                        <span className="text-slate-200 font-bold">{ch.formattedRevenue}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex justify-between">
                        <span>Earned:</span>
                        <span className="text-emerald-400 font-bold">{ch.formattedCommission}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Calculation Formula & Transparency Widget */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase">
                <Info className="w-4 h-4" />
                <span>How Your Commission Is Computed (Transparent Financial Policy)</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-white">
                {calculationExplanation?.formula}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {calculationExplanation?.rule}
              </p>
            </div>

            {/* Referred Student Transactions Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-black text-white">Referred Student Purchases</h3>
                  <p className="text-xs text-slate-400">
                    Real-time chronological log of students who upgraded using your partner link.
                  </p>
                </div>
                <span className="px-3 py-1 bg-slate-950 text-slate-300 border border-slate-800 rounded-lg text-xs font-mono">
                  Total: {transactions.length}
                </span>
              </div>

              {!transactions.length ? (
                <div className="py-16 text-center space-y-2">
                  <div className="text-3xl">📊</div>
                  <h4 className="text-sm font-bold text-white">No referred purchases yet</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Share your unique link on your Facebook Page, group, or channel to start earning commissions!
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Plan Type</th>
                        <th className="py-3 px-4">Channel</th>
                        <th className="py-3 px-4 text-right">Purchase Amount</th>
                        <th className="py-3 px-4">Rate</th>
                        <th className="py-3 px-4 text-right">Your Commission</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {transactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4 text-slate-400">
                            {new Date(t.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white">{t.studentName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{t.studentEmailMasked}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-200">{t.planType}</td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                            <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-bold uppercase">
                              {t.campaignSource === "youtube"
                                ? "📹 YouTube"
                                : t.campaignSource === "tiktok"
                                ? "📱 TikTok"
                                : t.campaignSource === "fbgroup"
                                ? "👥 FB Group"
                                : t.campaignSource === "messenger"
                                ? "💬 Messenger"
                                : t.campaignSource === "email"
                                ? "📧 Email"
                                : "🌐 Direct"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                            {t.formattedPurchaseAmount}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-purple-400">{t.effectiveRate}%</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                            {t.formattedCommissionAmount}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                                t.status === "PAID"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : t.status === "AVAILABLE"
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              }`}
                            >
                              {t.status === "PENDING" ? "Holding (7 Days)" : t.status}
                            </span>
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

        {/* TAB 2: MEDIA KIT */}
        {activeTab === "media-kit" && (
          <div className="space-y-6">
            {/* Interactive 9:16 Quiz Card & Video Exporter */}
            <SocialQuizCardExporter
              partnerName={partner?.name || "GovStudyX Partner"}
              partnerCode={partner?.code || "PTR"}
              partnerSlug={partner?.slug}
            />

            <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 p-6 rounded-3xl space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-black text-white">Creator Media Kit &amp; Ready-to-Use Scripts</h3>
              </div>
              <p className="text-xs text-slate-400">
                Copy and paste these proven, high-converting video and post templates tailored for your audience.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {promoScripts.map((script, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-xs sm:text-sm">{script.title}</h4>
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-[10px] font-black">
                        {script.badge}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">
                      {script.content}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-500 font-mono">{script.duration}</span>
                    <button
                      onClick={() => handleCopyScript(script.content, idx)}
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedScriptIndex === idx ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Script</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Fact Sheet for Live Streams */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Live Stream &amp; Reviewer Quick Fact Sheet</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-emerald-400">2,500+ Practice Items</div>
                  <p className="text-slate-400 text-[11px]">
                    Covers Verbal Ability, Numerical Reasoning, Analytical Ability, and General Information.
                  </p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-blue-400">Timed Exam Simulators</div>
                  <p className="text-slate-400 text-[11px]">
                    Exact 170-item timed mocks with 80% passing mark calculations and diagnostic analytics.
                  </p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <div className="font-bold text-purple-400">100% Mobile &amp; Ad-Free</div>
                  <p className="text-slate-400 text-[11px]">
                    Works seamlessly on phones, tablets, and laptops with zero distracting advertisements.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Cash Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black">Request Cash Payout</h3>
                <p className="text-xs text-slate-400">
                  Available Balance: <strong className="text-emerald-400 font-mono">{accounting?.formattedAvailableBalance}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {payoutError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-300 space-y-2">
                <div>{payoutError}</div>
                {idempotencyConflict && (
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

            {payoutSuccessMsg && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-300">
                {payoutSuccessMsg}
              </div>
            )}

            <form onSubmit={handlePayoutSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  Payout Amount (PHP) — Min {accounting?.formattedMinPayout}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 500.00"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Disbursement Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["GCASH", "MAYA", "BANK_TRANSFER"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayoutMethod(m)}
                      className={`p-2.5 rounded-xl border text-xs font-black transition cursor-pointer text-center ${
                        payoutMethod === m
                          ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-lg"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      {m === "GCASH" ? "GCash" : m === "MAYA" ? "Maya" : "Bank Transfer"}
                    </button>
                  ))}
                </div>
              </div>

              {payoutMethod === "BANK_TRANSFER" && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Bank Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BDO, BPI, UnionBank"
                    value={payoutBankName}
                    onChange={(e) => setPayoutBankName(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Account Holder Name</label>
                <input
                  type="text"
                  required
                  placeholder="Full name on your account"
                  value={payoutAccountName}
                  onChange={(e) => setPayoutAccountName(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  {payoutMethod === "GCASH" || payoutMethod === "MAYA" ? "Mobile Number" : "Account Number"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={payoutMethod === "BANK_TRANSFER" ? "e.g. 10928374619" : "e.g. 09171234567"}
                  value={payoutAccountNumber}
                  onChange={(e) => setPayoutAccountNumber(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayout}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {submittingPayout ? "Submitting..." : "Confirm Withdrawal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
