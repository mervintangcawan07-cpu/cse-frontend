// Relative Path: src/components/exam/MistakeNotebookSection.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import ExplainMistakeButton from "@/components/ExplainMistakeButton";
import FormattedPrompt from "@/components/FormattedPrompt";

interface MistakeItem {
  id: string;
  questionId: string;
  userAnswer?: number | null;
  incorrectCount: number;
  correctCount: number;
  isMastered: boolean;
  lastAttemptAt: string;
  question: {
    id: string;
    category: string;
    subtopic: string;
    prompt: string;
    options: string[];
    answerIndex: number;
    explanation?: string | null;
    imageUrl?: string | null;
  };
}

interface MistakeStats {
  totalRecorded: number;
  activeCount: number;
  masteredCount: number;
  recoveryRate: number;
  categoryCounts: Record<string, { total: number; active: number; mastered: number }>;
}

const CATEGORIES = [
  "All",
  "Verbal Ability",
  "Numerical Reasoning",
  "Analytical Reasoning",
  "General Information",
  "Philippine Constitution",
];

export default function MistakeNotebookSection() {
  const [loading, setLoading] = useState(true);
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [stats, setStats] = useState<MistakeStats | null>(null);

  // Filters & Tabs
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [statusTab, setStatusTab] = useState<"ACTIVE" | "MASTERED" | "ALL">("ACTIVE");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"CATALOG" | "DRILL">("CATALOG");

  // Drill Mode State
  const [drillIndex, setDrillIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [drillFeedback, setDrillFeedback] = useState<{
    submitted: boolean;
    isCorrect: boolean;
    correctIndex: number;
    explanation?: string | null;
    isMastered: boolean;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchMistakes = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "All") params.set("category", selectedCategory);
      params.set("status", statusTab);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/user/mistakes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMistakes(data.mistakes || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load mistakes notebook:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMistakes();
  }, [selectedCategory, statusTab, searchQuery]);

  const handleToggleMastered = async (questionId: string) => {
    try {
      const res = await fetch("/api/user/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, action: "TOGGLE_MASTERED" }),
      });
      if (res.ok) {
        fetchMistakes();
      }
    } catch (err) {
      console.error("Failed to toggle mastery:", err);
    }
  };

  const handleClearMastered = async () => {
    if (!confirm("Are you sure you want to permanently clear all mastered items from your notebook?")) return;
    try {
      const res = await fetch("/api/user/mistakes?action=CLEAR_MASTERED", { method: "DELETE" });
      if (res.ok) {
        fetchMistakes();
      }
    } catch (err) {
      console.error("Failed to clear mastered items:", err);
    }
  };

  // Submit Answer in Drill Mode
  const handleDrillSubmit = async () => {
    if (selectedOption === null || actionLoading) return;
    const currentItem = mistakes[drillIndex];
    if (!currentItem) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/user/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentItem.questionId,
          selectedIndex: selectedOption,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDrillFeedback({
          submitted: true,
          isCorrect: data.isCorrect,
          correctIndex: data.correctAnswerIndex,
          explanation: data.explanation,
          isMastered: data.isMastered,
        });
      }
    } catch (err) {
      console.error("Failed to submit drill answer:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleNextDrillQuestion = () => {
    setSelectedOption(null);
    setDrillFeedback(null);
    if (drillIndex < mistakes.length - 1) {
      setDrillIndex(drillIndex + 1);
    } else {
      // Completed drill batch
      setViewMode("CATALOG");
      setDrillIndex(0);
      fetchMistakes();
    }
  };

  const currentDrillItem = mistakes[drillIndex];

  return (
    <div className="space-y-8">
      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider">
            Active Mistakes
          </span>
          <p className="text-3xl font-black text-white">{stats?.activeCount ?? 0}</p>
          <p className="text-xs text-slate-400">Need Balik-Aral review</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
            Mastered Items
          </span>
          <p className="text-3xl font-black text-white">{stats?.masteredCount ?? 0}</p>
          <p className="text-xs text-slate-400">Answered correctly 2x</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">
            Recovery Rate
          </span>
          <p className="text-3xl font-black text-white">{stats?.recoveryRate ?? 0}%</p>
          <p className="text-xs text-slate-400">Mistakes turned to mastery</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
            Total History
          </span>
          <p className="text-3xl font-black text-white">{stats?.totalRecorded ?? 0}</p>
          <p className="text-xs text-slate-400">Recorded across all exams</p>
        </div>
      </div>

      {/* TOP CONTROLS & MODE TOGGLE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        {/* Status Tab Filter */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              setStatusTab("ACTIVE");
              setViewMode("CATALOG");
            }}
            className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition cursor-pointer ${
              statusTab === "ACTIVE"
                ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🔥 Active Mistakes ({stats?.activeCount ?? 0})
          </button>
          <button
            onClick={() => {
              setStatusTab("MASTERED");
              setViewMode("CATALOG");
            }}
            className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition cursor-pointer ${
              statusTab === "MASTERED"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ✓ Mastered ({stats?.masteredCount ?? 0})
          </button>
          <button
            onClick={() => {
              setStatusTab("ALL");
              setViewMode("CATALOG");
            }}
            className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition cursor-pointer ${
              statusTab === "ALL"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            All Items
          </button>
        </div>

        {/* View Mode & Actions */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {mistakes.length > 0 && statusTab === "ACTIVE" && viewMode === "CATALOG" && (
            <button
              onClick={() => {
                setViewMode("DRILL");
                setDrillIndex(0);
                setSelectedOption(null);
                setDrillFeedback(null);
              }}
              className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white text-xs font-black rounded-xl shadow-lg shadow-rose-600/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>⚡</span>
              <span>Launch Balik-Aral Drill</span>
            </button>
          )}

          {viewMode === "DRILL" && (
            <button
              onClick={() => setViewMode("CATALOG")}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              ← Back to Catalog
            </button>
          )}

          {statusTab === "MASTERED" && (stats?.masteredCount ?? 0) > 0 && (
            <button
              onClick={handleClearMastered}
              className="px-3.5 py-2 bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Clear Mastered
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODE 1: INTERACTIVE BALIK-ARAL DRILL MODE */}
      {/* ======================================================== */}
      {viewMode === "DRILL" && currentDrillItem && (
        <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl shadow-rose-500/5">
          {/* Header Info */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 bg-rose-500/20 text-rose-400 rounded-md border border-rose-500/30 font-mono">
                  {currentDrillItem.question.category}
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  {currentDrillItem.question.subtopic}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Question {drillIndex + 1} of {mistakes.length} • Missed {currentDrillItem.incorrectCount} time(s) previously
              </p>
            </div>

            {/* Mastery Progress Indicator */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-xs">🎯</span>
              <span className="text-xs font-bold text-slate-300">
                Mastery Streak: {currentDrillItem.correctCount}/2
              </span>
            </div>
          </div>

          {/* Question Prompt */}
          <div className="space-y-4">
            <FormattedPrompt text={currentDrillItem.question.prompt} className="text-base md:text-lg font-bold text-white leading-relaxed" />
          </div>

          {/* Options Grid */}
          <div className="space-y-3 pt-2">
            {currentDrillItem.question.options.map((opt, idx) => {
              let optionStyle = "bg-slate-950/80 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-900";
              const letter = ["A", "B", "C", "D", "E"][idx] || `${idx + 1}`;

              if (drillFeedback?.submitted) {
                if (idx === drillFeedback.correctIndex) {
                  optionStyle = "bg-emerald-600/20 border-emerald-500/50 text-emerald-300 font-bold";
                } else if (idx === selectedOption && !drillFeedback.isCorrect) {
                  optionStyle = "bg-rose-600/20 border-rose-500/50 text-rose-300 font-bold";
                } else {
                  optionStyle = "bg-slate-950/40 border-slate-900 text-slate-600 opacity-60";
                }
              } else if (selectedOption === idx) {
                optionStyle = "bg-blue-600/20 border-blue-500 text-blue-300 font-bold shadow-md shadow-blue-500/10";
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={drillFeedback?.submitted || actionLoading}
                  onClick={() => setSelectedOption(idx)}
                  className={`w-full p-4 rounded-2xl border text-left text-xs sm:text-sm font-medium transition cursor-pointer flex items-start gap-3.5 ${optionStyle}`}
                >
                  <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    {letter}
                  </span>
                  <span className="flex-1 leading-relaxed">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Solution Feedback & Explanation */}
          {drillFeedback?.submitted && (
            <div className={`p-5 rounded-2xl border space-y-3 animate-fade-in ${
              drillFeedback.isCorrect
                ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                : "bg-rose-950/30 border-rose-500/40 text-rose-300"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{drillFeedback.isCorrect ? "🎉" : "❌"}</span>
                  <span className="font-extrabold text-sm">
                    {drillFeedback.isCorrect
                      ? drillFeedback.isMastered
                        ? "Mastered! Correctly answered twice in a row!"
                        : "Correct! One more time to mark as mastered."
                      : "Incorrect. Review the detailed explanation below."}
                  </span>
                </div>

                <ExplainMistakeButton
                  prompt={currentDrillItem.question.prompt}
                  userChoice={currentDrillItem.question.options[selectedOption ?? 0] || "No answer"}
                  correctChoice={currentDrillItem.question.options[drillFeedback.correctIndex] || "Correct option"}
                  officialExplanation={drillFeedback.explanation || undefined}
                  category={currentDrillItem.question.category}
                />
              </div>

              {drillFeedback.explanation && (
                <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs text-slate-300 leading-relaxed space-y-1">
                  <p className="font-bold text-slate-200">Official Explanation:</p>
                  <p>{drillFeedback.explanation}</p>
                </div>
              )}
            </div>
          )}

          {/* Drill Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => handleToggleMastered(currentDrillItem.questionId)}
              className="text-xs text-slate-400 hover:text-emerald-400 font-bold transition cursor-pointer"
            >
              ✓ Mark as Mastered Manually
            </button>

            {!drillFeedback?.submitted ? (
              <button
                onClick={handleDrillSubmit}
                disabled={selectedOption === null || actionLoading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-lg shadow-blue-600/30 disabled:opacity-50"
              >
                {actionLoading ? "Evaluating..." : "Check Answer ⚡"}
              </button>
            ) : (
              <button
                onClick={handleNextDrillQuestion}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-lg shadow-emerald-600/30"
              >
                {drillIndex < mistakes.length - 1 ? "Next Mistake →" : "Finish Balik-Aral Drill 🏁"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: CATALOG & FILTERABLE MISTAKE LIST */}
      {/* ======================================================== */}
      {viewMode === "CATALOG" && (
        <div className="space-y-6">
          {/* Category Filter Chips & Search Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            {/* Category Chips */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const count =
                  cat === "All"
                    ? stats?.activeCount ?? 0
                    : stats?.categoryCounts[cat]?.active ?? 0;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-blue-600/20 text-blue-400 border border-blue-500/40 font-black shadow-sm"
                        : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    {cat} {count > 0 && <span className="text-[10px] opacity-75">({count})</span>}
                  </button>
                );
              })}
            </div>

            {/* Keyword Search */}
            <div className="w-full md:w-64">
              <input
                type="text"
                placeholder="Search prompt keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Mistakes Feed */}
          {loading ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 font-bold animate-pulse">
              Loading Mistake Notebook...
            </div>
          ) : mistakes.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <span className="text-4xl block">🎉</span>
              <h4 className="text-base font-bold text-white">
                {statusTab === "ACTIVE"
                  ? "No Active Mistakes in this Category!"
                  : "No Mastered Items Found"}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                {statusTab === "ACTIVE"
                  ? "Great job! Keep taking timed mock exams and drills to reinforce your knowledge and identify new areas to strengthen."
                  : "Answer active mistakes correctly twice to promote them to the Mastered archive."}
              </p>
              <Link
                href="/mock-exam/take"
                className="inline-block mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition shadow-lg shadow-blue-600/30"
              >
                Take a Mock Exam ⚡
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {mistakes.map((item, idx) => {
                const q = item.question;
                const correctOpt = q.options[q.answerIndex] || "Answer not available";
                const userOpt =
                  typeof item.userAnswer === "number" && q.options[item.userAnswer]
                    ? q.options[item.userAnswer]
                    : null;

                return (
                  <div
                    key={item.id}
                    className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-3xl space-y-4 hover:border-slate-700 transition"
                  >
                    {/* Item Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20 font-mono">
                          {q.category}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">{q.subtopic}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                          Missed {item.incorrectCount}x
                        </span>
                        {item.isMastered ? (
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                            ✓ Mastered
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                            Needs Review ({item.correctCount}/2)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Prompt */}
                    <FormattedPrompt text={q.prompt} className="text-sm md:text-base font-bold text-white leading-relaxed" />

                    {/* Answer Comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {userOpt && (
                        <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-0.5">
                          <span className="text-[10px] font-black text-rose-400 uppercase">
                            Your Previous Answer
                          </span>
                          <p className="text-xs text-rose-200">{userOpt}</p>
                        </div>
                      )}

                      <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-0.5">
                        <span className="text-[10px] font-black text-emerald-400 uppercase">
                          Correct Answer
                        </span>
                        <p className="text-xs text-emerald-200">{correctOpt}</p>
                      </div>
                    </div>

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-400 leading-relaxed">
                        <strong className="text-slate-300 font-semibold">Solution: </strong>
                        {q.explanation}
                      </div>
                    )}

                    {/* Actions Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                      <button
                        onClick={() => handleToggleMastered(item.questionId)}
                        className="text-xs font-bold text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                      >
                        {item.isMastered ? "↺ Re-add to Active Mistakes" : "✓ Mark as Mastered"}
                      </button>

                      <div className="flex items-center gap-2">
                        <ExplainMistakeButton
                          prompt={q.prompt}
                          userChoice={userOpt || "No answer"}
                          correctChoice={correctOpt}
                          officialExplanation={q.explanation || undefined}
                          category={q.category}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
