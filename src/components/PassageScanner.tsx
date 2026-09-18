"use client";

import React from "react";
import { KEYWORD_REGEX } from "@/lib/quizUtils";

interface PassageScannerProps {
  text: string;
}

const keywordTestRegex = new RegExp(KEYWORD_REGEX.source);

export default function PassageScanner({ text }: PassageScannerProps) {
  const parts = text.split(KEYWORD_REGEX);

  return (
    <div className="leading-relaxed text-slate-200 text-sm md:text-base">
      {parts.map((part, index) => {
        const isKeyword = keywordTestRegex.test(part);

        if (isKeyword) {
          return (
            <mark
              key={index}
              className="bg-amber-500/30 text-amber-300 border-b-2 border-amber-400 font-black px-1 rounded mx-0.5"
            >
              {part}
            </mark>
          );
        }

        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}