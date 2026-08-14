"use client";

import React from "react";

interface QuestionChoicesProps {
  options: string[];
  selectedIndex?: number | null;
  correctIndex: number;
  isSubmitted: boolean;
  disabled?: boolean;
  onSelectOption?: (index: number) => void;
}

export default function QuestionChoices({
  options,
  selectedIndex,
  correctIndex,
  isSubmitted,
  disabled = false,
  onSelectOption,
}: QuestionChoicesProps) {
  const letters = ["A", "B", "C", "D", "E", "F"];

  return (
    <div className="space-y-2.5">
      {options.map((opt, idx) => {
        const letter = letters[idx] || `${idx + 1}`;
        const isUserSelection = selectedIndex === idx;
        const isCorrect = correctIndex === idx;

        let containerStyle =
          "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-slate-800/60";
        let letterStyle =
          "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";

        if (!isSubmitted) {
          if (isUserSelection) {
            containerStyle =
              "bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-blue-950 dark:text-blue-200 font-bold shadow-xs";
            letterStyle = "bg-blue-600 text-white border-blue-600";
          }
        } else {
          // Submitted / Review Mode
          if (isCorrect) {
            containerStyle =
              "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-200 font-bold shadow-xs";
            letterStyle = "bg-emerald-600 text-white border-emerald-600";
          } else if (isUserSelection && !isCorrect) {
            containerStyle =
              "bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-950 dark:text-rose-200 font-medium shadow-xs";
            letterStyle = "bg-rose-600 text-white border-rose-600";
          } else {
            containerStyle =
              "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-75";
            letterStyle =
              "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700";
          }
        }

        return (
          <button
            key={idx}
            type="button"
            disabled={disabled || isSubmitted}
            onClick={() => onSelectOption && onSelectOption(idx)}
            className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition flex items-center justify-between gap-3 text-xs sm:text-sm cursor-pointer disabled:cursor-default ${containerStyle}`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-7 h-7 rounded-xl border flex items-center justify-center font-black text-xs shrink-0 transition ${letterStyle}`}
              >
                {letter}
              </span>
              <span className="leading-relaxed">{opt}</span>
            </div>

            {isSubmitted && (
              <div className="shrink-0 flex items-center gap-1.5 font-black text-[11px]">
                {isCorrect && (
                  <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded-md uppercase tracking-wider">
                    ✓ Correct Answer
                  </span>
                )}
                {isUserSelection && !isCorrect && (
                  <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-md uppercase tracking-wider">
                    ✗ Your Choice
                  </span>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
