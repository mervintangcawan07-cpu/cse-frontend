// Relative Path: src/components/admin/AdminTelemetryStats.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Server,
  Users,
  TrendingUp,
  BookOpen,
  Database,
} from "lucide-react";

interface QuickStats {
  totalUsers: number;
  paidUsers: number;
  totalQuestions: number;
  systemHealth: string;
  backupCount: number;
}

export default function AdminTelemetryStats({
  children,
}: {
  children: ReactNode;
}) {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [statsRes, backupsRes] = await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/backups"),
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
    <>
      {/* Top Title Banner */}
      <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {children}

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
    </>
  );
}
