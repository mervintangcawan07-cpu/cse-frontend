"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import NotificationBell from "@/components/NotificationBell";
import ResumeExamBanner from "@/components/dashboard/ResumeExamBanner";
import CSCCountdownWidget from "@/components/CSCCountdownWidget";
import CSCDailyQuestionWidget from "@/components/cse/CSCDailyQuestionWidget";
import DatabaseLoadingIndicator from "@/components/common/DatabaseLoadingIndicator";
import PaymentConfirmationLoader from "@/components/common/PaymentConfirmationLoader";
import WidgetErrorBoundary from "@/components/common/WidgetErrorBoundary";
import { useAuth } from "@/context/AuthContext";
import {
  PROMO_PRICING_DISPLAY,
  getPromoReferencePrice,
} from "@/config/promoPricingDisplay";

const ScoreAnalyticsChart = dynamic(
  () => import("@/components/dashboard/ScoreAnalyticsChart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-56 sm:h-64 w-full bg-slate-50 dark:bg-slate-800/40 rounded-2xl animate-pulse flex items-center justify-center border border-slate-100 dark:border-slate-800">
        <span className="text-xs text-slate-400 font-semibold">Loading chart metrics...</span>
      </div>
    ),
  }
);

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

const DEFAULT_PLANS: readonly Plan[] = [
  {
    planType: "1_MONTH",
    name: "1-Month Pass",
    price: 99,
    durationDays: 30,
  },
  {
    planType: "6_MONTHS",
    name: "6-Month Pass",
    price: 199,
    durationDays: 180,
  },
  {
    planType: "1_YEAR",
    name: "1-Year Pass",
    price: 299,
    durationDays: 365,
  },
];

const DEFAULT_DASHBOARD_ANALYTICS: DashboardAnalytics = {
  totalExams: 0,
  averageScore: 0,
  passReadinessScore: 0,
  currentStreak: 1,
  longestStreak: 1,
  totalBookmarks: 0,
  recommendation: "Focus on your daily practice question to build exam confidence.",
  recentHistory: [],
};

async function syncPaymentVerification(signal?: AbortSignal): Promise<void> {
  try {
    await fetch("/api/paymongo/verify", { method: "POST", signal });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    console.error("Payment sync error:", err);
  }
}

async function fetchDashboardDatasets(signal?: AbortSignal) {
  return Promise.allSettled([
    fetch("/api/pricing", { cache: "no-store", signal }).then((r) => (r.ok ? r.json() : null)),
    fetch("/api/analytics/dashboard", { signal }).then((r) => (r.ok ? r.json() : null)),
    fetch("/api/user/analytics/detailed", { signal }).then((r) => (r.ok ? r.json() : null)),
  ]);
}

function applyDashboardResults(
  results: [
    PromiseSettledResult<{ plans?: Plan[] } | null>,
    PromiseSettledResult<DashboardAnalytics | null>,
    PromiseSettledResult<{ analytics?: DetailedAnalytics } | null>,
  ],
  handlers: {
    setPlans: (plans: Plan[]) => void;
    setDashAnalytics: (data: DashboardAnalytics) => void;
    setAnalytics: (data: DetailedAnalytics | null) => void;
    setAnalyticsError: (error: boolean) => void;
  }
): void {
  const [plansRes, dashRes, analyticsRes] = results;

  if (plansRes.status === "fulfilled" && plansRes.value?.plans) {
    handlers.setPlans(plansRes.value.plans);
  }

  if (dashRes.status === "fulfilled" && dashRes.value) {
    handlers.setDashAnalytics(dashRes.value);
  } else {
    handlers.setDashAnalytics(DEFAULT_DASHBOARD_ANALYTICS);
  }

  if (analyticsRes.status === "fulfilled" && analyticsRes.value?.analytics) {
    handlers.setAnalytics(analyticsRes.value.analytics);
    handlers.setAnalyticsError(false);
  } else {
    handlers.setAnalyticsError(true);
  }
}

