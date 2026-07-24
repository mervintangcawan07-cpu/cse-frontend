"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AdminStats {
  questions: number;
  users: number;
  paidUsers: number;
  revenue: number;
  notes: number;
  handbooks: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>({
    questions: 0,
    users: 0,
    paidUsers: 0,
    revenue: 0,
    notes: 0,
    handbooks: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminStats() {
      try {
        const [qRes, uRes, nRes, hRes] = await Promise.all([
          fetch("/api/questions"),
          fetch("/api/admin/users"),
          fetch("/api/reviewer"),
          fetch("/api/reading-materials"),
        ]);

        const [qData, uData, nData, hData] = await Promise.all([
          qRes.json(),
          uRes.json(),
          nRes.json(),
          hRes.json(),
        ]);

        const usersList = Array.isArray(uData.users) ? uData.users : [];
        const paidCount = usersList.filter((u: any) => u.isPaid).length;

        setStats({
          questions: qData.questions?.length || 0,
          users: usersList.length,
          paidUsers: paidCount,
          revenue: paidCount * 299, // ₱299 per PRO upgrade
          notes: nData.notes?.length || 0,
          handbooks: hData.handbooks?.length || 0,
        });
      } catch (err) {
        console.error("Failed to load admin stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAdminStats();
  }, []);

  const adminModules = [
    {
      title: "Question Bank Manager",
      description: "Create, edit, or remove exam questions, options, and explanations.",
      count: `${stats.questions} Questions`,
      href: "/admin/questions",
      badge: "Exam Engine",
      color: "border-blue-200 bg-blue-50/50 hover:border-blue-400",
    },
    {
      title: "User Accounts & Subscriptions",
      description: "Manage registered reviewees, assign roles, and toggle PRO status.",
      count: `${stats.users} Users (${stats.paidUsers} PRO)`,
      href: "/admin/users",
      badge: "Account Control",
      color: "border-purple-200 bg-purple-50/50 hover:border-purple-400",
    },
    {
      title: "Study Notes Manager",
      description: "Publish and edit reviewer rules, formulas, and exam pro-tips.",
      count: `${stats.notes} Study Notes`,
      href: "/admin/reviewer",
      badge: "Synced Reviewer",
      color: "border-amber-200 bg-amber-50/50 hover:border-amber-400",
    },
    {
      title: "Handbooks & Documents Manager",
      description: "Upload and manage PDF or Word documents for read-only viewing.",
      count: `${stats.handbooks} Handbooks`,
      href: "/admin/reading-materials",
      badge: "Repository",
      color: "border-emerald-200 bg-emerald-50/50 hover:border-emerald-400",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 space-y-8">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
            ⚙️ System Administration
          </span>
          <h1 className="text-3xl font-black mt-3">Admin Control Center</h1>
          <p className="text-slate-400 text-xs mt-1">
            Real-time analytics, PRO subscription revenue, and platform content management.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition"
        >
          👁️ Preview Student View &rarr;
        </Link>
      </div>

      {/* Analytics Counter Cards */}
      {loading ? (
        <div className="py-12 text-center font-bold text-slate-400 animate-pulse">
          Loading administration metrics...
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-extrabold uppercase text-slate-400">Total Users</span>
            <p className="text-3xl font-black text-slate-900">{stats.users}</p>
            <p className="text-[11px] text-slate-500">Registered accounts</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-extrabold uppercase text-purple-600">PRO Subscribers</span>
            <p className="text-3xl font-black text-purple-900">{stats.paidUsers}</p>
            <p className="text-[11px] text-purple-600 font-semibold">Upgraded accounts</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-extrabold uppercase text-emerald-600">Total Revenue</span>
            <p className="text-3xl font-black text-emerald-700">₱{stats.revenue.toLocaleString()}</p>
            <p className="text-[11px] text-emerald-600 font-semibold">Estimated gross earnings</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-extrabold uppercase text-blue-600">Content Repository</span>
            <p className="text-3xl font-black text-blue-900">
              {stats.questions + stats.notes + stats.handbooks}
            </p>
            <p className="text-[11px] text-slate-500">
              {stats.questions} Qs • {stats.notes} Notes • {stats.handbooks} Docs
            </p>
          </div>
        </div>
      )}

      {/* Module Control Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold text-slate-900">Management Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adminModules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`p-6 rounded-3xl border ${m.color} transition shadow-sm hover:shadow-md flex flex-col justify-between space-y-4`}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-white border rounded-md text-slate-700">
                    {m.badge}
                  </span>
                  <span className="text-xs font-bold text-slate-500">{m.count}</span>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">{m.title}</h3>
                <p className="text-slate-600 text-xs leading-relaxed">{m.description}</p>
              </div>

              <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1 pt-2">
                <span>Manage Module</span>
                <span>&rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}