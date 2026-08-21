"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ExplainMistakeButton from "@/components/ExplainMistakeButton";
import QuestionReview from "@/components/question/QuestionReview";
import DiagnosticScoreCard from "@/components/exam/DiagnosticScoreCard";
import ConfettiCelebration from "@/components/common/ConfettiCelebration";
import { StructuredQuestion } from "@/types/question";



interface ReviewData {
  questions: StructuredQuestion[];
  selectedAnswers: { [key: number]: number };
  score: number;
  correct: number;
  incorrect: number;
  skipped: number;
}

function ExamResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("id");

  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "INCORRECT" | "CORRECT" | "SKIPPED">("ALL");

  useEffect(() => {
    setMounted(true);

    async function loadData() {
      // 1. If an attemptId exists in URL search params, fetch snapshot from API
      if (attemptId) {
        setLoading(true);
        try {
          const res = await fetch(`/api/mock-exam/history/${attemptId}`);
          const data = await res.json();

          if (res.ok && data.attempt) {
            const att = data.attempt;
            if (att.details && Array.isArray(att.details)) {
              const questions: StructuredQuestion[] = [];
              const selectedAnswers: { [key: number]: number } = {};

              att.details.forEach((item: any, idx: number) => {
                questions.push({
                  id: item.id || String(idx),
                  category: item.category || "General",
                  subtopic: item.subtopic || "General",
                  prompt: item.prompt || "",
                  options: item.options || [],
                  answerIndex: item.answerIndex ?? 0,
                  explanation: item.explanation,
                  imageUrl: item.imageUrl || null,
                  stepByStep: item.stepByStep || null,
                  whyA: item.whyA || null,
                  whyB: item.whyB || null,
                  whyC: item.whyC || null,
                  whyD: item.whyD || null,
                  eliminationStrategy: item.eliminationStrategy || null,
                  commonTrap: item.commonTrap || null,
                  examTip: item.examTip || null,
                  difficulty: item.difficulty || "MEDIUM",
                  tags: item.tags || [],
                });
                if (item.selectedIndex !== null && item.selectedIndex !== undefined && item.selectedIndex >= 0) {
                  selectedAnswers[idx] = item.selectedIndex;
                }
              });

              setReviewData({
                questions,
                selectedAnswers,
                score: att.percentage ?? Math.round((att.correct / att.totalItems) * 100),
                correct: att.correct ?? 0,
                incorrect: att.incorrect ?? 0,
                skipped: att.skipped ?? 0,
              });
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.error("Failed to load historical attempt:", err);
        }
        setLoading(false);
      }

      // 2. Fallback to localStorage for immediate result rendering after submission
      const saved = localStorage.getItem("cse_latest_review");
      if (saved) {
        try {
          setReviewData(JSON.parse(saved));
        } catch (err) {
          console.error("Failed to parse review data:", err);
        }
      }
    }

    loadData();
  }, [attemptId]);

  const handleRetakeExam = () => {
    localStorage.removeItem("cse_active_exam_session");
    localStorage.removeItem("cse_latest_review");
    router.push("/mock-exam/take");
  };

  if (!mounted || loading) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="font-extrabold text-slate-700 dark:text-slate-300">
          Loading diagnostic review data...
        </p>
      </div>
    );
  }

  if (!reviewData) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-6">
        <div className="text-5xl">📊</div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">
          No Recent Exam Found
        </h2>
        <p className="text-sm text-slate-500">
          You haven't completed a mock examination in this session or your review history has expired.
        </p>
        <Link
          href="/mock-exam/take"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition"
        >
          Start a Mock Exam Now
        </Link>
      </div>
    );
  }

  const { questions, selectedAnswers, score, correct, incorrect, skipped } = reviewData;
  const isPassed = score >= 80;

  // Filter questions with their original item indices
  const filteredQuestionsWithIndex = questions
    .map((q, idx) => ({ q, originalIdx: idx }))
    .filter(({ q, originalIdx }) => {
      const userChoice = selectedAnswers[originalIdx];
      const isCorrect = userChoice === q.answerIndex;
      const isSkipped = userChoice === undefined;

      if (filter === "CORRECT") return isCorrect;
      if (filter === "INCORRECT") return !isCorrect && !isSkipped;
      if (filter === "SKIPPED") return isSkipped;
      return true; // ALL
    });

  return (
    <div className="w-full max-w-6xl mx-auto px-2 py-3.5 sm:px-4 sm:py-6 md:px-6 space-y-4 sm:space-y-8 relative">
      {/* 🎉 Milestone Celebration Confetti on Passing Score (≥80%) */}
      {isPassed && <ConfettiCelebration />}

      {/* 🏆 Score Summary Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl text-center space-y-4 sm:space-y-6">
        <div className="space-y-2">
          <span
            className={`text-xs font-black uppercase px-3 py-1 rounded-full border inline-block ${
              isPassed
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 animate-bounce"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
            }`}
          >
            {isPassed ? "🎉 Official CSE Passing Grade Achieved!" : "⚠️ Needs Improvement (Passing is 80%)"}
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
            Diagnostic Exam Results
          </h1>
        </div>

        {/* Big Score Gauge */}
        <div className="flex justify-center items-baseline gap-2">
          <span className="text-6xl sm:text-7xl font-black text-slate-900 dark:text-white tracking-tight">
            {score}%
          </span>
          <span className="text-lg font-bold text-slate-400">Rating</span>
        </div>

        {/* Detailed Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-bold uppercase block">Total Items</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {questions.length}
            </span>
          </div>

          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/60">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase block">
              Correct
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {correct}
            </span>
          </div>

          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800/60">
            <span className="text-xs text-rose-600 dark:text-rose-400 font-bold uppercase block">
              Incorrect
            </span>
            <span className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-400">
              {incorrect}
            </span>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-bold uppercase block">Skipped</span>
            <span className="text-xl sm:text-2xl font-black text-slate-700 dark:text-slate-300">
              {skipped}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
          <button
            onClick={handleRetakeExam}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
          >
            Retake Exam 🔄
          </button>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://govstudyx.com/practice")}&quote=${encodeURIComponent(`Naka-${score}% ako sa Civil Service Mock Exam sa GovStudyX! Subukan niyo rin mag-practice dito:`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20"
          >
            <span>Challenge a Study Buddy 🔥</span>
          </a>
          <Link
            href="/mock-exam/history"
            className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black text-xs rounded-xl transition"
          >
            View History 📜
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black text-xs rounded-xl transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* 📊 Visual Performance Diagnostic Card (Shareable & Downloadable) */}
      <DiagnosticScoreCard
        score={score}
        totalItems={questions.length}
        correct={correct}
        incorrect={incorrect}
        skipped={skipped}
        questions={questions}
        selectedAnswers={selectedAnswers}
      />

      {/* 📚 Question-by-Question Deep Review */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Item Rationalization & Deep Breakdown
            </h2>
            <p className="text-xs text-slate-500">
              Review step-by-step solutions, option analyses, and traps for every exam item.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-bold shrink-0">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                filter === "ALL"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All ({questions.length})
            </button>
            <button
              onClick={() => setFilter("INCORRECT")}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                filter === "INCORRECT"
                  ? "bg-rose-600 text-white shadow-xs font-black"
                  : "text-slate-500 hover:text-rose-600"
              }`}
            >
              ❌ Incorrect ({incorrect})
            </button>
            <button
              onClick={() => setFilter("CORRECT")}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                filter === "CORRECT"
                  ? "bg-emerald-600 text-white shadow-xs font-black"
                  : "text-slate-500 hover:text-emerald-600"
              }`}
            >
              ✅ Correct ({correct})
            </button>
            {skipped > 0 && (
              <button
                onClick={() => setFilter("SKIPPED")}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  filter === "SKIPPED"
                    ? "bg-slate-900 dark:bg-slate-950 text-white shadow-xs font-black"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Skipped ({skipped})
              </button>
            )}
          </div>
        </div>

        {/* Filtered Question List */}
        {filteredQuestionsWithIndex.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <p className="text-slate-500 font-bold text-xs">No questions match this filter.</p>
            <button
              onClick={() => setFilter("ALL")}
              className="text-xs text-blue-600 dark:text-blue-400 font-black hover:underline cursor-pointer"
            >
              Show all questions
            </button>
          </div>
        ) : (
          filteredQuestionsWithIndex.map(({ q, originalIdx }) => {
            const userChoice = selectedAnswers[originalIdx];
            const isCorrect = userChoice === q.answerIndex;
            const isSkipped = userChoice === undefined;

            return (
              <QuestionReview
                key={q.id || originalIdx}
                question={q}
                userAnswerIndex={userChoice}
                itemNumber={originalIdx + 1}
                mode="REVIEW"
                isSkipped={isSkipped}
                actions={
                  !isCorrect && !isSkipped && userChoice !== undefined ? (
                    <ExplainMistakeButton
                      prompt={q.prompt}
                      userChoice={q.options[userChoice]}
                      correctChoice={q.options[q.answerIndex]}
                      officialExplanation={q.explanation}
                      category={q.category}
                    />
                  ) : null
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ExamResultPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
          Loading exam results...
        </div>
      }
    >
      <ExamResultContent />
    </Suspense>
  );
}
