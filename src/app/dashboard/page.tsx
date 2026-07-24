"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [userRes, notesRes, hbRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/reviewer"),
          fetch("/api/reading-materials"),
        ]);

        const [userData, notesData, hbData] = await Promise.all([
          userRes.json(),
          notesRes.json(),
          hbRes.json(),
        ]);

        if (userRes.ok && userData.user) {
          setUser(userData.user);
        }

        setStats({
          notesCount: notesData.notes?.length || 0,
          handbooksCount: hbData.handbooks?.length || 0,
        });
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading student dashboard...
      </div>
    );
  }

  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      {/* Admin Quick Switch Banner (Visible ONLY to Admins) */}
      {isAdmin && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex justify-between items-center text-amber-900 text-xs font-bold">
          <div className="flex items-center gap-2">
            <span>⚡ You are logged in as an Administrator.</span>
          </div>
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
              {user?.isPaid ? "PRO Student Account" : "Free Reviewee Account"}
            </span>
          </div>
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

        {/* Study Notes (Auto-Synced) */}
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

        {/* Read-Only Handbooks (Auto-Synced) */}
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