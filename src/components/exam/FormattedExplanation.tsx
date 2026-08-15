"use client";

import React from "react";
import { cleanMathText } from "@/lib/sanitizeMath";

interface FormattedExplanationProps {
  explanation?: string | null;
  className?: string;
  title?: string | null;
}

export default function FormattedExplanation({
  explanation,
  className = "",
  title = "Key Rationale & Explanation:",
}: FormattedExplanationProps) {
  if (!explanation || !explanation.trim()) {
    return (
      <p className={`text-sm text-gray-500 dark:text-gray-400 italic ${className}`}>
        No explanation provided for this question.
      </p>
    );
  }

  const cleanText = cleanMathText(explanation.trim());

  // Smart bullet point parsing strategy:
  // 1. If explicit line breaks (\n) or pipes (|) exist, split by them first.
  // 2. Look for explicit list markers like "1.", "-", "*", "•".
  // 3. Fallback: Split by period while protecting common law/exam abbreviations.
  let rawPoints: string[] = [];

  if (cleanText.includes("\n")) {
    rawPoints = cleanText.split(/\r?\n/);
  } else if (cleanText.includes("|")) {
    rawPoints = cleanText.split("|");
  } else if (/(?:^|\s)(?:[•\-\*]|\d+[\.\)])\s+/.test(cleanText)) {
    rawPoints = cleanText.split(/(?=(?:^|\s)(?:[•\-\*]|\d+[\.\)])\s+)/);
  } else {
    // Avoid splitting on law/exam abbreviations: R.A., Art., Sec., No., e.g., i.e., vs., Dr., etc.
    rawPoints = cleanText
      .split(/(?<=(?<!\b(?:R\.A|Art|Sec|No|e\.g|i\.e|vs|Mr|Mrs|Ms|Dr|\d))\.)\s+/)
      .filter(Boolean);
  }

  // Clean each item by removing leading bullet characters, list numbers, or trailing spaces
  const formattedPoints = rawPoints
    .map((item) => item.replace(/^[•\-\*\d+[\.\)]\s*/, "").trim())
    .filter((item) => item.length > 0);

  // Display single sentence/short explanation cleanly as plain paragraph
  if (formattedPoints.length <= 1) {
    return (
      <div className={`space-y-1 min-w-0 overflow-hidden ${className}`}>
        {title && (
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {title}
          </p>
        )}
        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed break-words">
          {cleanText}
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 min-w-0 overflow-hidden ${className}`}>
      {title && (
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {title}
        </p>
      )}
      <ul className="list-disc list-outside ml-5 space-y-1.5 text-sm text-gray-800 dark:text-gray-200 break-words">
        {formattedPoints.map((point, index) => (
          <li key={index} className="leading-relaxed pl-1 break-words">
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
