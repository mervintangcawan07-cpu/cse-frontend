"use client";

import React, { useState } from "react";
import QuestionHeader from "./QuestionHeader";
import QuestionPrompt from "./QuestionPrompt";
import QuestionChoices from "./QuestionChoices";
import QuestionResultBanner from "./QuestionResultBanner";
import ExplanationPanel from "./ExplanationPanel";
import { StructuredQuestion, QuestionReviewMode } from "@/types/question";

export interface QuestionReviewProps {
  question: StructuredQuestion;
  userAnswerIndex?: number | null;
  itemNumber?: number | string;
  mode?: QuestionReviewMode; // "INTERACTIVE" | "REVIEW" | "PREVIEW"
  isSubmitted?: boolean;
  isSkipped?: boolean;
  badgeLabel?: string | null;
  onSelectOption?: (index: number) => void;
  onSubmitAnswer?: () => void;
  actions?: React.ReactNode;
  footerActions?: React.ReactNode;
  className?: string;
}

export default function QuestionReview({
  question,
  userAnswerIndex,
  itemNumber,
  mode = "REVIEW",
  isSubmitted = false,
  isSkipped = false,
  badgeLabel,
  onSelectOption,
  onSubmitAnswer,
  actions,
  footerActions,
  className = "",
}: QuestionReviewProps) {
  // Local state for interactive mode when unmanaged
  const [localSelection, setLocalSelection] = useState<number | null>(null);
  const [localSubmitted, setLocalSubmitted] = useState(false);

  const isInteractive = mode === "INTERACTIVE";
  const isPreview = mode === "PREVIEW";
  const isReviewMode = mode === "REVIEW" || isPreview;

  const currentSelection =
    userAnswerIndex !== undefined ? userAnswerIndex : localSelection;
  const isCurrentlySubmitted = isReviewMode ? true : isSubmitted || localSubmitted;

  const handleChoiceSelect = (index: number) => {
    if (isCurrentlySubmitted && !isPreview) return;
    if (onSelectOption) {
      onSelectOption(index);
    } else {
      setLocalSelection(index);
    }
  };

  const handleCheckAnswer = () => {
    if (currentSelection === null) return;
    if (onSubmitAnswer) {
      onSubmitAnswer();
    } else {
      setLocalSubmitted(true);
    }
  };

  const letters = ["A", "B", "C", "D", "E", "F"];
  const correctLetter = letters[question.answerIndex] || "A";
  const correctText =
    question.options?.[question.answerIndex] ||
    (question.answerIndex === 0
      ? question.optionA
      : question.answerIndex === 1
      ? question.optionB
      : question.answerIndex === 2
      ? question.optionC
      : question.optionD) ||
    "";

  const isCorrect =
    currentSelection !== null && currentSelection !== undefined
      ? currentSelection === question.answerIndex
      : false;

  const optionsList =
    question.options && question.options.length > 0
      ? question.options
      : [
          question.optionA || "",
          question.optionB || "",
          question.optionC || "",
          question.optionD || "",
        ].filter(Boolean);

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-md space-y-6 transition ${className}`}
    >
      {/* 1. Header with Categories, Subtopic & Difficulty */}
      <QuestionHeader
        itemNumber={itemNumber}
        category={question.category || "General"}
        subtopic={question.subtopic}
        difficulty={question.difficulty}
        badgeLabel={badgeLabel}
        actions={actions}
      />

      {/* 2. Question Prompt (with HTML table and image diagram support) */}
      <QuestionPrompt prompt={question.prompt} imageUrl={question.imageUrl} />

      {/* 3. Choices */}
      <QuestionChoices
        options={optionsList}
        selectedIndex={currentSelection}
        correctIndex={question.answerIndex}
        isSubmitted={isCurrentlySubmitted}
        disabled={isCurrentlySubmitted && !isPreview}
        onSelectOption={handleChoiceSelect}
      />

      {/* 4. Interactive Submission Button (when not yet submitted) */}
      {isInteractive && !isCurrentlySubmitted && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            disabled={currentSelection === null || currentSelection === undefined}
            onClick={handleCheckAnswer}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs sm:text-sm rounded-xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            Check Answer
          </button>
        </div>
      )}

      {/* 5. Result Banner & Comprehensive Explanation Panel (Shown when submitted or in review mode) */}
      {isCurrentlySubmitted && (
        <div className="space-y-5 animate-fade-in pt-1">
          {/* Result Banner */}
          <QuestionResultBanner
            isCorrect={isCorrect}
            correctLetter={correctLetter}
            correctText={correctText}
            isSkipped={isSkipped}
          />

          {/* Deep Explanation Panel */}
          <ExplanationPanel
            explanation={question.explanation}
            stepByStep={question.stepByStep}
            whyA={question.whyA}
            whyB={question.whyB}
            whyC={question.whyC}
            whyD={question.whyD}
            eliminationStrategy={question.eliminationStrategy}
            commonTrap={question.commonTrap}
            examTip={question.examTip}
            options={optionsList}
            correctIndex={question.answerIndex}
          />
        </div>
      )}

      {/* 6. Footer Navigation / Next Actions */}
      {footerActions && <div className="pt-2 border-t border-slate-100 dark:border-slate-800">{footerActions}</div>}
    </div>
  );
}
