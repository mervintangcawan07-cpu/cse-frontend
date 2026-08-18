// Relative Path: src/app/badges/page.tsx
"use client";

import Link from "next/link";
import BadgeDisplay from "@/components/profile/BadgeDisplay";

export default function BadgesPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-2 py-3 sm:px-4 sm:py-6 md:px-6">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
        {/* Header - Seamlessly integrated */}
        <div className="bg-slate-900 text-white p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="mb-2">
              <Link href="/dashboard" className="text-xs text-blue-400 hover:text-blue-300 font-bold transition">
                ← Back to Dashboard
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">🏆 Achievements & Badges</h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
              Earn badges by hitting milestones across exams, streaks, mastery, and social features.
            </p>
          </div>
          <Link
            href="/profile"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700 shadow-xs shrink-0"
          >
            ⚙️ Profile Settings
          </Link>
        </div>

        {/* Content Section Inside Unified Frame */}
        <div className="p-3.5 sm:p-6 md:p-8 bg-slate-50/60 space-y-6">
          {/* Rarity Legend */}
          <div className="flex items-center gap-3 flex-wrap bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
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
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs">
            <BadgeDisplay />
          </div>
        </div>
      </div>
    </div>
  );
}
