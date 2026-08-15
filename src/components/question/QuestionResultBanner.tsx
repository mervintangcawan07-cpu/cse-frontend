"use client";

import React from "react";
import { cleanMathText } from "@/lib/sanitizeMath";

interface QuestionResultBannerProps {
  isCorrect: boolean;
  correctLetter: string;
  correctText: string;
  isSkipped?: boolean;
}

export default function QuestionResultBanner({
  isCorrect,
  correctLetter,
  correctText: rawCorrectText,
  isSkipped = false,
}: QuestionResultBannerProps) {
  const correctText = cleanMathText(rawCorrectText);

  let bgBorderClass =
    "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200";
  let icon = "💡";
  let message = "Not quite — let's break down the reasoning step-by-step.";

  if (isSkipped) {
    bgBorderClass =
      "bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200";
    icon = "⏭️";
    message = "Question was skipped during the exam.";
  } else if (isCorrect) {
    bgBorderClass =
      "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200";
    icon = "🎉";
    message = "Correct! Excellent reasoning.";
  }

  return (
    <div
      className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs transition w-full min-w-0 overflow-hidden ${bgBorderClass}`}
    >
      <div className="flex items-center gap-2.5 font-bold text-xs sm:text-sm shrink-0">
        <span className="text-base">{icon}</span>
        <span>{message}</span>
      </div>

      <div className="text-xs font-medium leading-relaxed break-words min-w-0 md:max-w-[60%] md:text-right">
        <span className="font-bold opacity-80">Correct Answer: </span>
        <span className="text-emerald-700 dark:text-emerald-400 font-extrabold underline break-words">
          {correctLetter}. {correctText}
        </span>
      </div>
    </div>
  );
}
