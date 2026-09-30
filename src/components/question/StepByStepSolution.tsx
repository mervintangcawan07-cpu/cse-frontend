"use client";

import React, { useMemo } from "react";
import { StepSolutionItem } from "@/types/question";
import { cleanMathText } from "@/lib/sanitizeMath";

interface StepByStepSolutionProps {
  readonly stepByStep?: string | StepSolutionItem[] | null;
}

// Simpler pattern avoids nested greedy matching and reduces backtracking
const STEP_PREFIX_REGEX = /^(Step\s*\d+)\s*:\s*(.*)$/i;
const SPLIT_DELIMITER_REGEX = /\r?\n|\|/;

function getRawDetail(record: Record<string, unknown>): string {
  if (typeof record.detail === "string") {
    return record.detail;
  }
  if (typeof record.text === "string") {
    return record.text;
  }
  if (typeof record.description === "string") {
    return record.description;
  }
  return "";
}

function normalizeStepItem(item: unknown, index: number): StepSolutionItem | null {
  const fallbackStep = `Step ${index + 1}`;

  if (typeof item === "string") {
    const detail = item.trim();
    return detail ? { step: fallbackStep, detail } : null;
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;

  const step =
    typeof record.step === "string" && record.step.trim()
      ? record.step.trim()
      : fallbackStep;

  // Extracted nested ternary into helper function
  const rawDetail = getRawDetail(record);
  const detail = rawDetail.trim();
  if (!detail) return null;

  return { step, detail };
}

function parseJsonSteps(raw: string): StepSolutionItem[] {
  if (!raw.startsWith("[") || !raw.endsWith("]")) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Avoid passing normalizeStepItem directly into .map()
    return parsed
      .map((item, idx) => normalizeStepItem(item, idx))
      .filter((step): step is StepSolutionItem => step !== null);
  } catch {
    return [];
  }
}

function splitDelimitedSteps(raw: string): StepSolutionItem[] {
  const lines = raw
    .split(SPLIT_DELIMITER_REGEX)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    // Used RegExp.exec instead of String.match
    const match = STEP_PREFIX_REGEX.exec(line);
    if (match) {
      return { step: match[1].trim(), detail: match[2].trim() };
    }
    return { step: `Step ${index + 1}`, detail: line };
  });
}

function resolveStepByStep(
  stepByStep: string | StepSolutionItem[] | null | undefined
): StepSolutionItem[] {
  if (Array.isArray(stepByStep)) {
    // Avoid passing normalizeStepItem directly into .map()
    return stepByStep
      .map((item, idx) => normalizeStepItem(item, idx))
      .filter((step): step is StepSolutionItem => step !== null);
  }

  if (typeof stepByStep !== "string") {
    return [];
  }

  const raw = stepByStep.trim();
  if (!raw) return [];

  const jsonSteps = parseJsonSteps(raw);
  return jsonSteps.length > 0 ? jsonSteps : splitDelimitedSteps(raw);
}

export default function StepByStepSolution({ stepByStep }: StepByStepSolutionProps) {
  const steps = useMemo(() => resolveStepByStep(stepByStep), [stepByStep]);

  if (steps.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white">
        <span aria-hidden="true">📝</span>
        <span>Step-by-Step Solution:</span>
      </h4>

      <div className="ml-1 space-y-2.5 border-l-2 border-blue-400 pl-1 dark:border-blue-500">
        {steps.map((s) => {
          const key = `${s.step}|${s.detail}`;

          return (
            <div key={key} className="min-w-0 space-y-0.5 break-words pl-3.5">
              <p className="break-words text-xs font-extrabold text-slate-900 sm:text-sm dark:text-slate-100">
                {cleanMathText(s.step)}
              </p>
              <p className="break-words text-xs font-medium leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
                {cleanMathText(s.detail)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}