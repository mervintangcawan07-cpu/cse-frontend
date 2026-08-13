// Relative Path: src/components/profile/BadgeDisplay.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface BadgeEntry {
  id: string;
  emoji: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  earned: boolean;
  earnedAt: string | null;
}

const RARITY_STYLES: Record<string, string> = {
  common: "border-slate-700 bg-slate-900",
  rare: "border-blue-500/40 bg-blue-950/20",
  epic: "border-violet-500/40 bg-violet-950/20",
  legendary: "border-amber-500/40 bg-amber-950/20",
};

const RARITY_LABEL_STYLES: Record<string, string> = {
  common: "text-slate-500",
  rare: "text-blue-400",
  epic: "text-violet-400",
  legendary: "text-amber-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  exam: "📝 Exam",
  streak: "🔥 Streak",
  mastery: "✨ Mastery",
  engagement: "⚡ Engagement",
  social: "👥 Social",
};

interface BadgeDisplayProps {
  compact?: boolean; // Show only earned badges in a compact row
}

export default function BadgeDisplay({ compact = false }: BadgeDisplayProps) {
  const [badges, setBadges] = useState<BadgeEntry[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/user/badges")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setBadges(data.all || []);
          setTotalEarned(data.totalEarned);
          setTotalAvailable(data.totalAvailable);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-8 text-center text-slate-500 text-xs font-bold animate-pulse">
        Loading achievements...
      </div>
    );
  }

  // Compact mode: just show earned badges in a row
  if (compact) {
    const earnedBadges = badges.filter((b) => b.earned);
    if (earnedBadges.length === 0) return null;
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {earnedBadges.slice(0, 8).map((b) => (
          <div
            key={b.id}
            title={`${b.name} — ${b.description}`}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center text-lg transition hover:scale-110 cursor-default ${RARITY_STYLES[b.rarity] || RARITY_STYLES.common}`}
          >
            {b.emoji}
          </div>
        ))}
        {earnedBadges.length > 8 && (
          <Link
            href="/badges"
            className="text-xs font-bold text-blue-400 hover:text-white transition"
          >
            +{earnedBadges.length - 8} more →
          </Link>
        )}
      </div>
    );
  }

  // Full badge grid
  const categories = ["all", "exam", "streak", "mastery", "engagement", "social"];
  const filtered =
    filter === "all"
      ? badges
      : filter === "earned"
      ? badges.filter((b) => b.earned)
      : badges.filter((b) => b.category === filter);

  return (
    <div className="space-y-5">
      {/* Stats Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
            <span className="text-2xl">🏆</span>
          </div>
          <div>
            <p className="text-white font-black text-lg">{totalEarned} / {totalAvailable}</p>
            <p className="text-xs text-slate-400 font-medium">Achievements Unlocked</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[...categories, "earned"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer capitalize ${
                filter === cat
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
              }`}
            >
              {cat === "all" ? "All" : cat === "earned" ? "✅ Earned" : CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Badge Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {filtered.map((badge) => (
          <div
            key={badge.id}
            className={`p-3 rounded-2xl border flex flex-col items-center text-center gap-2 transition relative ${
              badge.earned
                ? RARITY_STYLES[badge.rarity] || RARITY_STYLES.common
                : "border-slate-800/50 bg-slate-950/40 opacity-40 grayscale"
            }`}
          >
            <span className="text-3xl">{badge.emoji}</span>
            <div className="space-y-0.5 min-h-0">
              <p className="text-[11px] font-black text-white leading-tight">{badge.name}</p>
              <p className={`text-[9px] font-bold uppercase tracking-wider ${RARITY_LABEL_STYLES[badge.rarity] || "text-slate-500"}`}>
                {badge.rarity}
              </p>
            </div>
            {badge.earned && badge.earnedAt && (
              <p className="text-[9px] text-slate-500 font-medium">
                {new Date(badge.earnedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
              </p>
            )}
            {!badge.earned && (
              <span className="absolute top-2 right-2 text-[10px]">🔒</span>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-8 text-center text-slate-500 text-xs font-bold">
            No badges in this category yet.
          </div>
        )}
      </div>
    </div>
  );
}
