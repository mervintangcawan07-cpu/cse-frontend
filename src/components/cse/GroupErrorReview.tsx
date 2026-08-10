"use client";

import React from "react";
import { ErrorReviewItem } from "@/types/cse";
import { formatPromptHTML } from "@/lib/formatPrompt";

interface GroupErrorReviewProps {
  items: ErrorReviewItem[];
}

export const GroupErrorReview: React.FC<GroupErrorReviewProps> = ({ items }) => {
  return (
    <div className="space-y-4 my-6">
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
        <h3 className="text-sm font-black text-amber-900 dark:text-amber-300 flex items-center gap-2">
          <span>⚠️</span> Group Error Analytics & High-Mistake Review
        </h3>
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
          Focusing on items where over 50% of examinees picked incorrect trap choices.
        </p>
      </div>

      {items.map((item, idx) => (
        <div
          key={item.questionId || idx}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
        >
          {/* Header Metadata */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Subtopic: {item.subtopic}
            </span>
            <span className="text-xs font-black text-rose-600 dark:text-rose-400">
              {item.incorrectPercentage}% Missed Rate ({item.totalAttempts} Examinees)
            </span>
          </div>

          {/* Formatted Prompt */}
          <div
            className="mb-4 text-slate-900 dark:text-white"
            dangerouslySetInnerHTML={{ __html: formatPromptHTML(item.prompt) }}
          />

          {/* Wrong Choice Breakdown */}
          <div className="my-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
              Choice Distribution Breakdown:
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              {Object.entries(item.optionDistribution).map(([optIdx, percent]) => {
                const isCorrect = Number(optIdx) === item.correctAnswerIndex;
                return (
                  <div
                    key={optIdx}
                    className={`p-2 rounded-lg border flex items-center justify-between ${
                      isCorrect
                        ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
                        : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span>Choice {String.fromCharCode(65 + Number(optIdx))}</span>
                    <span>{percent}% {isCorrect ? "✓ (Correct)" : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step-by-Step Solution & Legal Reference */}
          <div className="p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 text-xs leading-relaxed">
            <div className="font-bold text-indigo-950 dark:text-indigo-300 mb-1">
              💡 Step-by-Step Explanation:
            </div>
            <p className="text-slate-800 dark:text-slate-200 font-medium">{item.stepByStepSolution}</p>

            {item.legalReference && (
              <div className="mt-2 text-[11px] font-bold text-indigo-700 dark:text-indigo-400 border-t border-indigo-200/60 dark:border-indigo-900/40 pt-2">
                📜 Legal Basis / Provision: {item.legalReference}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
