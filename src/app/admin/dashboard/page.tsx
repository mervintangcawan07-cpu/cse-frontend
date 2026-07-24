"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    questions: 0,
    users: 0,
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

        setStats({
          questions: qData.questions?.length || 0,
          users: uData.users?.length || 0,
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
      description: "Create, edit, or remove exam questions and explanations.",
      count: `${stats.questions} Active Questions`,
      href: "/admin/questions",
      badge: "Exam Engine",
      color: "border-blue-200 bg-blue-50/50 hover:border-blue-400",
    },
    {
      title: "User Accounts & Subscriptions",
      description: "Manage registered reviewees and upgrade accounts to PRO status.",
      count: `${stats.users} Total Users`,
      href: "/admin/users",
      badge: "Account Control",
      color: "border-purple-200 bg-purple-50/50 hover:border-purple-400",
    },
    {
      title: "Study Notes Manager",
      description: "Publish and update reviewer rules, formulas, and pro-tips.",
      count: `${stats.notes} Published Notes`,
      href: "/admin/reviewer",
      badge: "Synced Reviewer",
      color: "border-amber-200 bg-amber-50/50 hover:border-amber-400",
    },
    {
      title: "Handbooks & Documents Manager",
      description: "Upload local PDF documents for read-only browser viewing.",
      count: `${stats.handbooks} PDF Documents`,
      href: "/admin/reading-materials",
      badge: "Repository",
      color: "border-emerald-200 bg-emerald-50/50 hover:border-emerald-400",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
            ⚙️ System Administration
          </span>
          <h1 className="text-3xl font-black mt-3">Admin Control Center</h1>
          <p className="text-slate-400 text-xs mt-1">
            Manage practice questions, user payments, study notes, and PDF handbooks.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition"
        >
          👁️ Preview Student View &rarr;
        </Link>
      </div>

      {/* Control Grid */}
      {loading ? (
        <div className="py-20 text-center font-bold text-slate-400 animate-pulse">
          Loading administration metrics...
        </div>
      ) : (
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
                <h2 className="text-xl font-extrabold text-slate-900">{m.title}</h2>
                <p className="text-slate-600 text-xs leading-relaxed">{m.description}</p>
              </div>

              <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1 pt-2">
                <span>Manage Module</span>
                <span>&rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}