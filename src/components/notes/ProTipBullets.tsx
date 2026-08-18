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
    <div className="p-4 sm:p-5 bg-amber-50/80 border border-amber-200/90 rounded-2xl flex items-start gap-3.5 shadow-xs">
      <div className="p-2 bg-amber-100/80 rounded-xl shrink-0 text-amber-700 text-lg leading-none">
        💡
      </div>
      <div className="space-y-1.5 w-full pt-0.5">
        <span className="text-xs font-black uppercase tracking-wider text-amber-900 block">
          Exam Pro-Tip
        </span>

        {cleanPoints.length <= 1 ? (
          <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
            {cleanText}
          </p>
        ) : (
          <ul className="list-disc list-outside ml-4 space-y-1.5 text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
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
