"use client";

import React from "react";
import StepByStepSolution from "./StepByStepSolution";
import OptionAnalysis from "./OptionAnalysis";
import EliminationStrategyCard from "./EliminationStrategyCard";
import CommonTrapCard from "./CommonTrapCard";
import ExamDayTipCard from "./ExamDayTipCard";
import FormattedExplanation from "@/components/exam/FormattedExplanation";
import AudioSpeechButton from "@/components/common/AudioSpeechButton";
import { StepSolutionItem } from "@/types/question";

function hasMeaningfulText(value?: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasStepByStepContent(stepByStep?: string | StepSolutionItem[] | null): boolean {
  if (!stepByStep) {
    return false;
  }

  if (Array.isArray(stepByStep)) {
    return stepByStep.length > 0;
  }

  return hasMeaningfulText(stepByStep);
}

function hasOptionAnalysisContent(
  whyA?: string | null,
  whyB?: string | null,
  whyC?: string | null,
  whyD?: string | null
): boolean {
  return [whyA, whyB, whyC, whyD].some(hasMeaningfulText);
}

function buildSpeechText({
  explanation,
  eliminationStrategy,
  commonTrap,
  examTip,
}: {
  explanation?: string | null;
  eliminationStrategy?: string | null;
  commonTrap?: string | null;
  examTip?: string | null;
}): string {
  const segments = [
    explanation,
    hasMeaningfulText(eliminationStrategy) ? `Strategy: ${eliminationStrategy}` : "",
    hasMeaningfulText(commonTrap) ? `Common Trap: ${commonTrap}` : "",
    hasMeaningfulText(examTip) ? `Exam Tip: ${examTip}` : "",
  ].filter(hasMeaningfulText);

  return segments.join(". ");
}

interface ExplanationPanelProps {
  readonly explanation?: string | null;
  readonly stepByStep?: string | StepSolutionItem[] | null;
  readonly whyA?: string | null;
  readonly whyB?: string | null;
  readonly whyC?: string | null;
  readonly whyD?: string | null;
  readonly eliminationStrategy?: string | null;
  readonly commonTrap?: string | null;
  readonly examTip?: string | null;
  readonly options?: string[];
  readonly correctIndex?: number;
}

export default function ExplanationPanel({
  explanation,
  stepByStep,
  whyA,
  whyB,
  whyC,
  whyD,
  eliminationStrategy,
  commonTrap,
  examTip,
  options = [],
  correctIndex,
}: Readonly<ExplanationPanelProps>) {
  const hasStepByStep = hasStepByStepContent(stepByStep);
  const hasOptionAnalysis = hasOptionAnalysisContent(whyA, whyB, whyC, whyD);
  const hasStrategy = hasMeaningfulText(eliminationStrategy);
  const hasTrap = hasMeaningfulText(commonTrap);
  const hasTip = hasMeaningfulText(examTip);
  const hasStandardExplanation = hasMeaningfulText(explanation);
  const hasAnyContent = [
    hasStepByStep,
    hasOptionAnalysis,
    hasStrategy,
    hasTrap,
    hasTip,
    hasStandardExplanation,
  ].some(Boolean);
  const showStandardExplanation = hasStandardExplanation && (!hasStepByStep || !hasOptionAnalysis);
  const fullSpeechText = buildSpeechText({
    explanation,
    eliminationStrategy,
    commonTrap,
    examTip,
  });

  if (!hasAnyContent) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-500 italic">
        No additional explanation provided for this item.
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5 text-xs text-slate-800 dark:text-slate-200">
      {/* Top Explanation Action Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <span className="font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <span>💡 Rationalization &amp; Shortcuts</span>
        </span>
        {fullSpeechText && <AudioSpeechButton textToSpeak={fullSpeechText} label="Listen (Audio)" />}
      </div>

      {/* 1. Step-by-Step Solution Derivation */}
      {hasStepByStep && <StepByStepSolution stepByStep={stepByStep} />}

      {/* 2. Standard Official Rationale (Displayed if no StepByStep exists or as high-level summary) */}
      {showStandardExplanation && (
        <div className="space-y-1.5 pt-1">
          <FormattedExplanation
            explanation={explanation}
            title="💡 Solution & Conceptual Rationale"
          />
        </div>
      )}

      {/* 3. Why Every Option Is Right or Wrong */}
      {hasOptionAnalysis && (
        <OptionAnalysis
          whyA={whyA}
          whyB={whyB}
          whyC={whyC}
          whyD={whyD}
          options={options}
          correctIndex={correctIndex}
        />
      )}

      {/* 4. Elimination Strategy & Common Trap Responsive Grid */}
      {(hasStrategy || hasTrap) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
          {hasStrategy && <EliminationStrategyCard strategy={eliminationStrategy} />}
          {hasTrap && <CommonTrapCard trap={commonTrap} />}
        </div>
      )}

      {/* 5. Exam Day Practical Tip */}
      {hasTip && (
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
          <ExamDayTipCard tip={examTip} />
        </div>
      )}
    </div>
  );
}
