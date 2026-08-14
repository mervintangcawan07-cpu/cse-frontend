// Relative Path: src/components/exam/ExamSubmissionLoader.tsx
"use client";

import React, { useEffect, useState } from "react";

interface ExamSubmissionLoaderProps {
  isSubmitting: boolean;
  totalQuestions?: number;
}

export default function ExamSubmissionLoader({
  isSubmitting,
  totalQuestions = 170,
}: ExamSubmissionLoaderProps) {
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (!isSubmitting) {
      setCurrentStep(1);
      return;
    }

    const t1 = setTimeout(() => setCurrentStep(2), 800);
    const t2 = setTimeout(() => setCurrentStep(3), 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isSubmitting]);

  if (!isSubmitting) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Animated Grading Spinner */}
        <div className="relative flex items-center justify-center pt-2">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" />
            <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center text-3xl shadow-inner">
              📝
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-950 border border-blue-400 flex items-center justify-center">
              <svg
                className="animate-spin h-3.5 w-3.5 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-blue-500/15 text-blue-400 rounded-full border border-blue-500/30 inline-block">
            Grading & Analysis in Progress
          </span>
          <h2 className="text-xl font-black text-white">
            Submitting Your Exam
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            Grading {totalQuestions} questions and compiling your diagnostic performance report.
          </p>
        </div>

        {/* Progress Tracker */}
        <div className="space-y-2.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 text-left">
          <div className="flex items-center gap-3 text-xs">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              currentStep >= 1 ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"
            }`}>
              {currentStep > 1 ? "✓" : "1"}
            </span>
            <span className={currentStep >= 1 ? "text-slate-200 font-bold" : "text-slate-500"}>
              Saving responses to diagnostic database
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              currentStep >= 2 ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"
            }`}>
              {currentStep > 2 ? "✓" : "2"}
            </span>
            <span className={currentStep >= 2 ? "text-slate-200 font-bold" : "text-slate-500"}>
              Computing category accuracy & time metrics
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              currentStep >= 3 ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"
            }`}>
              {currentStep >= 3 ? "⚡" : "3"}
            </span>
            <span className={currentStep >= 3 ? "text-slate-200 font-bold" : "text-slate-500"}>
              Syncing Mistake Notebook & step-by-step explanations
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
