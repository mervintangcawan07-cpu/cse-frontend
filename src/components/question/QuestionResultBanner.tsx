"use client";

import React from "react";

interface QuestionResultBannerProps {
  isCorrect: boolean;
  correctLetter: string;
  correctText: string;
  isSkipped?: boolean;
}

export default function QuestionResultBanner({
  isCorrect,
  correctLetter,
  correctText,
  isSkipped = false,
}: QuestionResultBannerProps) {
  if (isSkipped) {
    return (
      <div className="p-4 rounded-2xl border bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 font-black text-xs sm:text-sm">
          <span className="text-base">⏭️</span>
          <span>Question was skipped during the exam.</span>
        </div>
        <div className="text-xs font-black shrink-0">
          Correct Answer:{" "}
          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold underline">
            {correctLetter}. {correctText}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition ${
        isCorrect
          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200"
          : "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200"
      }`}
    >
      <div className="flex items-center gap-2.5 font-black text-xs sm:text-sm">
        <span className="text-base">{isCorrect ? "🎉" : "💡"}</span>
        <span>
          {isCorrect
            ? "Correct! Excellent reasoning."
            : "Not quite — let's break down the reasoning step-by-step."}
        </span>
      </div>

      <div className="text-xs font-black shrink-0">
        Correct Answer:{" "}
        <span className="text-emerald-700 dark:text-emerald-400 font-extrabold underline">
          {correctLetter}. {correctText}
        </span>
      </div>
    </div>
  );
}
