// Relative Path: src/components/exam/MistakeNotebookSection.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import ExplainMistakeButton from "@/components/ExplainMistakeButton";
import QuestionReview from "@/components/question/QuestionReview";
import { StructuredQuestion } from "@/types/question";

interface MistakeItem {
  id: string;
  questionId: string;
  userAnswer?: number | null;
  incorrectCount: number;
  correctCount: number;
  isMastered: boolean;
  lastAttemptAt: string;
  question: StructuredQuestion;
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
          correctIndex: currentItem.question.answerIndex,
          explanation: currentItem.question.explanation,
          isMastered: data.isMastered,
        });
        fetchMistakes();
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
      setDrillIndex((prev) => prev + 1);
    } else {
      setDrillIndex(0);
      setViewMode("CATALOG");
    }
  };

  const currentDrillItem = mistakes[drillIndex];

  return (
    <div className="space-y-8">
      {/* 📊 Summary Metrics Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-3xl space-y-1 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
            Total Mistakes Tracked
          </span>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {stats?.totalRecorded ?? 0}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-3xl space-y-1 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
            Active Review Needs
          </span>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
            {stats?.activeCount ?? 0}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-3xl space-y-1 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
            Mastered Items (2x Streak)
          </span>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {stats?.masteredCount ?? 0}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-3xl space-y-1 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
            Concept Recovery Rate
          </span>
          <p className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
            {stats?.recoveryRate ?? 0}%
          </p>
        </div>
      </div>

      {/* Control Navigation & Mode Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl text-xs font-bold">
          <button
            onClick={() => {
              setStatusTab("ACTIVE");
              setViewMode("CATALOG");
            }}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer ${
              statusTab === "ACTIVE"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Active ({stats?.activeCount ?? 0})
          </button>
          <button
            onClick={() => {
              setStatusTab("MASTERED");
              setViewMode("CATALOG");
            }}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer ${
              statusTab === "MASTERED"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Mastered ({stats?.masteredCount ?? 0})
          </button>
          <button
            onClick={() => {
              setStatusTab("ALL");
              setViewMode("CATALOG");
            }}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer ${
              statusTab === "ALL"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            All Items
          </button>
        </div>

        {/* View Mode Toggle Button */}
        {mistakes.length > 0 && statusTab === "ACTIVE" && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setViewMode(viewMode === "CATALOG" ? "DRILL" : "CATALOG");
                setDrillIndex(0);
                setSelectedOption(null);
                setDrillFeedback(null);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white text-xs font-extrabold rounded-2xl transition shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <span>{viewMode === "CATALOG" ? "🎯 Start Balik-Aral Drill" : "📋 Switch to Catalog View"}</span>
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODE 1: INTERACTIVE DRILL MODE */}
      {/* ======================================================== */}
      {viewMode === "DRILL" && currentDrillItem && (
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
            <span>
              Drill Item {drillIndex + 1} of {mistakes.length} • Missed {currentDrillItem.incorrectCount}x
            </span>
            <span className="text-blue-600 dark:text-blue-400">
              Mastery Streak: {currentDrillItem.correctCount}/2
            </span>
          </div>

          <QuestionReview
            question={currentDrillItem.question}
            userAnswerIndex={selectedOption}
            itemNumber={drillIndex + 1}
            mode="INTERACTIVE"
            isSubmitted={drillFeedback?.submitted}
            badgeLabel="Balik-Aral Drill"
            onSelectOption={setSelectedOption}
            onSubmitAnswer={handleDrillSubmit}
            footerActions={
              drillFeedback?.submitted ? (
                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => handleToggleMastered(currentDrillItem.questionId)}
                    className="text-xs font-bold text-slate-400 hover:text-emerald-500 cursor-pointer"
                  >
                    ✓ Mark as Mastered Manually
                  </button>
                  <button
                    onClick={handleNextDrillQuestion}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-md cursor-pointer"
                  >
                    {drillIndex < mistakes.length - 1 ? "Next Question →" : "Finish Drill 🏁"}
                  </button>
                </div>
              ) : null
            }
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: CATALOG & FILTERABLE MISTAKE LIST */}
      {/* ======================================================== */}
      {viewMode === "CATALOG" && (
        <div className="space-y-6">
          {/* Category Filter Chips & Search Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-black shadow-xs"
                        : "bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              placeholder="Search mistaken concepts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Mistakes Feed */}
          {loading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-400 font-bold animate-pulse">
              Loading Mistake Notebook...
            </div>
          ) : mistakes.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <span className="text-4xl block">🎉</span>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                {statusTab === "ACTIVE"
                  ? "No Active Mistakes in this Category!"
                  : "No Mastered Items Found"}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                {statusTab === "ACTIVE"
                  ? "Great job! Keep taking timed mock exams and drills to reinforce your knowledge and identify new areas to strengthen."
                  : "Answer active mistakes correctly twice to promote them to the Mastered archive."}
              </p>
              <Link
                href="/mock-exam/take"
                className="inline-block mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition shadow-md"
              >
                Take a Mock Exam ⚡
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {mistakes.map((item, idx) => {
                const q = item.question;
                return (
                  <QuestionReview
                    key={item.id || idx}
                    question={q}
                    userAnswerIndex={item.userAnswer}
                    itemNumber={idx + 1}
                    mode="REVIEW"
                    badgeLabel={item.isMastered ? "Mastered" : `Needs Review (${item.correctCount}/2)`}
                    actions={
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleMastered(item.questionId)}
                          className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
                        >
                          {item.isMastered ? "↺ Re-activate" : "✓ Mark Mastered"}
                        </button>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
