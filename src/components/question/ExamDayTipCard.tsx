"use client";

import React from "react";
import { cleanMathText } from "@/lib/sanitizeMath";

interface ExamDayTipCardProps {
  tip?: string | null;
}

export default function ExamDayTipCard({ tip }: ExamDayTipCardProps) {
  if (!tip || !tip.trim()) return null;

  return (
    <div className="p-3.5 sm:p-4 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-start gap-2.5 text-amber-950 dark:text-amber-200 text-xs sm:text-sm shadow-2xs min-w-0 break-words">
      <span className="text-base shrink-0 mt-0.5">💡</span>
      <div className="space-y-0.5 min-w-0 break-words">
        <strong className="font-extrabold text-[11px] sm:text-xs uppercase tracking-wider block text-amber-900 dark:text-amber-300">
          Exam Day Tip:
        </strong>
        <p className="leading-relaxed font-medium break-words">{cleanMathText(tip.trim())}</p>
      </div>
    </div>
  );
}
