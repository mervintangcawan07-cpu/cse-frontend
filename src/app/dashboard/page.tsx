"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

interface UserProfile {
  name: string;
  email: string;
  role: string;
  isPaid: boolean;
}

export default function StudentDashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({ notesCount: 0, handbooksCount: 0 });
  const [loading, setLoading] = useState(true);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentStatus = searchParams.get("payment");
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    async function checkAuthAndLoadDashboard() {
      // 1. Instant payment verification fallback if returning from PayMongo checkout
      if (paymentStatus === "success" && sessionId) {
        setVerifyingPayment(true);
        try {
          await fetch("/api/paymongo/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
        } catch (err) {
          console.error("Payment sync failed:", err);
        } finally {
          setVerifyingPayment(false);
        }
      }

      // 2. Fetch current user session
      try {
        const userRes = await fetch("/api/auth/me");
        const userData = await userRes.json();

        if (userRes.ok && userData.user) {
          const currentUser = userData.user;
          setUser(currentUser);

          // 🔒 STRICT PAYWALL GUARD: Redirect unpaid users to /upgrade
          if (!currentUser.isPaid && currentUser.role !== "ADMIN") {
            router.push("/upgrade");
            return;
          }

          // Fetch dashboard stats for authorized paid users
          const [notesRes, hbRes] = await Promise.all([
            fetch("/api/reviewer"),
            fetch("/api/reading-materials"),
          ]);
          const [notesData, hbData] = await Promise.all([
            notesRes.json(),
            hbRes.json(),
          ]);

          setStats({
            notesCount: notesData.notes?.length || 0,
            handbooksCount: hbData.handbooks?.length || 0,
          });
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
  }, [paymentStatus, sessionId, router]);

  if (loading || verifyingPayment) {
    return (
      <div className="max-w-5xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        {verifyingPayment ? "⚡ Activating PRO Account..." : "Verifying account access..."}
      </div>
    );
  }

  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      {/* Payment Success Alert */}
      {paymentStatus === "success" && (
        <div className="bg-emerald-500 text-slate-950 p-4 rounded-2xl font-black text-xs flex justify-between items-center shadow-md">
          <span>🎉 Payment Verified! Welcome to Civil Service Exam PRO!</span>
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

      {/* Welcome Banner */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
            PRO Student Account
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold mt-2">
            Welcome back, {user?.name || "Reviewee"}!
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Track your Civil Service Exam preparation and practice modules below.
          </p>
        </div>

        <Link
          href="/mock-exam/take"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-sm transition"
        >
          Start Full Mock Exam 📝
        </Link>
      </div>

      {/* Main Student Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Full Mock Exam */}
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
          <Link
            href="/mock-exam/take"
            className="inline-block w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs text-center rounded-xl transition"
          >
            Start Exam
          </Link>
        </div>

        {/* Speed Drills */}
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
          <Link
            href="/drills"
            className="inline-block w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs text-center rounded-xl transition"
          >
            Launch Drills
          </Link>
        </div>

        {/* Study Notes */}
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
          <Link
            href="/reviewer"
            className="inline-block w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs text-center rounded-xl transition"
          >
            Read Study Notes
          </Link>
        </div>

        {/* Read-Only Handbooks */}
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
          <Link
            href="/reading-materials"
            className="inline-block w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs text-center rounded-xl transition"
          >
            Open Reader
          </Link>
        </div>
      </div>
    </div>
  );
}