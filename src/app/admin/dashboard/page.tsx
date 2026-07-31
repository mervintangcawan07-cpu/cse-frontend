"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MaintenanceToggleCard from "@/components/admin/MaintenanceToggleCard";

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
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
            ⚙️ Real-Time Analytics & System Control
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight pt-1">
            Admin Command Center
          </h1>
          <p className="text-slate-400 text-xs md:text-sm font-medium leading-relaxed max-w-2xl">
            Monitor real-time examinee registrations, PRO revenue metrics, enforce platform security, and manage core learning content.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-2xl border border-slate-700 transition-all shadow-md hover:shadow-lg shrink-0 flex items-center gap-2 group"
        >
          <span>👁️ Switch to Student View</span>
          <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
        </Link>
      </div>

      {/* 🛠️ SYSTEM MAINTENANCE MODE CONTROLLER */}
      <MaintenanceToggleCard />

      {/* Analytics Counter Grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3 animate-pulse">
              <div className="h-3 bg-slate-200 rounded-full w-24" />
              <div className="h-8 bg-slate-200 rounded-xl w-16" />
              <div className="h-2 bg-slate-100 rounded-full w-32" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Total Users
            </span>
            <p className="text-3xl md:text-4xl font-black text-slate-900">{stats.totalUsers}</p>
            <p className="text-[11px] text-slate-500 font-medium">Registered examinee accounts</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-purple-100 shadow-sm hover:shadow-md transition space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-purple-600">
              PRO Subscribers
            </span>
            <p className="text-3xl md:text-4xl font-black text-purple-900">{stats.paidUsers}</p>
            <p className="text-[11px] text-purple-600 font-bold">Active paid access plans</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm hover:shadow-md transition space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">
              Payments Received
            </span>
            <p className="text-3xl md:text-4xl font-black text-emerald-700">
              ₱{stats.totalRevenue.toLocaleString()}
            </p>
            <p className="text-[11px] text-emerald-600 font-bold">Total gross platform revenue</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm hover:shadow-md transition space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600">
              Learning Materials
            </span>
            <p className="text-3xl md:text-4xl font-black text-blue-900">
              {stats.totalQuestions + stats.totalNotes + stats.totalHandbooks}
            </p>
            <p className="text-[11px] text-slate-500 font-medium">
              {stats.totalQuestions} Qs • {stats.totalNotes} Notes • {stats.totalHandbooks} Docs
            </p>
          </div>
        </div>
      )}

      {/* Admin Module Navigation Cards */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-900">Management Control Modules</h2>
          <span className="text-xs text-slate-400 font-semibold">Select a module to manage content</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Module 1: User Accounts, Bans & Login Audit */}
          <Link
            href="/admin/users"
            className="p-6 bg-white hover:bg-purple-50/50 rounded-3xl border border-slate-200 hover:border-purple-300 transition-all duration-200 shadow-sm hover:shadow-md space-y-3 block group"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-3 py-1 bg-purple-100 text-purple-800 rounded-full tracking-wider">
                Security & Accounts Center
              </span>
              <span className="text-xs font-bold text-purple-700">{stats.paidUsers} PRO Users</span>
            </div>
            <h3 className="text-lg font-black text-slate-900 group-hover:text-purple-900 transition-colors flex items-center justify-between">
              <span>👥 User Accounts, Bans & Audit Logs</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Search examinees, extend or revoke PRO subscriptions, enforce account bans, reset passwords, and inspect failed login attempt audit logs.
            </p>
            <span className="text-xs font-extrabold text-purple-700 inline-block pt-1">
              Open User Security & Audit Center &rarr;
            </span>
          </Link>

          {/* Module 2: Feature Flags & Support Tickets (NEW) */}
          <Link
            href="/admin/system"
            className="p-6 bg-white hover:bg-rose-50/50 rounded-3xl border border-slate-200 hover:border-rose-300 transition-all duration-200 shadow-sm hover:shadow-md space-y-3 block group"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-3 py-1 bg-rose-100 text-rose-800 rounded-full tracking-wider">
                System Toggles & Helpdesk
              </span>
              <span className="text-xs font-bold text-rose-700">Live Controls</span>
            </div>
            <h3 className="text-lg font-black text-slate-900 group-hover:text-rose-900 transition-colors flex items-center justify-between">
              <span>🚩 Feature Flags & Support Tickets</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Enable or disable platform modules (Duels, AI Assistant, Flashcards) in real-time and review examinee support tickets.
            </p>
            <span className="text-xs font-extrabold text-rose-700 inline-block pt-1">
              Open Feature Flags & Support Tickets &rarr;
            </span>
          </Link>

          {/* Module 3: Question Bank Manager */}
          <Link
            href="/admin/questions"
            className="p-6 bg-white hover:bg-blue-50/50 rounded-3xl border border-slate-200 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md space-y-3 block group"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-3 py-1 bg-blue-100 text-blue-800 rounded-full tracking-wider">
                Exam Question Bank
              </span>
              <span className="text-xs font-bold text-blue-700">{stats.totalQuestions} Questions</span>
            </div>
            <h3 className="text-lg font-black text-slate-900 group-hover:text-blue-900 transition-colors flex items-center justify-between">
              <span>❓ Question Bank Manager</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Add new multiple-choice questions, inline edit existing choices, perform bulk JSON uploads, and batch-delete obsolete questions.
            </p>
            <span className="text-xs font-extrabold text-blue-700 inline-block pt-1">
              Open Question Bank Manager &rarr;
            </span>
          </Link>

          {/* Module 4: Admin Study Notes */}
          <Link
            href="/admin/reviewer"
            className="p-6 bg-white hover:bg-amber-50/50 rounded-3xl border border-slate-200 hover:border-amber-300 transition-all duration-200 shadow-sm hover:shadow-md space-y-3 block group"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-3 py-1 bg-amber-100 text-amber-800 rounded-full tracking-wider">
                Study Notes Editor
              </span>
              <span className="text-xs font-bold text-amber-700">{stats.totalNotes} Published</span>
            </div>
            <h3 className="text-lg font-black text-slate-900 group-hover:text-amber-900 transition-colors flex items-center justify-between">
              <span>📝 Admin Study Notes Manager</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Create, update, or remove key study formulas, civil service rules, and expert tips. Changes immediately sync to student accounts.
            </p>
            <span className="text-xs font-extrabold text-amber-700 inline-block pt-1">
              Open Study Notes Manager &rarr;
            </span>
          </Link>

          {/* Module 5: Admin Handbooks & Docs */}
          <Link
            href="/admin/reading-materials"
            className="p-6 bg-white hover:bg-emerald-50/50 rounded-3xl border border-slate-200 hover:border-emerald-300 transition-all duration-200 shadow-sm hover:shadow-md space-y-3 block group"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full tracking-wider">
                PDF & Word Documents
              </span>
              <span className="text-xs font-bold text-emerald-700">{stats.totalHandbooks} Uploaded</span>
            </div>
            <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-900 transition-colors flex items-center justify-between">
              <span>📚 Admin Handbooks & Docs Manager</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Upload, organize, and manage official PDF and Word documents (`.pdf`, `.doc`, `.docx`) for in-app viewing and reference.
            </p>
            <span className="text-xs font-extrabold text-emerald-700 inline-block pt-1">
              Open Handbooks Manager &rarr;
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}