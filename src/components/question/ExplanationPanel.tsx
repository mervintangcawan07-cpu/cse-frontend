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


interface ExplanationPanelProps {
  explanation?: string | null;
  stepByStep?: string | StepSolutionItem[] | null;
  whyA?: string | null;
  whyB?: string | null;
  whyC?: string | null;
  whyD?: string | null;
  eliminationStrategy?: string | null;
  commonTrap?: string | null;
  examTip?: string | null;
  options?: string[];
  correctIndex?: number;
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
}: ExplanationPanelProps) {
  const hasStepByStep = Boolean(
    stepByStep &&
      (Array.isArray(stepByStep) ? stepByStep.length > 0 : stepByStep.trim().length > 0)
  );
  const hasOptionAnalysis = Boolean(
    (whyA && whyA.trim()) ||
      (whyB && whyB.trim()) ||
      (whyC && whyC.trim()) ||
      (whyD && whyD.trim())
  );
  const hasStrategy = Boolean(eliminationStrategy && eliminationStrategy.trim());
  const hasTrap = Boolean(commonTrap && commonTrap.trim());
  const hasTip = Boolean(examTip && examTip.trim());
  const hasStandardExplanation = Boolean(explanation && explanation.trim());

  // If absolutely nothing is available
  if (
    !hasStepByStep &&
    !hasOptionAnalysis &&
    !hasStrategy &&
    !hasTrap &&
    !hasTip &&
    !hasStandardExplanation
  ) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-500 italic">
        No additional explanation provided for this item.
      </div>
    );
  }

  const fullSpeechText = [
    explanation,
    hasStrategy ? `Strategy: ${eliminationStrategy}` : "",
    hasTrap ? `Common Trap: ${commonTrap}` : "",
    hasTip ? `Exam Tip: ${examTip}` : "",
  ]
    .filter(Boolean)
    .join(". ");

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
      {hasStandardExplanation && (!hasStepByStep || !hasOptionAnalysis) && (
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
