"use client";

import React from "react";
import { formatPromptHTML } from "@/lib/formatPrompt";

interface QuestionPromptProps {
  prompt: string;
  imageUrl?: string | null;
}

export default function QuestionPrompt({ prompt, imageUrl }: QuestionPromptProps) {
  const formattedHtml = formatPromptHTML(prompt || "");

  return (
    <div className="space-y-4">
      {/* Question Prompt Text / Table / Mathematical expressions */}
      <div
        className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-relaxed overflow-x-auto whitespace-pre-line"
        dangerouslySetInnerHTML={{ __html: formattedHtml }}
      />

      {/* Image / Diagram / Chart Display */}
      {imageUrl && (
        <div className="my-4 flex justify-center bg-slate-50 dark:bg-slate-950/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <img
            src={imageUrl}
            alt="Question Diagram"
            className="max-h-72 object-contain rounded-xl shadow-xs"
          />
        </div>
      )}
    </div>
  );
}
