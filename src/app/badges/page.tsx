// Relative Path: src/app/badges/page.tsx
"use client";

import Link from "next/link";
import BadgeDisplay from "@/components/profile/BadgeDisplay";

export default function BadgesPage() {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="mb-2">
            <Link href="/dashboard" className="text-xs text-blue-600 hover:text-blue-500 font-bold transition">
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">🏆 Achievements & Badges</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Earn badges by hitting milestones across exams, streaks, mastery, and social features.
          </p>
        </div>
        <Link
          href="/profile"
          className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition border border-slate-200 shadow-sm shrink-0"
        >
          ⚙️ Profile Settings
        </Link>
      </div>

      {/* Rarity Legend */}
      <div className="flex items-center gap-3 flex-wrap bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rarity:</span>
        {[
          { label: "Common", color: "text-slate-600 font-bold" },
          { label: "Rare", color: "text-blue-600 font-bold" },
          { label: "Epic", color: "text-violet-600 font-bold" },
          { label: "Legendary", color: "text-amber-600 font-black" },
        ].map((r) => (
          <span key={r.label} className={`text-[10px] font-black uppercase tracking-wider ${r.color}`}>
            {r.label}
          </span>
        ))}
      </div>

      {/* Badge Grid */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-md">
        <BadgeDisplay />
      </div>
    </div>
  );
}
