"use client";

import React, { useState } from "react";
import { StructuredQuestion } from "@/types/question";
import { ValidationErrorItem } from "@/lib/csvParser";

interface QuestionImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: StructuredQuestion[];
  errors: ValidationErrorItem[];
  warnings: ValidationErrorItem[];
  onConfirmImport: (validQuestions: StructuredQuestion[]) => Promise<void>;
}

export default function QuestionImportPreviewModal({
  isOpen,
  onClose,
  questions,
  errors,
  warnings,
  onConfirmImport,
}: QuestionImportPreviewModalProps) {
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"PREVIEW" | "ISSUES">("PREVIEW");

  if (!isOpen) return null;

  const handleImport = async () => {
    if (questions.length === 0) return;
    setImporting(true);
    try {
      await onConfirmImport(questions);
      onClose();
    } catch (err) {
      console.error("Import failed:", err);
    } finally {
      setImporting(false);
    }
  };

  const letters = ["A", "B", "C", "D"];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-8 max-w-5xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 my-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-800">
                CSV Validation Engine
              </span>
              <span className="text-xs font-bold text-slate-500">
                {questions.length} Valid Questions Ready
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
              Import Questions Preview & Verification
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 font-bold text-sm transition flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Validation Summary Bar */}
        <div className="grid grid-cols-3 gap-3 shrink-0 text-xs">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center gap-2.5">
            <span className="text-xl">✅</span>
            <div>
              <p className="font-extrabold text-emerald-900 dark:text-emerald-300">
                {questions.length} Valid
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Ready for database
              </p>
            </div>
          </div>

          <div
            className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
              warnings.length > 0
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
            }`}
          >
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-extrabold text-amber-900 dark:text-amber-300">
                {warnings.length} Warnings
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Non-fatal issues
              </p>
            </div>
          </div>

          <div
            className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
              errors.length > 0
                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
            }`}
          >
            <span className="text-xl">❌</span>
            <div>
              <p className="font-extrabold text-rose-900 dark:text-rose-300">
                {errors.length} Rejected
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-400">
                Missing required fields
              </p>
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab("PREVIEW")}
            className={`pb-2.5 px-3 text-xs font-black transition border-b-2 cursor-pointer ${
              activeTab === "PREVIEW"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Question Preview ({questions.length})
          </button>
          {(errors.length > 0 || warnings.length > 0) && (
            <button
              onClick={() => setActiveTab("ISSUES")}
              className={`pb-2.5 px-3 text-xs font-black transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === "ISSUES"
                  ? "border-rose-600 text-rose-600 dark:text-rose-400"
                  : "border-transparent text-slate-500 hover:text-rose-600"
              }`}
            >
              <span>Validation Issues ({errors.length + warnings.length})</span>
              {errors.length > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[9px]">
                  {errors.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[250px]">
          {activeTab === "PREVIEW" ? (
            questions.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No valid questions found in the file.
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                          #{idx + 1}
                        </span>
                        <span className="font-extrabold text-blue-600 dark:text-blue-400">
                          {q.category}
                        </span>
                        {q.subtopic && q.subtopic !== "General" && (
                          <span className="text-slate-500">• {q.subtopic}</span>
                        )}
                        {q.difficulty && (
                          <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-[10px] font-bold rounded-full uppercase">
                            {q.difficulty}
                          </span>
                        )}
                      </div>

                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        Answer: {letters[q.answerIndex] || "A"}
                      </span>
                    </div>

                    <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                      {q.prompt}
                    </p>

                    {/* Options Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt, oIdx) => {
                        const isCorrect = q.answerIndex === oIdx;
                        return (
                          <div
                            key={oIdx}
                            className={`p-2 rounded-xl border text-[11px] flex items-center justify-between ${
                              isCorrect
                                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <span>
                              <strong>{letters[oIdx]}.</strong> {opt}
                            </span>
                            {isCorrect && (
                              <span className="text-[10px] text-emerald-600 font-black">
                                ✓
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Educational reasoning indicators */}
                    <div className="flex flex-wrap gap-2 pt-1 text-[10px] font-semibold text-slate-500">
                      {q.stepByStep && (
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800">
                          ✓ Step-by-Step
                        </span>
                      )}
                      {(q.whyA || q.whyB || q.whyC || q.whyD) && (
                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-200 dark:border-indigo-800">
                          ✓ Option Analysis
                        </span>
                      )}
                      {q.eliminationStrategy && (
                        <span className="px-2 py-0.5 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 rounded-md border border-teal-200 dark:border-teal-800">
                          ✓ Elimination Strategy
                        </span>
                      )}
                      {q.commonTrap && (
                        <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-md border border-rose-200 dark:border-rose-800">
                          ✓ Common Trap
                        </span>
                      )}
                      {q.examTip && (
                        <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
                          ✓ Exam Tip
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Issues Tab */
            <div className="space-y-3">
              {errors.map((err, i) => (
                <div
                  key={`err-${i}`}
                  className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-1 text-xs text-rose-900 dark:text-rose-200"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>Row #{err.row} — Error in {err.field || "Row"}</span>
                    <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] uppercase">
                      Rejected
                    </span>
                  </div>
                  <p>{err.message}</p>
                  {err.prompt && <p className="text-slate-500 italic">Prompt: "{err.prompt.slice(0, 80)}..."</p>}
                </div>
              ))}

              {warnings.map((warn, i) => (
                <div
                  key={`warn-${i}`}
                  className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1 text-xs text-amber-900 dark:text-amber-200"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>Row #{warn.row} — Warning in {warn.field || "Row"}</span>
                    <span className="px-2 py-0.5 bg-amber-600 text-white rounded text-[10px] uppercase">
                      Warning
                    </span>
                  </div>
                  <p>{warn.message}</p>
                  {warn.prompt && <p className="text-slate-500 italic">Prompt: "{warn.prompt.slice(0, 80)}..."</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={questions.length === 0 || importing}
            onClick={handleImport}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{importing ? "Importing to Database..." : `Import ${questions.length} Valid Questions`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
