"use client";

import React from "react";
import { ProfileCompletionResult } from "@/lib/social/profileCompletion";

interface ProfileCompletionCardProps {
  completion: ProfileCompletionResult | null;
  onOpenEditModal: () => void;
}

export const ProfileCompletionCard: React.FC<ProfileCompletionCardProps> = ({
  completion,
  onOpenEditModal,
}) => {
  if (!completion) return null;

  const { percentage, isFullyComplete, statusLabel, missingRecommended, completedItems } = completion;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden space-y-4">
      {/* Background Accent Gradient */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header with Score */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>👤</span> Study Identity Completion
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                isFullyComplete
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : percentage >= 70
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              {percentage}% • {statusLabel}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {isFullyComplete
              ? "Your study card is complete and fully optimized for study buddy discovery."
              : "Complete your study profile to help examinees find and invite you to matching study groups."}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenEditModal}
          className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer shrink-0 shadow-md ${
            isFullyComplete
              ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
          }`}
        >
          {isFullyComplete ? "⚙️ Manage Study Profile" : "✏️ Complete Profile"}
        </button>
      </div>

      {/* Visual Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isFullyComplete
                ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                : percentage >= 70
                ? "bg-gradient-to-r from-blue-600 to-cyan-400"
                : "bg-gradient-to-r from-amber-500 to-orange-400"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Missing Recommended Items vs Completed Badges */}
      {!isFullyComplete && missingRecommended.length > 0 ? (
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 block">
            Recommended items to boost your study partner match rate:
          </span>
          <div className="flex flex-wrap gap-2">
            {missingRecommended.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={onOpenEditModal}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-amber-500/30 hover:border-amber-500/60 rounded-xl text-xs text-amber-300 font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <span>{item.icon}</span>
                <span>+ Add {item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : isFullyComplete ? (
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <span>✓</span> All identity items filled
          </span>
          <span className="text-slate-600">•</span>
          <span>{completedItems.length} profile attributes configured</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-500">Privacy controls active</span>
        </div>
      ) : null}
    </div>
  );
};
