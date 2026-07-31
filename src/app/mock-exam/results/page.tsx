"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ExplainMistakeButton from "@/components/ExplainMistakeButton";

interface Question {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
}

interface ReviewData {
  questions: Question[];
  selectedAnswers: { [key: number]: number };
  score: number;
  correct: number;
  incorrect: number;
  skipped: number;
}

export default function ExamResultPage() {
  const router = useRouter();
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "INCORRECT" | "CORRECT" | "SKIPPED">("ALL");

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("cse_latest_review");
    if (saved) {
      try {
        setReviewData(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to parse review data:", err);
      }
    }
  }, []);

  // Handler for fresh retake
  const handleRetakeExam = () => {
    localStorage.removeItem("cse_active_exam_session");
    router.push("/exam");
  };

  const scrollToReview = (filterMode: "ALL" | "INCORRECT" | "CORRECT" | "SKIPPED") => {
    setFilter(filterMode);
    const el = document.getElementById("review-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Prevents SSR hydration mismatch on Vercel deployment
  if (!mounted) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <p className="text-slate-500 font-medium animate-pulse">Loading exam results...</p>
      </div>
    );
  }

  if (!reviewData || !reviewData.questions) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <p className="text-slate-600 font-semibold">No recent test results found.</p>
        <Link
          href="/dashboard"
          className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const {
    questions = [],
    selectedAnswers = {},
    score = 0,
    correct = 0,
    incorrect = 0,
    skipped = 0,
  } = reviewData;

  const isPassed = score >= 80;

  // Filter questions while keeping track of their original numbers
  const filteredQuestionsWithIndex = questions
    .map((q, originalIdx) => ({ q, originalIdx }))
    .filter(({ q, originalIdx }) => {
      const userChoice = selectedAnswers[originalIdx];
      const isCorrect = userChoice === q.answerIndex;
      const isSkipped = userChoice === undefined;

      if (filter === "INCORRECT") return !isCorrect && !isSkipped;
      if (filter === "CORRECT") return isCorrect;
      if (filter === "SKIPPED") return isSkipped;
      return true;
    });

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8">
      {/* Score Header Card */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
        <div className="inline-block">
          <span
            className={`text-xs font-extrabold uppercase px-3 py-1 rounded-full ${
              isPassed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            }`}
          >
            {isPassed ? "Passed — Benchmark Reached" : "Needs Review"}
          </span>
        </div>

        <div>
          <h1 className="text-5xl font-black text-slate-900">{score}%</h1>
          <p className="text-slate-500 text-sm mt-1">Final Practice Exam Score</p>
        </div>

        {/* Interactive Breakdown Stats */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={() => scrollToReview("CORRECT")}
            className="bg-emerald-50 hover:bg-emerald-100 p-3 rounded-2xl border border-emerald-100 transition text-center group cursor-pointer"
          >
            <p className="text-xl font-extrabold text-emerald-700">{correct}</p>
            <p className="text-[11px] font-semibold text-emerald-600 group-hover:underline">Correct ✅</p>
          </button>

          <button
            onClick={() => scrollToReview("INCORRECT")}
            className="bg-rose-50 hover:bg-rose-100 p-3 rounded-2xl border border-rose-100 transition text-center group cursor-pointer"
          >
            <p className="text-xl font-extrabold text-rose-700">{incorrect}</p>
            <p className="text-[11px] font-semibold text-rose-600 group-hover:underline">Incorrect ❌</p>
          </button>

          <button
            onClick={() => scrollToReview("SKIPPED")}
            className="bg-slate-50 hover:bg-slate-100 p-3 rounded-2xl border border-slate-200 transition text-center group cursor-pointer"
          >
            <p className="text-xl font-extrabold text-slate-700">{skipped}</p>
            <p className="text-[11px] font-semibold text-slate-500 group-hover:underline">Skipped ⏭️</p>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap justify-center gap-3">
          {incorrect > 0 && (
            <button
              onClick={() => scrollToReview("INCORRECT")}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span>❌ Review {incorrect} Mistakes</span>
            </button>
          )}

          <button
            onClick={handleRetakeExam}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition shadow-sm cursor-pointer"
          >
            Retake Exam ⚡
          </button>

          <Link
            href="/dashboard"
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Answer Key Breakdown with Filter Tabs */}
      <div id="review-section" className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <h2 className="text-xl font-extrabold text-slate-900">Question Review</h2>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold flex-wrap">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                filter === "ALL"
                  ? "bg-white text-slate-900 shadow-sm font-extrabold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              All ({questions.length})
            </button>
            <button
              onClick={() => setFilter("INCORRECT")}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                filter === "INCORRECT"
                  ? "bg-rose-600 text-white shadow-sm font-extrabold"
                  : "text-slate-500 hover:text-rose-600"
              }`}
            >
              ❌ Incorrect ({incorrect})
            </button>
            <button
              onClick={() => setFilter("CORRECT")}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                filter === "CORRECT"
                  ? "bg-emerald-600 text-white shadow-sm font-extrabold"
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
                    ? "bg-slate-800 text-white shadow-sm font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Skipped ({skipped})
              </button>
            )}
          </div>
        </div>

        {/* Filtered Question List */}
        {filteredQuestionsWithIndex.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
            <p className="text-slate-600 font-bold">No questions match this filter.</p>
            <button
              onClick={() => setFilter("ALL")}
              className="text-xs text-blue-600 font-extrabold hover:underline cursor-pointer"
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
              <div
                key={q.id || originalIdx}
                className={`p-6 rounded-2xl border bg-white shadow-sm space-y-4 ${
                  isCorrect
                    ? "border-emerald-200"
                    : isSkipped
                    ? "border-slate-200"
                    : "border-rose-200 bg-rose-50/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">
                    Question #{originalIdx + 1} • {q.category}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      isCorrect
                        ? "bg-emerald-100 text-emerald-800"
                        : isSkipped
                        ? "bg-slate-100 text-slate-600"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {isCorrect ? "Correct" : isSkipped ? "Skipped" : "Incorrect"}
                  </span>
                </div>

                <p className="font-bold text-slate-800 leading-relaxed">{q.prompt}</p>

                <div className="space-y-2">
                  {q.options.map((opt, optionIdx) => {
                    const isUserSelection = userChoice === optionIdx;
                    const isRightAnswer = q.answerIndex === optionIdx;

                    let optionStyle = "border-slate-100 bg-slate-50 text-slate-600";
                    if (isRightAnswer) {
                      optionStyle = "border-emerald-300 bg-emerald-50 text-emerald-900 font-bold";
                    } else if (isUserSelection && !isCorrect) {
                      optionStyle = "border-rose-300 bg-rose-50 text-rose-900 font-bold";
                    }

                    return (
                      <div
                        key={optionIdx}
                        className={`p-3 rounded-xl border text-sm flex items-center justify-between ${optionStyle}`}
                      >
                        <span>{opt}</span>
                        {isRightAnswer && (
                          <span className="text-xs text-emerald-600 font-bold">✓ Correct Answer</span>
                        )}
                        {isUserSelection && !isRightAnswer && (
                          <span className="text-xs text-rose-600 font-bold">Your Answer</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation Box */}
                {q.explanation && (
                  <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1">
                    <span className="font-extrabold uppercase text-[10px] text-blue-600 block">
                      💡 Official Explanation
                    </span>
                    <p className="leading-relaxed">{q.explanation}</p>
                  </div>
                )}

                {/* 🤖 AI TUTOR INTEGRATION: Render "Why was my choice wrong?" ONLY on incorrect answers */}
                {!isCorrect && !isSkipped && userChoice !== undefined && (
                  <ExplainMistakeButton
                    prompt={q.prompt}
                    userChoice={q.options[userChoice]}
                    correctChoice={q.options[q.answerIndex]}
                    officialExplanation={q.explanation}
                    category={q.category}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}