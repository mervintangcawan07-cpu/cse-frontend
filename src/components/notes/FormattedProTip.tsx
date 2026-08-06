"use client";

import React from "react";

interface FormattedProTipProps {
  tip?: string | null;
  className?: string;
  title?: string | null;
}

export default function FormattedProTip({
  tip,
  className = "",
  title = "⚡ Exam Pro-Tip",
}: FormattedProTipProps) {
  if (!tip || !tip.trim()) return null;

  const cleanText = tip.trim();

  // Smart Bullet Point Parsing (Same logic as Mock Exam)
  let rawPoints: string[] = [];

  if (cleanText.includes("\n")) {
    rawPoints = cleanText.split(/\r?\n/);
  } else if (cleanText.includes("|")) {
    rawPoints = cleanText.split("|");
  } else if (/(?:^|\s)(?:[•\-\*]|\d+[\.\)])\s+/.test(cleanText)) {
    rawPoints = cleanText.split(/(?=(?:^|\s)(?:[•\-\*]|\d+[\.\)])\s+)/);
  } else {
    // Protect law citations (R.A., Art., Sec., No.) and common abbreviations
    rawPoints = cleanText
      .split(/(?<=(?<!\b(?:R\.A|Art|Sec|No|e\.g|i\.e|vs|Mr|Mrs|Ms|Dr|\d))\.)\s+/)
      .filter(Boolean);
  }

  const formattedPoints = rawPoints
    .map((item) => item.replace(/^[•\-\*\d+[\.\)]\s*/, "").trim())
    .filter((item) => item.length > 0);

  // Single-sentence tip layout
  if (formattedPoints.length <= 1) {
    return (
      <div className={`p-5 bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl ${className}`}>
        {title && (
          <p className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1.5">
            {title}
          </p>
        )}
        <p className="text-sm font-medium text-amber-900 dark:text-amber-100 leading-relaxed">
          {cleanText}
        </p>
      </div>
    );
  }

  // Multi-sentence / multi-point bullet list layout
  return (
    <div className={`p-5 bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl ${className}`}>
      {title && (
        <p className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2">
          {title}
        </p>
      )}
      <ul className="list-disc list-outside ml-5 space-y-2 text-sm font-medium text-amber-900 dark:text-amber-100">
        {formattedPoints.map((point, index) => (
          <li key={index} className="leading-relaxed pl-1">
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
