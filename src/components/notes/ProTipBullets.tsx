"use client";

import React from "react";

interface ProTipBulletsProps {
  proTip?: string | null;
}

export default function ProTipBullets({ proTip }: ProTipBulletsProps) {
  if (!proTip || !proTip.trim()) return null;

  const cleanText = proTip.trim();

  let points: string[] = [];

  if (cleanText.includes("\n")) {
    points = cleanText.split(/\r?\n/);
  } else if (cleanText.includes("|")) {
    points = cleanText.split("|");
  } else {
    // Protect common abbreviations (e.g., R.A., Art., Sec., e.g., i.e., vs.)
    points = cleanText
      .split(/(?<=(?<!\b(?:R\.A|Art|Sec|No|e\.g|i\.e|vs|Mr|Mrs|Ms|Dr|\d))\.)\s+/)
      .filter(Boolean);
  }

  const cleanPoints = points
    .map((pt) => pt.replace(/^[•\-\*\d+[\.\)]\s*/, "").trim())
    .filter((pt) => pt.length > 0);

  return (
    <div className="p-4 bg-indigo-50/60 dark:bg-sky-950/30 border border-indigo-100 dark:border-sky-800/50 rounded-2xl flex items-start gap-2.5 text-xs text-indigo-900 dark:text-slate-200">
      <span className="text-base shrink-0 mt-0.5">💡</span>
      <div className="space-y-1.5 w-full">
        <span className="font-extrabold block">Exam Pro-Tip:</span>

        {cleanPoints.length <= 1 ? (
          <p className="leading-relaxed">{cleanText}</p>
        ) : (
          <ul className="list-disc list-outside ml-4 space-y-1 leading-relaxed">
            {cleanPoints.map((point, index) => (
              <li key={index} className="pl-1">
                {point}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
