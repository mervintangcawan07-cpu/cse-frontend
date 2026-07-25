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
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [chartMounted, setChartMounted] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentStatus = searchParams.get("payment");

  useEffect(() => {
    setChartMounted(true);

    async function checkAuthAndLoadDashboard() {
      // 1. Instant payment verification fallback if returning from PayMongo checkout
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

      // 2. Fetch user session
      try {
        const userRes = await fetch("/api/auth/me");
        const userData = await userRes.json();

        if (userRes.ok && userData.user) {
          setUser(userData.user);

          // Fetch stats & detailed analytics
          const [notesRes, hbRes, analyticsRes] = await Promise.all([
            fetch("/api/reviewer"),
            fetch("/api/reading-materials"),
            fetch("/api/user/analytics/detailed"),
          ]);

          const [notesData, hbData, analyticsData] = await Promise.all([
            notesRes.json(),
            hbRes.json(),
            analyticsRes.json(),
          ]);

          setStats({
            notesCount: notesData.notes?.length || 0,
            handbooksCount: hbData.handbooks?.length || 0,
          });

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

  const handlePayMongoCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/paymongo/checkout", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || "Failed to launch PayMongo checkout gateway.");
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
        {verifyingPayment ? "⚡ Verifying payment and activating PRO Account..." : "Loading student dashboard..."}
      </div>
    );
  }

  const isAdmin = user?.role === "ADMIN";
  const isPaid = user?.isPaid || isAdmin;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      {/* Payment Success Alert */}
      {paymentStatus === "success" && (
        <div className="bg-emerald-500 text-slate-950 p-4 rounded-2xl font-black text-xs flex justify-between items-center shadow-md">
          <span>🎉 Payment Verified! Your account is now fully upgraded to PRO!</span>
        </div>
      )}

      {/* Admin Quick Switch Banner */}
      {isAdmin && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex justify-between items-center text-amber-900 text-xs font-bold">
          <span>⚡ Logged in as Administrator.</span>
          <Link
            href="/admin/dashboard"
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition"
          >
            Go to Admin Control Center &rarr;
          </Link>
        </div>
      )}

      {/* PAYMONGO PRO UPGRADE BANNER (Shown ONLY for Unpaid Users) */}
      {!isPaid && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 rounded-3xl shadow-xl border border-amber-500/40 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-700/80 pb-6">
            <div>
              <span className="text-[10px] font-black uppercase px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
                🔒 Preview Mode
              </span>
              <h2 className="text-2xl font-black mt-2 text-white">Upgrade to Civil Service Exam PRO</h2>
              <p className="text-xs text-slate-400 mt-1">
                Unlock lifetime access to all timed mock exams, category speed drills, and study notes.
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <span className="text-3xl font-black text-amber-400">₱499</span>
              <span className="block text-[11px] text-slate-400 font-medium">One-Time Lifetime Pass</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <ul className="text-xs space-y-2 text-slate-300 font-medium">
              <li className="flex items-center gap-2"><span className="text-emerald-400 font-bold">✓</span> Full Timed Practice Mock Exams</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400 font-bold">✓</span> 5-Minute Rapid Category Speed Drills</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400 font-bold">✓</span> Read-Only Handbooks & Study Notes</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400 font-bold">✓</span> Instant Automatic Unlock via GCash / Maya / Card</li>
            </ul>

            <button
              onClick={handlePayMongoCheckout}
              disabled={checkoutLoading}
              className="w-full sm:w-auto px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-2xl shadow-lg transition disabled:opacity-50 shrink-0"
            >
              {checkoutLoading ? "Connecting..." : "Pay ₱499 via PayMongo 💳"}
            </button>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
            {isPaid ? "PRO Student Account" : "Free Preview Account"}
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold mt-2">
            Welcome back, {user?.name || "Reviewee"}!
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Track your Civil Service Exam performance and study progress.
          </p>
        </div>

        {isPaid ? (
          <Link
            href="/mock-exam/take"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-sm transition shrink-0"
          >
            Start Full Mock Exam 📝
          </Link>
        ) : (
          <button
            onClick={handlePayMongoCheckout}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition shrink-0"
          >
            🔒 Unlock PRO (₱499)
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

      {/* ANALYTICS VISUALIZATION CHARTS */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Score Trend Area Chart */}
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

          {/* Subject Proficiency Breakdown */}
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

      {/* Main Student Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Full Mock Exam */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
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
              onClick={handlePayMongoCheckout}
              className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 transition flex items-center justify-center gap-2"
            >
              <span>🔒 Unlock Mock Exam (₱499)</span>
            </button>
          )}
        </div>

        {/* Speed Drills */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
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
              onClick={handlePayMongoCheckout}
              className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 transition flex items-center justify-center gap-2"
            >
              <span>🔒 Unlock Speed Drills (₱499)</span>
            </button>
          )}
        </div>

        {/* Study Notes */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
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
              onClick={handlePayMongoCheckout}
              className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 transition flex items-center justify-center gap-2"
            >
              <span>🔒 Unlock Study Notes (₱499)</span>
            </button>
          )}
        </div>

        {/* Read-Only Handbooks */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
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
              onClick={handlePayMongoCheckout}
              className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 transition flex items-center justify-center gap-2"
            >
              <span>🔒 Unlock Handbooks (₱499)</span>
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