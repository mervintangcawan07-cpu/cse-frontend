// Relative Path: src/app/dashboard/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import ResumeExamBanner from "@/components/dashboard/ResumeExamBanner";
import CSCCountdownWidget from "@/components/CSCCountdownWidget";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface UserProfile {
  name: string;
  email: string;
  role: string;
  isPaid: boolean;
  paidUntil?: string | null;
  planType?: string | null;
}

interface Plan {
  planType: string;
  name: string;
  price: number;
  durationDays: number;
}

interface DetailedAnalytics {
  summary: {
    totalExamsTaken: number;
    averageScore: number;
    highestScore: number;
    drillsCompleted: number;
    estimatedPassRate: string;
  };
  scoreHistory: { date: string; score: number; passing: number }[];
  categoryBreakdown: { category: string; score: number; color: string }[];
}

interface DashboardAnalytics {
  totalExams: number;
  averageScore: number;
  passReadinessScore: number;
  currentStreak: number;
  longestStreak: number;
  totalBookmarks: number;
  recommendation: string;
  recentHistory: Array<{
    id: string;
    score: number;
    correct: number;
    totalItems: number;
    date: string;
  }>;
}

function DashboardContent() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [analytics, setAnalytics] = useState<DetailedAnalytics | null>(null);
  const [dashAnalytics, setDashAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("6_MONTHS");
  const [chartMounted, setChartMounted] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentStatus = searchParams.get("payment");

  useEffect(() => {
    setChartMounted(true);

    async function checkAuthAndLoadDashboard() {
      if (paymentStatus === "success") {
        setVerifyingPayment(true);
        try {
          await fetch("/api/paymongo/verify", { method: "POST" });
        } catch (err) {
          console.error("Payment sync error:", err);
        } finally {
          setVerifyingPayment(false);
        }
      }

      try {
        const userRes = await fetch("/api/auth/me");
        const userData = await userRes.json();

        if (userRes.ok && userData.user) {
          setUser(userData.user);

          const [analyticsRes, pricingRes, dashAnalyticsRes] = await Promise.all([
            fetch("/api/user/analytics/detailed"),
            fetch("/api/pricing"),
            fetch("/api/analytics/dashboard"),
          ]);

          const [analyticsData, pricingData, dashAnalyticsData] = await Promise.all([
            analyticsRes.json(),
            pricingRes.json(),
            dashAnalyticsRes.json(),
          ]);

          if (pricingRes.ok && pricingData.plans) {
            setPlans(pricingData.plans);
          }

          if (analyticsRes.ok && analyticsData.analytics) {
            setAnalytics(analyticsData.analytics);
          }

          if (dashAnalyticsRes.ok) {
            setDashAnalytics(dashAnalyticsData);
          }
        } else {
          router.push("/login");
        }
      } catch (err) {
        console.error("Dashboard auth check failed:", err);
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndLoadDashboard();
  }, [paymentStatus, router]);

  const handlePayMongoCheckout = async (planType: string) => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/paymongo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });
      const data = await res.json();

      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || "Failed to launch PayMongo checkout.");
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to payment server.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading || verifyingPayment) {
    return (
      <div className="max-w-6xl mx-auto py-24 text-center font-bold text-slate-400 animate-pulse flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs uppercase tracking-widest font-black text-slate-500">
          {verifyingPayment
            ? "⚡ Verifying payment & syncing subscription..."
            : "Initializing your command center..."}
        </p>
      </div>
    );
  }

  const isAdmin = user?.role === "ADMIN";
  const isPaid = user?.isPaid || isAdmin;

  let daysRemaining: number | null = null;
  if (user?.paidUntil) {
    const diff = new Date(user.paidUntil).getTime() - new Date().getTime();
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  const activePlanPrice =
    plans.find((p) => p.planType === selectedPlan)?.price || 199;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
      {/* PAYMENT SUCCESS ALERT */}
      {paymentStatus === "success" && (
        <div className="bg-emerald-500 text-slate-950 p-4 rounded-2xl font-black text-xs flex justify-between items-center shadow-lg border border-emerald-400/40 animate-in fade-in duration-300">
          <span>🎉 Payment Verified! Your PRO Access duration has been updated.</span>
        </div>
      )}

      {/* ADMIN QUICK SWITCH BANNER */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 p-4 rounded-2xl flex justify-between items-center text-amber-300 text-xs font-bold backdrop-blur-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1 bg-amber-500/20 rounded-lg text-amber-400">⚙️</span>
            <span>Logged in with Administrator privileges.</span>
          </div>
          <Link
            href="/admin/pricing"
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition shadow-md shrink-0"
          >
            Manage Plan Pricing &rarr;
          </Link>
        </div>
      )}

      {/* PAUSED EXAM RESUME BANNER */}
      <ResumeExamBanner />

      {/* WELCOME HERO HEADER */}
      <div className="relative bg-slate-900 text-white p-6 md:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-4 z-30 overflow-hidden">
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 w-full">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20 shadow-inner">
                {isPaid ? "✨ PRO Examinee Access" : "Free Preview Account"}
              </span>

              {isPaid && daysRemaining !== null && (
                <span className="text-[11px] font-black px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20 shadow-inner">
                  ⏳ {daysRemaining} Days Remaining
                </span>
              )}
              {isPaid && daysRemaining === null && !isAdmin && (
                <span className="text-[11px] font-black px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 shadow-inner">
                  ⏳ Active Lifetime / Custom Pass
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-black mt-3 tracking-tight text-white">
              Welcome back, {user?.name || "Reviewee"}!
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-xl font-medium">
              Monitor your real-time civil service test readiness, study streaks, and high-frequency exam categories.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap max-w-full relative z-20 mt-2 xl:mt-0">
            <NotificationBell />

            <Link
              href="/readiness-card"
              className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs rounded-2xl transition flex items-center gap-1.5 backdrop-blur-sm whitespace-nowrap"
            >
              <span>🏆</span>
              <span>Flex Readiness Card</span>
            </Link>

            {isPaid ? (
              <div className="flex items-center gap-2">
                {daysRemaining !== null && (
                  <button
                    onClick={() => handlePayMongoCheckout("6_MONTHS")}
                    className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-2xl transition cursor-pointer"
                  >
                    🔄 Extend Pass
                  </button>
                )}
                <Link
                  href="/practice"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>⚡</span>
                  <span>Practice Center</span>
                </Link>
              </div>
            ) : (
              <button
                onClick={() => handlePayMongoCheckout(selectedPlan)}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 transition cursor-pointer whitespace-nowrap"
              >
                🔒 Upgrade to PRO
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AUTOMATIC CSC EXAMINATION TIMETABLE & COUNTDOWN WIDGET */}
      <CSCCountdownWidget />

      {/* DYNAMIC PLAN SELECTOR BANNER */}
      {!isPaid && (
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl border border-amber-500/40 space-y-6 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-amber-500/10 rounded-full blur-2xl"></div>
          <div>
            <span className="text-[10px] font-black uppercase px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
              Unlock Unlimited Mock Exams & Drills
            </span>
            <h2 className="text-2xl font-black mt-2 text-white">Upgrade or Renew Your Review Pass</h2>
            <p className="text-xs text-slate-400 mt-1">
              Gain full access to the 170-item mock exam player, specialized strategy drills, and official handbooks.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
            {plans.map((p) => (
              <button
                key={p.planType}
                onClick={() => setSelectedPlan(p.planType)}
                className={`p-5 rounded-2xl border text-left transition relative flex flex-col justify-between cursor-pointer ${
                  selectedPlan === p.planType
                    ? "bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/10"
                    : "bg-slate-800/60 border-slate-700/80 text-slate-300 hover:border-slate-500"
                }`}
              >
                {p.planType === "6_MONTHS" && (
                  <span className="absolute -top-3 right-4 px-2.5 py-0.5 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full uppercase shadow-md">
                    Most Popular
                  </span>
                )}
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{p.name}</span>
                  <span className="text-2xl font-black text-amber-400">₱{p.price}</span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Valid for {p.durationDays} days
                  </span>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => handlePayMongoCheckout(selectedPlan)}
            disabled={checkoutLoading}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-2xl shadow-xl transition disabled:opacity-50 cursor-pointer relative z-10"
          >
            {checkoutLoading ? "Launching PayMongo Portal..." : `Unlock PRO via PayMongo (₱${activePlanPrice}) 💳`}
          </button>
        </div>
      )}

      {/* PERFORMANCE METRICS & OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">Study Streak</span>
            <span className="text-2xl p-2 bg-amber-500/10 rounded-2xl border border-amber-500/20">🔥</span>
          </div>
          <div className="text-3xl font-black text-amber-400">
            {dashAnalytics ? `${dashAnalytics.currentStreak} Days` : "0 Days"}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Personal Best: {dashAnalytics?.longestStreak || 0} Days</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Pass Readiness</span>
              <span className="text-2xl p-2 bg-emerald-50 rounded-2xl border border-emerald-100">🎯</span>
            </div>
            <div className="text-3xl font-black text-emerald-600 mt-2">
              {dashAnalytics ? `${dashAnalytics.passReadinessScore}%` : "0%"}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">Passing Target: 80% Cutoff</p>
          </div>
          <Link
            href="/readiness-card"
            className="text-[11px] font-bold text-blue-600 hover:text-blue-500 transition block mt-2"
          >
            🏆 Shareable Card &rarr;
          </Link>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Mock Exams</span>
            <span className="text-2xl p-2 bg-blue-50 rounded-2xl border border-blue-100">📝</span>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {analytics?.summary.totalExamsTaken ?? dashAnalytics?.totalExams ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Overall Avg: {analytics?.summary.averageScore ?? dashAnalytics?.averageScore ?? 0}%
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Bookmarks</span>
            <span className="text-2xl p-2 bg-purple-50 rounded-2xl border border-purple-100">🔖</span>
          </div>
          <div className="text-3xl font-black text-purple-600">
            {dashAnalytics?.totalBookmarks || 0}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Saved Items for Review</p>
        </div>
      </div>

      {/* AI STUDY RECOMMENDATION CARD */}
      {dashAnalytics?.recommendation && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-3xl flex items-start gap-3.5 backdrop-blur-sm">
          <span className="text-2xl shrink-0 mt-0.5 p-2 bg-amber-500/20 rounded-2xl">💡</span>
          <div>
            <h3 className="text-xs font-black uppercase text-amber-800 dark:text-amber-300 tracking-wider">
              Personalized AI Study Focus
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1 leading-relaxed">
              {dashAnalytics.recommendation}
            </p>
          </div>
        </div>
      )}

      {/* PERFORMANCE CHARTS */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black text-slate-900">Score Progression</h2>
                <p className="text-xs text-slate-500">Historical performance across mock exam attempts</p>
              </div>
              <span className="text-xs font-extrabold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                80% Benchmark
              </span>
            </div>

            <div className="h-64 w-full pt-4">
              {chartMounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.scoreHistory}>
                    <defs>
                      <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderRadius: "16px",
                        border: "none",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#2563eb"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#scoreColor)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Subject Mastery</h2>
              <p className="text-xs text-slate-500 font-medium">Accuracy rate by core subject</p>
            </div>

            <div className="space-y-4 pt-2">
              {analytics.categoryBreakdown.map((cat, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>{cat.category}</span>
                    <span className="text-slate-900 font-extrabold">{cat.score}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full ${cat.color}`}
                      style={{ width: `${cat.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto py-24 text-center font-bold text-slate-400 animate-pulse flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs uppercase tracking-widest font-black text-slate-500">
            Loading student dashboard...
          </p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}