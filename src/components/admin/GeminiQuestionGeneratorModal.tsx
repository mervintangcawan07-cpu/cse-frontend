"use client";

import React, { useState } from "react";
import { StructuredQuestion } from "@/types/question";
import { generateQuestionsCSV } from "@/lib/csvParser";

interface GeminiQuestionGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuestionsImported: () => void;
}

const CATEGORY_SUBTOPICS: Record<string, string[]> = {
  "Numerical Reasoning": [
    "Work & Rate",
    "Ratios & Proportions",
    "Percentage & Interest",
    "Speed, Distance & Time",
    "Number Series & Sequences",
    "Algebraic Word Problems",
    "Data Interpretation",
  ],
  "Verbal Ability": [
    "Structural & Semantic Analogy",
    "Grammar & Correct Usage",
    "Vocabulary in Context",
    "Paragraph Organization",
    "Reading Comprehension",
    "Synonyms & Antonyms",
  ],
  "Analytical Reasoning": [
    "Multi-Condition Deductive Scheduling",
    "Syllogisms & Categorical Logic",
    "Seating Arrangements & Order",
    "Word Association & Logic",
    "Assumption & Conclusion",
  ],
  "General Information": [
    "Philippine Constitution (1987)",
    "RA 6713 Code of Conduct",
    "Peace & Human Rights",
    "Environmental Concepts & Ecology",
    "General Information on Government",
  ],
  "Clerical Ability": [
    "Filing & Alphabetical Sorting",
    "Spelling & Proofreading",
    "Clerical Operations",
  ],
};

export default function GeminiQuestionGeneratorModal({
  isOpen,
  onClose,
  onQuestionsImported,
}: GeminiQuestionGeneratorModalProps) {
  const [category, setCategory] = useState("Numerical Reasoning");
  const [subtopic, setSubtopic] = useState(CATEGORY_SUBTOPICS["Numerical Reasoning"][0]);
  const [difficulty, setDifficulty] = useState("HARD");
  const [count, setCount] = useState(5);

  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<StructuredQuestion[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    const subList = CATEGORY_SUBTOPICS[newCat] || ["General"];
    setSubtopic(subList[0] || "General");
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setErrorMsg(null);
    setGeneratedQuestions([]);

    try {
      const res = await fetch("/api/admin/questions/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subtopic,
          difficulty,
          count,
        }),
      });

      const data = await res.json();

      if (res.ok && data.questions) {
        setGeneratedQuestions(data.questions);
      } else {
        setErrorMsg(data.error || "Failed to generate questions.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error";
      setErrorMsg(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadCSV = () => {
    if (generatedQuestions.length === 0) return;
    const csv = generateQuestionsCSV(generatedQuestions);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `gemini_${category.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportToDatabase = async () => {
    if (generatedQuestions.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/admin/questions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: generatedQuestions }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Successfully imported ${generatedQuestions.length} questions into Question Bank!`);
        onQuestionsImported();
        onClose();
      } else {
        alert(data.error || "Failed to import questions.");
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred while saving to database.");
    } finally {
      setImporting(false);
    }
  };

  const handleCopyPrompt = () => {
    const offlinePrompt = `Generate ${count} Civil Service Examination multiple choice questions in ${category} (${subtopic}), difficulty ${difficulty}.
Output as a valid CSV with the following EXACT headers:
Category,Subtopic,Question,Option A,Option B,Option C,Option D,Correct Answer,Explanation,Step-by-Step Solution,Why A Is Wrong/Right,Why B Is Wrong/Right,Why C Is Wrong/Right,Why D Is Wrong/Right,Elimination Strategy,Common Trap,Exam Day Tip,Difficulty,Tags

Ensure all mathematics, logic, and grammatical structures are rigorously verified. Return raw CSV only.`;

    navigator.clipboard.writeText(offlinePrompt);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const letters = ["A", "B", "C", "D"];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-8 max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 my-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
          <div>
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-2xs">
              🤖 Gemini AI Generator
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1.5">
              Generate Structured CSE Questions with AI
            </h2>
            <p className="text-xs text-slate-500">
              Generates mathematically verified, structured CSE questions with step-by-step solutions and option analyses.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 font-bold text-sm transition flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 shrink-0 text-xs">
          {/* Category */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white cursor-pointer"
            >
              {Object.keys(CATEGORY_SUBTOPICS).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Subtopic */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Subtopic
            </label>
            <select
              value={subtopic}
              onChange={(e) => setSubtopic(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white cursor-pointer"
            >
              {(CATEGORY_SUBTOPICS[category] || ["General"]).map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
              <option value="VERY_HARD">Very Hard</option>
            </select>
          </div>

          {/* Count */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Questions Count
            </label>
            <select
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10))}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white cursor-pointer"
            >
              <option value={3}>3 Questions</option>
              <option value={5}>5 Questions</option>
              <option value={10}>10 Questions</option>
              <option value={15}>15 Questions</option>
            </select>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            disabled={generating}
            onClick={handleGenerate}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md disabled:opacity-40 transition cursor-pointer flex items-center gap-2"
          >
            <span>{generating ? "Generating with Gemini AI..." : `🚀 Generate ${count} Questions`}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPrompt}
            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            {copySuccess ? "✓ Copied Offline Prompt!" : "📋 Copy Prompt for Gemini Web"}
          </button>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs rounded-xl font-medium shrink-0">
            {errorMsg}
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[200px]">
          {generatedQuestions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-medium">
              {generating
                ? "Connecting to Gemini AI, constructing verified questions & detailed step derivations..."
                : "Select your desired category and click Generate to create questions."}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span>{generatedQuestions.length} Questions Generated</span>
                <span className="text-emerald-600 dark:text-emerald-400">✓ Validated Structure</span>
              </div>

              {generatedQuestions.map((q, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-black text-slate-900 dark:text-white">
                      Q#{idx + 1} • {q.subtopic}
                    </span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                      Answer: {letters[q.answerIndex]}
                    </span>
                  </div>

                  <p className="font-bold text-slate-900 dark:text-white">{q.prompt}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, oIdx) => (
                      <div
                        key={oIdx}
                        className={`p-2 rounded-xl border ${
                          q.answerIndex === oIdx
                            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-900 font-bold"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <strong>{letters[oIdx]}.</strong> {opt}
                      </div>
                    ))}
                  </div>

                  {q.stepByStep && (
                    <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl space-y-1">
                      <strong className="text-blue-900 dark:text-blue-300 text-[10px] uppercase block">
                        Step Solution:
                      </strong>
                      <p className="text-blue-950 dark:text-blue-200 leading-relaxed font-medium">
                        {String(q.stepByStep)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {generatedQuestions.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              📥 Download CSV
            </button>

            <button
              type="button"
              disabled={importing}
              onClick={handleImportToDatabase}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{importing ? "Importing..." : `Save ${generatedQuestions.length} Questions to Question Bank`}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
