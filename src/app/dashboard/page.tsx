"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
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

interface AnalyticsData {
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

function DashboardContent() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({ notesCount: 0, handbooksCount: 0 });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
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

          const [notesRes, hbRes, analyticsRes, pricingRes] = await Promise.all([
            fetch("/api/reviewer"),
            fetch("/api/reading-materials"),
            fetch("/api/user/analytics/detailed"),
            fetch("/api/pricing"),
          ]);

          const [notesData, hbData, analyticsData, pricingData] = await Promise.all([
            notesRes.json(),
            hbRes.json(),
            analyticsRes.json(),
            pricingRes.json(),
          ]);

          setStats({
            notesCount: notesData.notes?.length || 0,
            handbooksCount: hbData.handbooks?.length || 0,
          });

          if (pricingRes.ok && pricingData.plans) {
            setPlans(pricingData.plans);
          }

          if (analyticsRes.ok && analyticsData.analytics) {
            setAnalytics(analyticsData.analytics);
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
      <div className="max-w-5xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        {verifyingPayment ? "⚡ Verifying payment and updating subscription..." : "Loading student dashboard..."}
      </div>
    );
  }

  const isAdmin = user?.role === "ADMIN";
  const isPaid = user?.isPaid || isAdmin;

  // Calculate days remaining for active plans
  let daysRemaining: number | null = null;
  if (user?.paidUntil) {
    const diff = new Date(user.paidUntil).getTime() - new Date().getTime();
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  const activePlanPrice = plans.find((p) => p.planType === selectedPlan)?.price || 299;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      {/* Payment Success Alert */}
      {paymentStatus === "success" && (
        <div className="bg-emerald-500 text-slate-950 p-4 rounded-2xl font-black text-xs flex justify-between items-center shadow-md">
          <span>🎉 Payment Verified! Your PRO Access duration has been calculated.</span>
        </div>
      )}

      {/* Admin Quick Switch Banner */}
      {isAdmin && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex justify-between items-center text-amber-900 text-xs font-bold">
          <span>⚡ Logged in as Administrator.</span>
          <Link
            href="/admin/pricing"
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition"
          >
            ⚙️ Manage Plan Pricing &rarr;
          </Link>
        </div>
      )}

      {/* DYNAMIC PLAN SELECTOR BANNER */}
      {!isPaid && (
        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl border border-amber-500/40 space-y-6">
          <div>
            <span className="text-[10px] font-black uppercase px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
              Select Reviewer Access Plan
            </span>
            <h2 className="text-2xl font-black mt-2 text-white">Upgrade or Renew Your PRO Pass</h2>
            <p className="text-xs text-slate-400 mt-1">
              Choose your review duration. All plans include full access to mock exams, drills, and notes.
            </p>
          </div>

          {/* Pricing Options Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plans.map((p) => (
              <button
                key={p.planType}
                onClick={() => setSelectedPlan(p.planType)}
                className={`p-5 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                  selectedPlan === p.planType
                    ? "bg-amber-500/10 border-amber-500 text-white"
                    : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                {p.planType === "6_MONTHS" && (
                  <span className="absolute -top-3 right-4 px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full uppercase">
                    Popular
                  </span>
                )}
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{p.name}</span>
                  <span className="text-2xl font-black text-amber-400">₱{p.price}</span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    {p.durationDays > 0 ? `Valid for ${p.durationDays} days` : "Lifetime access"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => handlePayMongoCheckout(selectedPlan)}
            disabled={checkoutLoading}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-2xl shadow-lg transition disabled:opacity-50"
          >
            {checkoutLoading ? "Launching PayMongo..." : `Pay ₱${activePlanPrice} via PayMongo 💳`}
          </button>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
              {isPaid ? "PRO Student Account" : "Free Preview Account"}
            </span>

            {isPaid && daysRemaining !== null && (
              <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
                ⏳ {daysRemaining} Days Remaining
              </span>
            )}
            {isPaid && daysRemaining === null && !isAdmin && (
              <span className="text-xs font-bold px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                ♾️ Lifetime Access
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold mt-2">
            Welcome back, {user?.name || "Reviewee"}!
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Track your Civil Service Exam performance and study progress.
          </p>
        </div>

        {isPaid ? (
          <div className="flex items-center gap-2">
            {daysRemaining !== null && (
              <button
                onClick={() => handlePayMongoCheckout("6_MONTHS")}
                className="px-4 py-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 font-bold text-xs rounded-xl transition"
              >
                🔄 Extend Plan (+180 Days)
              </button>
            )}
            <Link
              href="/mock-exam/take"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-sm transition shrink-0"
            >
              Start Full Mock Exam 📝
            </Link>
          </div>
        ) : (
          <button
            onClick={() => handlePayMongoCheckout(selectedPlan)}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition shrink-0"
          >
            🔒 Unlock PRO Access
          </button>
        )}
      </div>

      {/* ANALYTICS STAT CARDS */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Average Score</span>
            <div className="text-2xl font-black text-slate-900">{analytics.summary.averageScore}%</div>
            <span className={`text-[11px] font-bold ${analytics.summary.averageScore >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
              {analytics.summary.averageScore >= 80 ? "Above Passing (80%)" : "Target: 80%+"}
            </span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Highest Score</span>
            <div className="text-2xl font-black text-blue-600">{analytics.summary.highestScore}%</div>
            <span className="text-[11px] font-bold text-slate-400">Personal Best</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Exams Completed</span>
            <div className="text-2xl font-black text-slate-900">{analytics.summary.totalExamsTaken}</div>
            <span className="text-[11px] font-bold text-purple-600">Full Practice Mock Exams</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pass Outlook</span>
            <div className="text-2xl font-black text-emerald-600">{analytics.summary.estimatedPassRate}</div>
            <span className="text-[11px] font-bold text-emerald-600">Based on History</span>
          </div>
        </div>
      )}

      {/* CHARTS */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black text-slate-900">Score History & Progression</h2>
                <p className="text-xs text-slate-500">Your mock exam scores over time</p>
              </div>
              <span className="text-xs font-extrabold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full">
                Passing Cutoff: 80%
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
                      contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "12px" }}
                    />
                    <Area type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#scoreColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Subject Mastery</h2>
              <p className="text-xs text-slate-500">Accuracy rate by core category</p>
            </div>

            <div className="space-y-4 pt-2">
              {analytics.categoryBreakdown.map((cat, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>{cat.category}</span>
                    <span className="text-slate-900 font-extrabold">{cat.score}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className={`h-2.5 rounded-full ${cat.color}`} style={{ width: `${cat.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Student Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md">
              Primary Practice
            </span>
            <span className="text-xs font-bold text-slate-400">Timed Mode</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Full Practice Mock Exam</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Take simulated civil service exams with comprehensive questions across all core subjects.
          </p>
          {isPaid ? (
            <Link
              href="/mock-exam/take"
              className="inline-block w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs text-center rounded-xl transition"
            >
              Start Exam
            </Link>
          ) : (
            <button
              onClick={() => handlePayMongoCheckout(selectedPlan)}
              className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 transition"
            >
              🔒 Unlock Mock Exam
            </button>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md">
              5-Min Challenge
            </span>
            <span className="text-xs font-bold text-slate-400">Rapid Fire</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Category Speed Drills</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Focus on specific subjects like Numerical Reasoning or Verbal Ability under 5 minutes.
          </p>
          {isPaid ? (
            <Link
              href="/drills"
              className="inline-block w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs text-center rounded-xl transition"
            >
              Launch Drills
            </Link>
          ) : (
            <button
              onClick={() => handlePayMongoCheckout(selectedPlan)}
              className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 transition"
            >
              🔒 Unlock Speed Drills
            </button>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md">
              Live Reviewer
            </span>
            <span className="text-xs font-bold text-slate-600">{stats.notesCount} Active Notes</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Study Notes & Cheat Sheets</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Review core principles, subject-verb agreement rules, and formulas published by admins.
          </p>
          {isPaid ? (
            <Link
              href="/reviewer"
              className="inline-block w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs text-center rounded-xl transition"
            >
              Read Study Notes
            </Link>
          ) : (
            <button
              onClick={() => handlePayMongoCheckout(selectedPlan)}
              className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 transition"
            >
              🔒 Unlock Study Notes
            </button>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-purple-50 text-purple-700 rounded-md">
              PDF Repository
            </span>
            <span className="text-xs font-bold text-slate-600">{stats.handbooksCount} Handbooks</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Official Reading Materials</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Read official constitutional references, R.A. 6713 ethical standards, and PDF handbooks.
          </p>
          {isPaid ? (
            <Link
              href="/reading-materials"
              className="inline-block w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs text-center rounded-xl transition"
            >
              Open Reader
            </Link>
          ) : (
            <button
              onClick={() => handlePayMongoCheckout(selectedPlan)}
              className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 transition"
            >
              🔒 Unlock Handbooks
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudentDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
          Loading student dashboard...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}