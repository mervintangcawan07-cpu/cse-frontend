import React, { useMemo } from "react";

interface ProTipBulletsProps {
  readonly proTip?: string | null;
}

// Hoist regexes outside component render scope
const NEWLINE_SPLIT_REGEX = /\r?\n/;
const PIPE_SPLIT_REGEX = /\|/;
// Matches leading bullet symbols or numbers like "1.", "1)", "-", "*", "•"
const LEADING_MARKER_REGEX = /^([•\-*]|\d+[.)])\s*/;
// Matches sentence-ending periods followed by whitespace, guarding against digits
const SENTENCE_SPLIT_REGEX = /\.(?!\d)\s+/;

const ABBREVIATIONS = new Set([
  "r.a",
  "art",
  "sec",
  "no",
  "e.g",
  "i.e",
  "vs",
  "mr",
  "mrs",
  "ms",
  "dr",
]);

function parsePoints(text: string): string[] {
  if (NEWLINE_SPLIT_REGEX.test(text)) {
    return text.split(NEWLINE_SPLIT_REGEX);
  }

  if (PIPE_SPLIT_REGEX.test(text)) {
    return text.split(PIPE_SPLIT_REGEX);
  }

  // Safe sentence chunking without complex nested lookbehinds
  const rawChunks = text.split(SENTENCE_SPLIT_REGEX);
  const combined: string[] = [];

  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i].trim();
    if (!chunk) continue;

    const lastWord = chunk.split(/\s+/).pop()?.toLowerCase().replace(/\.$/, "") ?? "";

    if (ABBREVIATIONS.has(lastWord) && i + 1 < rawChunks.length) {
      rawChunks[i + 1] = `${chunk}. ${rawChunks[i + 1]}`;
    } else {
      combined.push(chunk);
    }
  }

  return combined;
}

export default function ProTipBullets({ proTip }: ProTipBulletsProps) {
  const cleanPoints = useMemo(() => {
    const cleanText = proTip?.trim();
    if (!cleanText) return [];

    return parsePoints(cleanText)
      .map((pt) => pt.replace(LEADING_MARKER_REGEX, "").trim())
      .filter((pt) => pt.length > 0);
  }, [proTip]);

  if (cleanPoints.length === 0) return null;

  return (
    <div className="flex items-start gap-3.5 rounded-2xl border border-amber-200/90 bg-amber-50/80 p-4 shadow-xs sm:p-5">
      <div 
        aria-hidden="true" 
        className="shrink-0 rounded-xl bg-amber-100/80 p-2 text-lg leading-none text-amber-700"
      >
        💡
      </div>

      <div className="w-full space-y-1.5 pt-0.5">
        <span className="block text-xs font-black uppercase tracking-wider text-amber-900">
          Exam Pro-Tip
        </span>

        {cleanPoints.length === 1 ? (
          <p className="text-xs font-medium leading-relaxed text-slate-800 sm:text-sm">
            {cleanPoints[0]}
          </p>
        ) : (
          <ul className="ml-4 list-outside list-disc space-y-1.5 text-xs font-medium leading-relaxed text-slate-800 sm:text-sm">
            {cleanPoints.map((point, index) => (
              <li key={`${index}-${point}`} className="pl-1">
                {point}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}