"use client";

import React from "react";

interface QuestionHeaderProps {
  itemNumber?: number | string;
  category: string;
  subtopic?: string | null;
  difficulty?: string | null;
  badgeLabel?: string | null;
  actions?: React.ReactNode;
}

export default function QuestionHeader({
  itemNumber,
  category,
  subtopic,
  difficulty,
  badgeLabel,
  actions,
}: QuestionHeaderProps) {
  const getDifficultyColor = (diff?: string | null) => {
    switch (diff?.toUpperCase()) {
      case "HARD":
      case "VERY_HARD":
        return "bg-rose-500/10 text-rose-700 border-rose-200";
      case "EASY":
        return "bg-emerald-500/10 text-emerald-700 border-emerald-200";
      case "MEDIUM":
      default:
        return "bg-blue-500/10 text-blue-700 border-blue-200";
    }
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        {itemNumber !== undefined && (
          <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 bg-slate-900 text-white rounded-lg shadow-2xs">
            Item #{itemNumber}
          </span>
        )}

        {badgeLabel && (
          <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 bg-blue-600 text-white rounded-lg shadow-2xs">
            {badgeLabel}
          </span>
        )}

        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
          {category}
        </span>

        {subtopic && subtopic !== "General" && (
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            • {subtopic}
          </span>
        )}

        {difficulty && (
          <span
            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${getDifficultyColor(
              difficulty
            )}`}
          >
            {difficulty.replace("_", " ")}
          </span>
        )}
      </div>

      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
