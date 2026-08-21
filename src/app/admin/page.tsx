// Relative Path: src/app/admin/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Database,
  Activity,
  Sliders,
  Users,
  BookOpen,
  Zap,
  Layers,
  RefreshCw,
  HelpCircle,
  TrendingUp,
  ArrowRight,
  Server,
  Trash2,
  DollarSign,
  FileText,
  BarChart3,
  GraduationCap
} from "lucide-react";

interface QuickStats {
  totalUsers: number;
  paidUsers: number;
  totalQuestions: number;
  systemHealth: string;
  backupCount: number;
}

export default function AdminDashboardHub() {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [statsRes, backupsRes] = await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/backups")
        ]);

        const statsData = statsRes.ok ? await statsRes.json() : {};
        const backupsData = backupsRes.ok ? await backupsRes.json() : {};

        setStats({
          totalUsers: statsData.totalUsers || 0,
          paidUsers: statsData.paidUsers || 0,
          totalQuestions: statsData.totalQuestions || 0,
          systemHealth: backupsData.health?.status || "HEALTHY",
          backupCount: backupsData.backups?.length || 0,
        });
      } catch (err) {
        console.error("Failed to load admin stats", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10 text-slate-100">
      {/* Top Title Banner */}
      <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase tracking-wide">
              EXECUTIVE COMMAND CENTER
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-2">Admin Control Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Categorized management hub for platform operations, disaster recovery, academic engines, and student services.
          </p>
        </div>

        {/* Telemetry Indicator */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl">
          <Server className="w-5 h-5 text-sky-400" />
          <div className="text-xs">
            <div className="text-slate-400 font-medium">Platform Status</div>
            <div className="font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {loading ? "Checking..." : `${stats?.systemHealth || "ONLINE"}`}
            </div>
          </div>
        </div>
      </div>

      {/* Overview Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase">
            Total Examinees
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{loading ? "..." : stats?.totalUsers}</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase">
            PRO Members
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{loading ? "..." : stats?.paidUsers}</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase">
            Question Bank Items
            <BookOpen className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{loading ? "..." : stats?.totalQuestions}</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase">
            Active Vault Backups
            <Database className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{loading ? "..." : stats?.backupCount}</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HUB CATEGORY 1: SYSTEM, SECURITY & PLATFORM OPERATIONS */}
      {/* ========================================================================= */}
      <div className="space-y-6 bg-slate-900/50 border border-slate-800/80 p-6 rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-950 text-sky-400 border border-sky-800">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">1. System, Security & Platform Operations Hub</h2>
              <p className="text-xs text-slate-400 mt-0.5">Disaster recovery, telemetry, configuration flags, trash bin, and pricing models.</p>
            </div>
          </div>
        </div>

        {/* Subcategory 1.1: Analytics & System Telemetry */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            Subcategory: Telemetry & Infrastructure Health
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/admin/dashboard"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-sky-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <BarChart3 className="w-5 h-5 text-sky-400" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">ANALYTICS</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-sky-400 transition">Overview & Analytics</h3>
                <p className="text-xs text-slate-400 mt-1">Examinee engagement trends, exam completion rates, and upgrade metrics.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-sky-400">
                View Analytics <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>

            <Link
              href="/admin/health"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-emerald-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">HEALTH</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-emerald-400 transition">Infrastructure & System Health</h3>
                <p className="text-xs text-slate-400 mt-1">Database latency, memory usage, API error rates, and connection status.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-emerald-400">
                Check Telemetry <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>
          </div>
        </div>

        {/* Subcategory 1.2: Security & Data Vault */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Subcategory: Disaster Recovery & Data Vault
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/admin/backups"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-emerald-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">VAULT</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-emerald-400 transition">Disaster Recovery & Backups</h3>
                <p className="text-xs text-slate-400 mt-1">Automated snapshots, Gzip compression, SHA-256 verifications, and Restores.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-emerald-400">
                Open Vault <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>

            <Link
              href="/admin/trash"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-red-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <Trash2 className="w-5 h-5 text-red-400" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">RECYCLE</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-red-400 transition">Recycled Items & Trash Bin</h3>
                <p className="text-xs text-slate-400 mt-1">Soft-deleted items, restore deleted questions, and permanent purge tools.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-red-400">
                View Trash Bin <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>
          </div>
        </div>

        {/* Subcategory 1.3: System Configurations & Pricing */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            Subcategory: Configurations & Revenue Control
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/admin/system"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-indigo-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">FLAGS</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-indigo-400 transition">System Configs & Feature Flags</h3>
                <p className="text-xs text-slate-400 mt-1">Toggle AI Tutor, Duels, maintenance banners, and review support desk tickets.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-indigo-400">
                Manage Configs <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>

            <Link
              href="/admin/pricing"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <DollarSign className="w-5 h-5 text-amber-400" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">PRO PLANS</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-amber-400 transition">Pricing & Subscriptions</h3>
                <p className="text-xs text-slate-400 mt-1">Configure PRO upgrade prices, access duration rules, and payment tier parameters.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-amber-400">
                Manage Pricing <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>

            <Link
              href="/admin/referrals"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-pink-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xl">🎁</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-950 text-pink-400 border border-pink-800">REWARD 20%</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-pink-400 transition">Referral &amp; Reward System</h3>
                <p className="text-xs text-slate-400 mt-1">Manage 20% referral commissions, payouts queue, rates, and fraud telemetry.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-pink-400">
                Open Referral Center <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>

            <Link
              href="/admin/accounting"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-emerald-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xl">📊</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">LEDGER</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-emerald-400 transition">Accounting &amp; Finance</h3>
                <p className="text-xs text-slate-400 mt-1">Double-entry general journal, waterfall calculations, partner commissions, and cash reconciliation.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-emerald-400">
                Open Financial Hub <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HUB CATEGORY 2: ACADEMIC, CONTENT & EXAM ENGINE */}
      {/* ========================================================================= */}
      <div className="space-y-6 bg-slate-900/50 border border-slate-800/80 p-6 rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-950 text-purple-400 border border-purple-800">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">2. Academic, Content & Exam Engine Hub</h2>
              <p className="text-xs text-slate-400 mt-0.5">Question banks, elimination drills, flashcard decks, study materials, examinee accounts, and CSC sync.</p>
            </div>
          </div>
        </div>

        {/* Subcategory 2.1: Practice & Arena Engines */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            Subcategory: Question Banks & Gamified Practice
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/admin/questions"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-purple-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800">ITEMS</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-purple-400 transition">Question Bank Management</h3>
                <p className="text-xs text-slate-400 mt-1">Create, edit, tag, and publish items across Numerical, Verbal, and Analytical domains.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-purple-400">
                Open Questions <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>

            <Link
              href="/admin/elimination-drills"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">ARENA</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-amber-400 transition">Elimination Drills & 1v1 Duels</h3>
                <p className="text-xs text-slate-400 mt-1">Real-time match history, ELO rating multipliers, and duel arena parameters.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-amber-400">
                Manage Arena <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>

            <Link
              href="/admin/flashcards"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-emerald-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">MEMORIZE</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-emerald-400 transition">Spaced Repetition Flashcards</h3>
                <p className="text-xs text-slate-400 mt-1">Flashcard decks for PH Constitution, RA 6713, and Vocabulary drills.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-emerald-400">
                Manage Decks <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>
          </div>
        </div>

        {/* Subcategory 2.2: Learning Materials & Reviewers */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            Subcategory: Learning Materials & Handbooks
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/admin/reviewer"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-indigo-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">REVIEWER</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-indigo-400 transition">Reviewer Modules & Notes</h3>
                <p className="text-xs text-slate-400 mt-1">Structured study notes, topic guides, and exam subject breakdowns.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-indigo-400">
                Manage Reviewers <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>

            <Link
              href="/admin/reading-materials"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-pink-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <FileText className="w-5 h-5 text-pink-400" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-950 text-pink-400 border border-pink-800">READING</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-pink-400 transition">Reading Materials & Downloads</h3>
                <p className="text-xs text-slate-400 mt-1">PDF handbooks, downloadable practice sets, and official reference guides.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-pink-400">
                Manage Materials <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>
          </div>
        </div>

        {/* Subcategory 2.3: Student Body & Official Integrations */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            Subcategory: Student Body & Official Data
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/admin/users"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-cyan-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">ACCOUNTS</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-cyan-400 transition">Examinee Accounts & Roles</h3>
                <p className="text-xs text-slate-400 mt-1">Elevate user roles, grant PRO access, check activity logs, and review login history.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-cyan-400">
                Manage Accounts <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>

            <Link
              href="/admin/csc-sync"
              className="group p-4 bg-slate-900 border border-slate-800 hover:border-pink-500/60 rounded-xl transition duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <RefreshCw className="w-5 h-5 text-pink-400" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-950 text-pink-400 border border-pink-800">OFFICIAL</span>
                </div>
                <h3 className="font-bold text-white text-sm mt-3 group-hover:text-pink-400 transition">CSC Sync & Official Schedules</h3>
                <p className="text-xs text-slate-400 mt-1">Scrape official Civil Service Commission announcements, schedules, and downloads.</p>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-pink-400">
                Manage CSC Sync <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}