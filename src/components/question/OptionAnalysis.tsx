"use client";

import React from "react";
import { OptionAnalysisItem } from "@/types/question";
import { cleanMathText } from "@/lib/sanitizeMath";

interface OptionAnalysisProps {
  whyA?: string | null;
  whyB?: string | null;
  whyC?: string | null;
  whyD?: string | null;
  options?: string[];
  correctIndex?: number;
}

export default function OptionAnalysis({
  whyA,
  whyB,
  whyC,
  whyD,
  options = [],
  correctIndex,
}: OptionAnalysisProps) {
  const analysisItems: OptionAnalysisItem[] = [];

  const rawEntries = [
    { key: "Option A", val: whyA, idx: 0 },
    { key: "Option B", val: whyB, idx: 1 },
    { key: "Option C", val: whyC, idx: 2 },
    { key: "Option D", val: whyD, idx: 3 },
  ];

  rawEntries.forEach(({ key, val, idx }) => {
    if (val && val.trim()) {
      const cleanOption = options[idx] ? cleanMathText(options[idx]) : "";
      const optionLabel = cleanOption ? `${key} (${cleanOption})` : key;
      analysisItems.push({
        option: optionLabel,
        text: cleanMathText(val.trim()),
        isCorrect: correctIndex === idx,
      });
    }
  });

  if (analysisItems.length === 0) return null;

  return (
    <div className="space-y-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800">
      <h4 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-wider flex items-center gap-1.5">
        <span>🎯</span>
        <span>Why Every Option Is Right or Wrong:</span>
      </h4>

      <div className="space-y-2">
        {analysisItems.map((item, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-xl border text-xs sm:text-sm leading-relaxed transition break-words min-w-0 ${
              item.isCorrect
                ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-slate-800 dark:text-slate-200"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            <strong
              className={`font-bold mr-1.5 break-words ${
                item.isCorrect
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-slate-900 dark:text-white"
              }`}
            >
              {item.option}:
            </strong>
            <span className="break-words">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
