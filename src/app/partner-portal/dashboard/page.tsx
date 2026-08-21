// Relative Path: src/app/partner-portal/dashboard/page.tsx
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
  CreditCard,
  Sparkles,
  Layers,
  FileText,
  Lock,
  ArrowRight,
} from "lucide-react";
import PartnerPortalNav from "@/components/partner/PartnerPortalNav";
import SocialQuizCardExporter from "@/components/partner/SocialQuizCardExporter";

export default function PartnerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const [copiedPromo, setCopiedPromo] = useState(false);
  const [activeTab, setActiveTab] = useState<"financial" | "media-kit">("financial");
  const [copiedScriptIndex, setCopiedScriptIndex] = useState<number | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partner/portal/overview");
      if (res.status === 401) {
        router.push("/partner-portal/login");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load partner dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleCopyLink = () => {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const handleCopyPromo = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedPromo(true);
    setTimeout(() => setCopiedPromo(false), 2500);
  };

  const handleCopyChannelLink = (src: string) => {
    const base = data?.referralLink || `https://govstudyx.com/p/${data?.partner?.partnerId || data?.partner?.code || ""}`;
    const fullUrl = `${base}?src=${src}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedChannel(src);
    setTimeout(() => setCopiedChannel(null), 2500);
  };

  const handleCopyScript = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedScriptIndex(index);
    setTimeout(() => setCopiedScriptIndex(null), 2500);
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

  const { partner, metrics, channelBreakdown, calculationExplanation, referralLink } = data || {};
  const displayPartnerId = partner?.partnerId || partner?.code || "PT-000000";

  const promoScripts = [
    {
      title: "📱 15-Second Video Hook (TikTok / Reels / Shorts)",
      duration: "15 Seconds",
      badge: "Highest Conversion",
      content: `Kung mag-e-exam ka sa Civil Service Exam ngayong 2026, huwag kang mag-memorize nang walang system! Gamitin mo ang GovStudyX — may 2,500+ updated practice questions, timed mock exams, at complete rationalizations. Click the link in my bio or visit ${referralLink} para makapag-practice ka nang libre today! 🚀`,
    },
    {
      title: "🎬 30-Second Vlog / YouTube Integration",
      duration: "30 Seconds",
      badge: "In-Depth Review",
      content: `Quick announcement for everyone reviewing for the 2026 Civil Service Exam: I've officially partnered with GovStudyX to give our community exclusive access to the best CSE online review platform in the Philippines. 

Unlike traditional PDFs, GovStudyX gives you real-time timed mock exams covering Verbal, Math, Analytical, and General Information with instant diagnostic scoring so you know exactly which subjects to focus on. 

Go to ${referralLink} right now to start your free diagnostic exam and secure your 80%+ passing rating!`,
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
🔗 ${referralLink}

I-tag mo na ang study buddy mo! Sama-sama tayong papasa ngayong 2026! 🎓💪`,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PartnerPortalNav partner={partner} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab("financial")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === "financial"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Financial Overview</span>
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
            <span>Creator Media Kit &amp; Social Video Studio</span>
          </button>
        </div>

        {activeTab === "financial" && (
          <div className="space-y-6">
            {/* Header Hero Box */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold font-mono">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Partner ID: {displayPartnerId}</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white">
                    Welcome back, {partner?.name}!
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                    Partner Type: <strong className="text-white">{partner?.type}</strong> &bull; Status:{" "}
                    <strong className="text-emerald-400">{partner?.status}</strong> &bull; Current Agreement:{" "}
                    <strong className="text-white">{partner?.commissionRate}% Commission</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href="/partner-portal/payouts"
                    className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Manage Payouts</span>
                  </Link>

                  <Link
                    href="/partner-portal/statements"
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 border border-slate-700"
                  >
                    <FileText className="w-4 h-4" />
                    <span>View Statements</span>
                  </Link>
                </div>
              </div>

              {/* Referral Link & Promo Code Bar */}
              <div className="p-4 sm:p-6 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Official Partner Tracking URL</span>
                  </span>
                  <span className="text-[11px] text-emerald-400 font-semibold">
                    ✓ 30-Day Attribution Locked Automatically
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="w-full p-3.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-emerald-300 font-bold truncate">
                    {referralLink}
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="w-full sm:w-auto px-5 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition cursor-pointer flex-shrink-0 shadow-lg shadow-emerald-500/20"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copySuccess ? "Copied!" : "Copy Official Link"}</span>
                  </button>
                </div>

                {/* Sub-Tracking Channel Links */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block">
                    1-Click Sub-Tracking Campaign Links:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    {[
                      { id: "youtube", label: "📹 YouTube" },
                      { id: "tiktok", label: "📱 TikTok / Reels" },
                      { id: "fbgroup", label: "👥 FB Group" },
                      { id: "messenger", label: "💬 Messenger" },
                      { id: "email", label: "📧 Email" },
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
                          {copiedChannel === ch.id ? "✓ Copied" : "Copy Link"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 7 MANDATORY FINANCIAL CARDS (Section 13) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* CARD 1: QUALIFYING SALES */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
                <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>Qualifying Sales</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono">
                  {metrics?.formattedQualifyingSales || "₱0.00"}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  {metrics?.totalSalesCount || 0} student conversions
                </p>
              </div>

              {/* CARD 2: TOTAL COMMISSION */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
                <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>Total Commission</span>
                  <Award className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-black text-purple-400 font-mono">
                  {metrics?.formattedTotalCommission || "₱0.00"}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  At {partner?.commissionRate}% partner rate
                </p>
              </div>

              {/* CARD 3: PENDING COMMISSION */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
                <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>Pending Commission</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  {metrics?.formattedPendingCommission || "₱0.00"}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  {partner?.holdingPeriodDays}-day holding period
                </p>
              </div>

              {/* CARD 4: AVAILABLE COMMISSION */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
                <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>Available Commission</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {metrics?.formattedAvailableCommission || "₱0.00"}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Eligible for withdrawal
                </p>
              </div>

              {/* CARD 5: RESERVED FOR PAYOUT */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
                <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>Reserved for Payout</span>
                  <Lock className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-black text-blue-400 font-mono">
                  {metrics?.formattedReservedForPayout || "₱0.00"}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  In processing / review
                </p>
              </div>

              {/* CARD 6: TOTAL PAID */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
                <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>Total Paid</span>
                  <CheckCircle className="w-4 h-4 text-teal-400" />
                </div>
                <div className="text-2xl font-black text-teal-400 font-mono">
                  {metrics?.formattedTotalPaid || "₱0.00"}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Disbursed to GCash/Maya/Bank
                </p>
              </div>

              {/* CARD 7: OUTSTANDING BALANCE */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1 col-span-2">
                <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                  <span>Outstanding Balance</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-emerald-400 font-mono">
                  {metrics?.formattedOutstandingBalance || "₱0.00"}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Min. Payout: <strong className="text-white font-mono">{metrics?.formattedMinPayout}</strong></span>
                  <Link href="/partner-portal/payouts" className="text-emerald-400 hover:underline font-bold flex items-center gap-1">
                    <span>Withdraw Funds</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Traffic Channel Analytics */}
            {channelBreakdown && channelBreakdown.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-black text-white">Traffic Channel Analytics</h3>
                    <p className="text-xs text-slate-400">
                      Conversions and accrued commissions by sub-tracking campaign source.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold">
                    Sub-Tracking Active
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  {channelBreakdown.map((ch: any) => (
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

            {/* Financial Transparency Policy Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase">
                <Info className="w-4 h-4" />
                <span>Financial Engine Transparency Guarantee</span>
              </div>
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-white">
                {calculationExplanation?.formula}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {calculationExplanation?.rule}
              </p>
            </div>
          </div>
        )}

        {activeTab === "media-kit" && (
          <div className="space-y-6">
            <SocialQuizCardExporter
              partnerName={partner?.name || "GovStudyX Partner"}
              partnerCode={displayPartnerId}
              partnerSlug={partner?.slug}
            />

            <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 p-6 rounded-3xl space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-black text-white">Creator Media Kit &amp; Ready-to-Use Scripts</h3>
              </div>
              <p className="text-xs text-slate-400">
                Proven video hooks and post templates tailored for your audience.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>
        )}
      </main>

      <footer className="py-4 text-center text-xs text-slate-600 border-t border-slate-900">
        &copy; {new Date().getFullYear()} GovStudyX Partner Portal. Protected by enterprise security.
      </footer>
    </div>
  );
}
