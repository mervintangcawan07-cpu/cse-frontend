"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface StatsData {
  totalUsers: number;
  paidUsers: number;
  totalRevenue: number;
  totalQuestions: number;
  totalNotes: number;
  totalHandbooks: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<StatsData>({
    totalUsers: 0,
    paidUsers: 0,
    totalRevenue: 0,
    totalQuestions: 0,
    totalNotes: 0,
    totalHandbooks: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/admin/stats");
        const data = await res.json();
        if (res.ok) {
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to load admin stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
            ⚙️ Real-Time Analytics & Control
          </span>
          <h1 className="text-3xl font-black mt-3">Admin Dashboard</h1>
          <p className="text-slate-400 text-xs mt-1">
            Track user registrations, PRO revenue earnings, and manage app content.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition"
        >
          👁️ Switch to Student View &rarr;
        </Link>
      </div>

      {/* Analytics Counter Grid */}
      {loading ? (
        <div className="py-12 text-center font-bold text-slate-400 animate-pulse">
          Loading platform analytics...
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-extrabold uppercase text-slate-400">Total Users</span>
            <p className="text-3xl font-black text-slate-900">{stats.totalUsers}</p>
            <p className="text-[11px] text-slate-500">Registered accounts</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-extrabold uppercase text-purple-600">PRO Subscribers</span>
            <p className="text-3xl font-black text-purple-900">{stats.paidUsers}</p>
            <p className="text-[11px] text-purple-600 font-semibold">Active paid accounts</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-extrabold uppercase text-emerald-600">Payments Received</span>
            <p className="text-3xl font-black text-emerald-700">₱{stats.totalRevenue.toLocaleString()}</p>
            <p className="text-[11px] text-emerald-600 font-semibold">Total gross revenue</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-extrabold uppercase text-blue-600">Total Materials</span>
            <p className="text-3xl font-black text-blue-900">
              {stats.totalQuestions + stats.totalNotes + stats.totalHandbooks}
            </p>
            <p className="text-[11px] text-slate-500">
              {stats.totalQuestions} Qs • {stats.totalNotes} Notes • {stats.totalHandbooks} Docs
            </p>
          </div>
        </div>
      )}

      {/* Admin Module Navigation Cards */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold text-slate-900">Management Modules</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Module 1: Admin Study Notes */}
          <Link
            href="/admin/reviewer"
            className="p-6 bg-white hover:bg-amber-50/40 rounded-3xl border border-slate-200 hover:border-amber-400 transition shadow-sm hover:shadow-md space-y-3 block group"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md">
                Study Notes Editor
              </span>
              <span className="text-xs font-bold text-amber-700">{stats.totalNotes} Published</span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-amber-900">
              📝 Admin Study Notes Manager
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Create, edit, or delete study rules, formulas, and pro-tips. Automatically syncs to student accounts.
            </p>
            <span className="text-xs font-bold text-amber-700 inline-block pt-1">Open Study Notes Manager &rarr;</span>
          </Link>

          {/* Module 2: Admin Handbooks & Docs */}
          <Link
            href="/admin/reading-materials"
            className="p-6 bg-white hover:bg-emerald-50/40 rounded-3xl border border-slate-200 hover:border-emerald-400 transition shadow-sm hover:shadow-md space-y-3 block group"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md">
                PDF & Word Documents
              </span>
              <span className="text-xs font-bold text-emerald-700">{stats.totalHandbooks} Uploaded</span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-emerald-900">
              📚 Admin Handbooks & Docs Manager
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload, edit, or delete PDF and Word documents (`.pdf`, `.doc`, `.docx`) for read-only viewing inside the app.
            </p>
            <span className="text-xs font-bold text-emerald-700 inline-block pt-1">Open Handbooks Manager &rarr;</span>
          </Link>

          {/* Module 3: Question Bank Manager */}
          <Link
            href="/admin/questions"
            className="p-6 bg-white hover:bg-blue-50/40 rounded-3xl border border-slate-200 hover:border-blue-400 transition shadow-sm hover:shadow-md space-y-3 block group"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md">
                Exam Question Bank
              </span>
              <span className="text-xs font-bold text-blue-700">{stats.totalQuestions} Questions</span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-blue-900">
              ❓ Question Bank Manager
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Add new multiple-choice questions, update options, and manage explanations for mock exams and drills.
            </p>
            <span className="text-xs font-bold text-blue-700 inline-block pt-1">Open Question Bank &rarr;</span>
          </Link>

          {/* Module 4: User Accounts & Payments */}
          <Link
            href="/admin/users"
            className="p-6 bg-white hover:bg-purple-50/40 rounded-3xl border border-slate-200 hover:border-purple-400 transition shadow-sm hover:shadow-md space-y-3 block group"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-purple-100 text-purple-800 rounded-md">
                User Management
              </span>
              <span className="text-xs font-bold text-purple-700">{stats.paidUsers} Paid PRO</span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-purple-900">
              👥 User Accounts & PRO Subscriptions
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              View registered users, grant or revoke PRO access status, update passwords, and manage user roles.
            </p>
            <span className="text-xs font-bold text-purple-700 inline-block pt-1">Manage Users & Payments &rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}