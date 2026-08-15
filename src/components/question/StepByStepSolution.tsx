"use client";

import React from "react";
import { StepSolutionItem } from "@/types/question";
import { cleanMathText } from "@/lib/sanitizeMath";

interface StepByStepSolutionProps {
  stepByStep?: string | StepSolutionItem[] | null;
}

export default function StepByStepSolution({ stepByStep }: StepByStepSolutionProps) {
  if (!stepByStep) return null;

  let steps: StepSolutionItem[] = [];

  if (Array.isArray(stepByStep)) {
    steps = stepByStep;
  } else if (typeof stepByStep === "string" && stepByStep.trim()) {
    const raw = stepByStep.trim();
    // Check if JSON array
    if (raw.startsWith("[") && raw.endsWith("]")) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          steps = parsed.map((item: any, i: number) => {
            if (typeof item === "string") {
              return { step: `Step ${i + 1}`, detail: item };
            }
            return {
              step: item.step || `Step ${i + 1}`,
              detail: item.detail || item.text || item.description || "",
            };
          });
        }
      } catch {
        // Fallback to line split
      }
    }

    if (steps.length === 0) {
      // Split by newline or pipe
      const lines = raw.split(/\r?\n|\|/).map((l) => l.trim()).filter(Boolean);
      steps = lines.map((line, i) => {
        const colonMatch = line.match(/^(Step\s*\d+[^:]*):\s*(.*)$/i);
        if (colonMatch) {
          return { step: colonMatch[1], detail: colonMatch[2] };
        }
        return { step: `Step ${i + 1}`, detail: line };
      });
    }
  }

  if (steps.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-wider flex items-center gap-1.5">
        <span>📝</span>
        <span>Step-by-Step Solution:</span>
      </h4>

      <div className="space-y-2.5 pl-1 border-l-2 border-blue-400 dark:border-blue-500 ml-1">
        {steps.map((s, idx) => (
          <div key={idx} className="pl-3.5 space-y-0.5 min-w-0 break-words">
            <p className="font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm break-words">
              {cleanMathText(s.step)}
            </p>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium text-xs sm:text-sm break-words">
              {cleanMathText(s.detail)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
