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
            <Link href="/dashboard" className="text-xs text-slate-400 hover:text-white transition">
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-black text-white">🏆 Achievements & Badges</h1>
          <p className="text-xs text-slate-400 mt-1">
            Earn badges by hitting milestones across exams, streaks, mastery, and social features.
          </p>
        </div>
        <Link
          href="/profile"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 shrink-0"
        >
          ⚙️ Profile Settings
        </Link>
      </div>

      {/* Rarity Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Rarity:</span>
        {[
          { label: "Common", color: "text-slate-400" },
          { label: "Rare", color: "text-blue-400" },
          { label: "Epic", color: "text-violet-400" },
          { label: "Legendary", color: "text-amber-400" },
        ].map((r) => (
          <span key={r.label} className={`text-[10px] font-black uppercase tracking-wider ${r.color}`}>
            {r.label}
          </span>
        ))}
      </div>

      {/* Badge Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <BadgeDisplay />
      </div>
    </div>
  );
}