function DashboardContent() {
  const { user, status: authStatus, refreshAuth } = useAuth();
  const [plans, setPlans] = useState<readonly Plan[]>(DEFAULT_PLANS);
  const [analytics, setAnalytics] = useState<DetailedAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [dashAnalytics, setDashAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("6_MONTHS");
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentStatus = searchParams.get("payment");

  // Defer Date.now() calculation inside a timer to prevent synchronous render impurity and cascading renders
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!user?.paidUntil) {
        setDaysRemaining(null);
        return;
      }
      const targetTime = new Date(user.paidUntil).getTime();
      const diff = targetTime - Date.now();
      setDaysRemaining(Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))));
    }, 0);

    return () => clearTimeout(timer);
  }, [user?.paidUntil]);

  const fetchAnalyticsOnly = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(false);
    try {
      const res = await fetch("/api/user/analytics/detailed");
      if (res.ok) {
        const data = await res.json();
        if (data.analytics) {
          setAnalytics(data.analytics);
          setAnalyticsError(false);
          return;
        }
      }
      setAnalyticsError(true);
    } catch (err: unknown) {
      console.warn("Could not reload analytics:", err);
      setAnalyticsError(true);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "loading") return;

    if (authStatus === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (authStatus === "error" || !user) {
      const timer = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(timer);
    }

    const controller = new AbortController();

    async function checkAuthAndLoadDashboard() {
      if (paymentStatus === "success") {
        setVerifyingPayment(true);
        await syncPaymentVerification(controller.signal);
        if (!controller.signal.aborted) {
          setVerifyingPayment(false);
        }
      }

      try {
        const currentUser =
          paymentStatus === "success"
            ? await refreshAuth("entitlement")
            : user;

        if (!currentUser) {
          router.push("/login");
          return;
        }

        if (controller.signal.aborted) return;

        const results = await fetchDashboardDatasets(controller.signal);
        if (controller.signal.aborted) return;

        applyDashboardResults(results, {
          setPlans,
          setDashAnalytics,
          setAnalytics,
          setAnalyticsError,
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Dashboard auth check failed:", err);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void checkAuthAndLoadDashboard();

    return () => {
      controller.abort();
    };
  }, [authStatus, paymentStatus, refreshAuth, router, user]);

  const handlePayMongoCheckout = async (planType: string) => {
    if (checkoutLoading) return;

    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/paymongo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });
      const data = await res.json();

      if (res.ok && data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      } else {
        alert(data.error || "Failed to launch PayMongo checkout.");
      }
    } catch (err: unknown) {
      console.error("PayMongo checkout error:", err);
      alert("Error connecting to payment server.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const isAdmin = user?.role === "ADMIN";
  const isPaid = Boolean(user?.isPaid || isAdmin);

  const activePlanPrice = useMemo(() => {
    return plans.find((p) => p.planType === selectedPlan)?.price || 199;
  }, [plans, selectedPlan]);

  const renderSubscriptionActionButton = () => {
    if (!isPaid) {
      return (
        <button
          type="button"
          onClick={() => void handlePayMongoCheckout(selectedPlan)}
          className="col-span-1 py-2 px-3 bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-bold text-xs rounded-xl sm:rounded-2xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap text-center min-h-[44px]"
        >
          <span className="text-sm">🔒</span>
          <span>Upgrade</span>
        </button>
      );
    }

    if (daysRemaining !== null) {
      return (
        <button
          type="button"
          onClick={() => void handlePayMongoCheckout("6_MONTHS")}
          className="col-span-1 py-2 px-3 bg-white/15 hover:bg-white/25 active:scale-[0.99] text-white border border-white/20 font-bold text-xs rounded-xl sm:rounded-2xl transition cursor-pointer flex items-center justify-center gap-1.5 backdrop-blur-md whitespace-nowrap text-center min-h-[44px]"
        >
          <span className="text-sm">🔄</span>
          <span>Extend</span>
        </button>
      );
    }

    return null;
  };

  const renderPerformanceCharts = () => {
    if (analyticsLoading) {
      return (
        <div className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-md text-center space-y-2">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Refreshing exam performance statistics...</p>
        </div>
      );
    }

    if (analyticsError || !analytics) {
      return (
        <div className="bg-slate-900 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30 shrink-0">
              📊
            </span>
            <div>
              <h3 className="text-sm font-black text-white">Exam Statistics Temporarily Unavailable</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Your mock exams, questions, and streak counters are operating normally.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchAnalyticsOnly()}
            disabled={analyticsLoading}
            className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap text-center"
          >
            🔄 Retry Loading Stats
          </button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-6">
        <div className="md:col-span-2 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-md space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">Score Progression</h2>
              <p className="text-[11px] sm:text-xs text-slate-500">Historical performance across mock exam attempts</p>
            </div>
            <span className="text-[10px] sm:text-xs font-extrabold px-2.5 sm:px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 shrink-0">
              80% Benchmark
            </span>
          </div>

          <div className="h-56 sm:h-64 w-full pt-2 sm:pt-4">
            <ScoreAnalyticsChart scoreHistory={analytics.scoreHistory} />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-md space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">Subject Mastery</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Accuracy rate by core subject</p>
          </div>

          <div className="space-y-3.5 sm:space-y-4 pt-1 sm:pt-2">
            {analytics.categoryBreakdown.map((cat) => (
              <div key={cat.category} className="space-y-1 sm:space-y-1.5">
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
    );
  };

  if (loading || verifyingPayment) {
    return (
      <div className="w-full px-2 py-3 sm:px-4 sm:py-6 md:px-6 lg:px-8 space-y-4 sm:space-y-6">
        <PaymentConfirmationLoader isOpen={verifyingPayment} />
        <DatabaseLoadingIndicator
          title="Loading Reviewee Dashboard & Analytics..."
          subtitle="Querying real-time civil service readiness metrics, study streak, and diagnostic scores."
          skeletonCount={4}
        />
      </div>
    );
  }

  return (
    <div className="w-full px-2 py-3 sm:px-4 sm:py-6 md:px-6 lg:px-8 space-y-4 sm:space-y-8">
      <PaymentConfirmationLoader isOpen={verifyingPayment} />

      {paymentStatus === "success" && (
        <div className="bg-emerald-500 text-slate-950 p-4 rounded-2xl font-black text-xs flex justify-between items-center shadow-lg border border-emerald-400/40 animate-in fade-in duration-300">
          <span>🎉 Payment Verified! Your PRO Access duration has been updated.</span>
        </div>
      )}

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

      <ResumeExamBanner />

      {/* Welcome Hero Header */}
      <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-3.5 sm:p-5 md:p-6 lg:p-7 rounded-2xl sm:rounded-3xl shadow-xl shadow-blue-600/15 z-30">
        <div className="absolute inset-0 rounded-2xl sm:rounded-3xl overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col gap-3 sm:gap-4 w-full">
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider px-2.5 sm:px-3 py-0.5 sm:py-1 bg-white/20 text-white rounded-full border border-white/30 shadow-inner backdrop-blur-md whitespace-nowrap">
                {isPaid ? "✨ PRO Examinee Access" : "Free Preview Account"}
              </span>

              {isPaid && daysRemaining !== null && (
                <span className="text-[10px] sm:text-[11px] font-black px-2.5 sm:px-3 py-0.5 sm:py-1 bg-amber-400 text-slate-950 rounded-full shadow-md whitespace-nowrap">
                  ⏳ {daysRemaining} Days Remaining
                </span>
              )}
            </div>

            <div className="shrink-0">
              <NotificationBell />
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-5 lg:gap-6">
            <div className="space-y-1 max-w-xl min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white break-words">
                Welcome back, {user?.name || "Reviewee"}!
              </h1>
              <p className="text-blue-100 text-xs sm:text-sm font-medium leading-relaxed">
                <span className="hidden sm:inline">
                  Monitor your real-time civil service test readiness, study streaks, and high-frequency exam categories.
                </span>
                <span className="sm:hidden">
                  Track your Civil Service readiness and study progress.
                </span>
              </p>
            </div>

            <div className="flex flex-col gap-2 w-full lg:w-72 shrink-0">
              <Link
                href="/practice"
                className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-900 active:scale-[0.99] text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-xl transition flex items-center justify-center gap-2 whitespace-nowrap min-h-[46px]"
              >
                <span>⚡</span>
                <span>Practice Center</span>
              </Link>

              <div className="grid grid-cols-2 gap-2 w-full">
                <Link
                  href="/readiness-card"
                  className={`py-2 px-3 bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-bold text-xs rounded-xl sm:rounded-2xl transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap text-center min-h-[44px] ${
                    isPaid && daysRemaining === null ? "col-span-2" : "col-span-1"
                  }`}
                >
                  <span className="text-sm">🏆</span>
                  <span>Flex Card</span>
                </Link>

                {renderSubscriptionActionButton()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <WidgetErrorBoundary fallbackTitle="CSC Examination Timetable Unavailable">
        <CSCCountdownWidget />
      </WidgetErrorBoundary>

      <WidgetErrorBoundary fallbackTitle="Daily Practice Challenge Unavailable">
        <CSCDailyQuestionWidget />
      </WidgetErrorBoundary>

      {/* Dynamic Plan Selector Banner */}
      {!isPaid && (
        <div className="bg-slate-900 text-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-xl border border-amber-500/40 space-y-4 sm:space-y-6 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-amber-500/10 rounded-full blur-2xl" />
          <div>
            <span className="text-[10px] font-black uppercase px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
              Unlock Unlimited Mock Exams &amp; Drills
            </span>
            <h2 className="text-xl sm:text-2xl font-black mt-2 text-white">Upgrade or Renew Your Review Pass</h2>
            <p className="text-xs text-slate-400 mt-1">
              Gain full access to the 170-item mock exam player, specialized strategy drills, and official handbooks.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 relative z-10">
            {plans.map((p) => {
              const promoRefPrice = getPromoReferencePrice(p.planType);

              return (
                <button
                  key={p.planType}
                  type="button"
                  onClick={() => setSelectedPlan(p.planType)}
                  className={`p-3.5 sm:p-5 rounded-2xl border text-left transition relative flex flex-col justify-between cursor-pointer ${
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
                    {promoRefPrice && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-semibold text-slate-400 line-through">
                          ₱{promoRefPrice}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          {PROMO_PRICING_DISPLAY.badgeText}
                        </span>
                      </div>
                    )}
                    <span className="text-xl sm:text-2xl font-black text-amber-400">₱{p.price}</span>
                    <span className="text-[11px] text-slate-400 block mt-1">
                      Valid for {p.durationDays} days
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void handlePayMongoCheckout(selectedPlan)}
            disabled={checkoutLoading}
            className="w-full py-3.5 sm:py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-xl transition disabled:opacity-50 cursor-pointer relative z-10"
          >
            {checkoutLoading ? "Launching PayMongo Portal..." : `Unlock PRO via PayMongo (₱${activePlanPrice}) 💳`}
          </button>
        </div>
      )}

      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-5">
        <div className="bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-md space-y-2 sm:space-y-3 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[10px] sm:text-xs text-slate-500 font-extrabold uppercase tracking-wider">Study Streak</span>
            <span className="text-lg sm:text-2xl p-1.5 sm:p-2 bg-amber-50 rounded-2xl border border-amber-100">🔥</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-amber-500">
              {dashAnalytics ? `${dashAnalytics.currentStreak} Days` : "0 Days"}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5">
              Best: {dashAnalytics?.longestStreak || 0} Days
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-md space-y-2 sm:space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs text-slate-500 font-extrabold uppercase tracking-wider">Pass Readiness</span>
              <span className="text-lg sm:text-2xl p-1.5 sm:p-2 bg-emerald-50 rounded-2xl border border-emerald-100">🎯</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1.5">
              {dashAnalytics ? `${dashAnalytics.passReadinessScore}%` : "0%"}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5">Target: 80% Cutoff</p>
          </div>
          <Link
            href="/readiness-card"
            className="text-[10px] sm:text-[11px] font-bold text-blue-600 hover:text-blue-500 transition block mt-1"
          >
            🏆 Share Card &rarr;
          </Link>
        </div>

        <div className="bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-md space-y-2 sm:space-y-3 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[10px] sm:text-xs text-slate-500 font-extrabold uppercase tracking-wider">Mock Exams</span>
            <span className="text-lg sm:text-2xl p-1.5 sm:p-2 bg-blue-50 rounded-2xl border border-blue-100">📝</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {analytics?.summary.totalExamsTaken ?? dashAnalytics?.totalExams ?? 0}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5">
              Avg: {analytics?.summary.averageScore ?? dashAnalytics?.averageScore ?? 0}%
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-md space-y-2 sm:space-y-3 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[10px] sm:text-xs text-slate-500 font-extrabold uppercase tracking-wider">Bookmarks</span>
            <span className="text-lg sm:text-2xl p-1.5 sm:p-2 bg-purple-50 rounded-2xl border border-purple-100">🔖</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-purple-600">
              {dashAnalytics?.totalBookmarks || 0}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5">Saved for Review</p>
          </div>
        </div>
      </div>

      {/* AI Study Recommendation Card */}
      {dashAnalytics?.recommendation && (
        <div className="bg-amber-50 border border-amber-200/90 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl flex items-start gap-3 shadow-sm">
          <span className="text-xl sm:text-2xl shrink-0 mt-0.5 p-1.5 sm:p-2 bg-amber-100 rounded-2xl text-amber-700">💡</span>
          <div>
            <h3 className="text-[10px] sm:text-xs font-black uppercase text-amber-900 tracking-wider">
              Personalized AI Study Focus
            </h3>
            <p className="text-xs text-slate-700 font-medium mt-1 leading-relaxed">
              {dashAnalytics.recommendation}
            </p>
          </div>
        </div>
      )}

      {/* Performance Charts */}
      <WidgetErrorBoundary
        fallbackTitle="Performance Charts Temporarily Unavailable"
        onRetry={fetchAnalyticsOnly}
      >
        {renderPerformanceCharts()}
      </WidgetErrorBoundary>
    </div>
  );
}

export default function StudentDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full py-24 text-center font-bold text-slate-400 animate-pulse flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
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