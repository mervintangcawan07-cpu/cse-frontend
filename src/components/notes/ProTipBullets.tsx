"use client";

import React from "react";

interface ProTipBulletsProps {
  proTip?: string | null;
}

export default function ProTipBullets({ proTip }: ProTipBulletsProps) {
  if (!proTip || !proTip.trim()) return null;

  const cleanText = proTip.trim();

  // Split pro-tip into individual bullet points
  let points: string[] = [];

  if (cleanText.includes("\n")) {
    points = cleanText.split(/\r?\n/);
  } else if (cleanText.includes("|")) {
    points = cleanText.split("|");
  } else {
    // Protect legal/math abbreviations (R.A., Art., Sec., e.g., i.e., vs.)
    points = cleanText
      .split(/(?<=(?<!\b(?:R\.A|Art|Sec|No|e\.g|i\.e|vs|Mr|Mrs|Ms|Dr|\d))\.)\s+/)
      .filter(Boolean);
  }

  const cleanPoints = points
    .map((pt) => pt.replace(/^[•\-\*\d+[\.\)]\s*/, "").trim())
    .filter((pt) => pt.length > 0);

  return (
    <div className="p-4 bg-sky-50/80 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-800/50 rounded-2xl flex items-start gap-3">
      <span className="text-xl shrink-0 mt-0.5">💡</span>
      <div className="space-y-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200 w-full">
        <span className="font-bold text-sky-900 dark:text-sky-300 block">
          Exam Pro-Tip:
        </span>

        {cleanPoints.length <= 1 ? (
          <p className="leading-relaxed text-slate-700 dark:text-slate-300">
            {cleanText}
          </p>
        ) : (
          <ul className="list-disc list-outside ml-4 space-y-1 text-slate-700 dark:text-slate-300">
            {cleanPoints.map((point, index) => (
              <li key={index} className="leading-relaxed pl-1">
                {point}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
