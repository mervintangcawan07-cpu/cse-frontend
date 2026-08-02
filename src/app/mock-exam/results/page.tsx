"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
              const questions: Question[] = [];
              const selectedAnswers: { [key: number]: number } = {};

              att.details.forEach((item: any, idx: number) => {
                questions.push({
                  id: item.id || String(idx),
                  category: item.category || "General",
                  prompt: item.prompt || "",
                  options: item.options || [],
                  answerIndex: item.answerIndex ?? 0,
                  explanation: item.explanation,
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
    router.push("/mock-exam/take");
  };

  const scrollToReview = (filterMode: "ALL" | "INCORRECT" | "CORRECT" | "SKIPPED") => {
    setFilter(filterMode);
    const el = document.getElementById("review-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (!mounted || loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <p className="text-slate-400 font-medium animate-pulse">Loading exam results & solution keys...</p>
      </div>
    );
  }

  if (!reviewData || !reviewData.questions) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <p className="text-slate-400 font-semibold">No recent test results found.</p>
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
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8 text-slate-100">
      {/* Score Header Card */}
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl text-center space-y-4">
        <div className="inline-block">
          <span
            className={`text-xs font-extrabold uppercase px-3 py-1 rounded-full border ${
              isPassed
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
            }`}
          >
            {isPassed ? "Passed — Benchmark Reached" : "Needs Review"}
          </span>
        </div>

        <div>
          <h1 className="text-5xl font-black text-white">{score}%</h1>
          <p className="text-slate-400 text-sm mt-1">Final Practice Exam Score</p>
        </div>

        {/* Interactive Breakdown Stats */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={() => scrollToReview("CORRECT")}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 p-3 rounded-2xl border border-emerald-500/20 transition text-center group cursor-pointer"
          >
            <p className="text-xl font-extrabold text-emerald-400">{correct}</p>
            <p className="text-[11px] font-semibold text-emerald-400/80 group-hover:underline">Correct ✅</p>
          </button>

          <button
            onClick={() => scrollToReview("INCORRECT")}
            className="bg-rose-500/10 hover:bg-rose-500/20 p-3 rounded-2xl border border-rose-500/20 transition text-center group cursor-pointer"
          >
            <p className="text-xl font-extrabold text-rose-400">{incorrect}</p>
            <p className="text-[11px] font-semibold text-rose-400/80 group-hover:underline">Incorrect ❌</p>
          </button>

          <button
            onClick={() => scrollToReview("SKIPPED")}
            className="bg-slate-800 hover:bg-slate-700/80 p-3 rounded-2xl border border-slate-700 transition text-center group cursor-pointer"
          >
            <p className="text-xl font-extrabold text-slate-300">{skipped}</p>
            <p className="text-[11px] font-semibold text-slate-400 group-hover:underline">Skipped ⏭️</p>
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
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl transition border border-slate-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Answer Key Breakdown with Filter Tabs */}
      <div id="review-section" className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <h2 className="text-xl font-extrabold text-white">Question Review</h2>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl text-xs font-bold flex-wrap">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                filter === "ALL"
                  ? "bg-slate-800 text-white shadow-sm font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All ({questions.length})
            </button>
            <button
              onClick={() => setFilter("INCORRECT")}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                filter === "INCORRECT"
                  ? "bg-rose-600 text-white shadow-sm font-extrabold"
                  : "text-slate-400 hover:text-rose-400"
              }`}
            >
              ❌ Incorrect ({incorrect})
            </button>
            <button
              onClick={() => setFilter("CORRECT")}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                filter === "CORRECT"
                  ? "bg-emerald-600 text-white shadow-sm font-extrabold"
                  : "text-slate-400 hover:text-emerald-400"
              }`}
            >
              ✅ Correct ({correct})
            </button>
            {skipped > 0 && (
              <button
                onClick={() => setFilter("SKIPPED")}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  filter === "SKIPPED"
                    ? "bg-slate-700 text-white shadow-sm font-extrabold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Skipped ({skipped})
              </button>
            )}
          </div>
        </div>

        {/* Filtered Question List */}
        {filteredQuestionsWithIndex.length === 0 ? (
          <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 text-center space-y-2">
            <p className="text-slate-400 font-bold">No questions match this filter.</p>
            <button
              onClick={() => setFilter("ALL")}
              className="text-xs text-blue-400 font-extrabold hover:underline cursor-pointer"
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
                className={`p-6 rounded-2xl border bg-slate-900 shadow-sm space-y-4 ${
                  isCorrect
                    ? "border-emerald-500/30"
                    : isSkipped
                    ? "border-slate-800"
                    : "border-rose-500/30 bg-rose-500/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">
                    Question #{originalIdx + 1} • {q.category}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                      isCorrect
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : isSkipped
                        ? "bg-slate-800 text-slate-400 border-slate-700"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    }`}
                  >
                    {isCorrect ? "Correct" : isSkipped ? "Skipped" : "Incorrect"}
                  </span>
                </div>

                <p className="font-bold text-white leading-relaxed">{q.prompt}</p>

                <div className="space-y-2">
                  {q.options.map((opt, optionIdx) => {
                    const isUserSelection = userChoice === optionIdx;
                    const isRightAnswer = q.answerIndex === optionIdx;

                    let optionStyle = "border-slate-800 bg-slate-950 text-slate-300";
                    if (isRightAnswer) {
                      optionStyle = "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-bold";
                    } else if (isUserSelection && !isCorrect) {
                      optionStyle = "border-rose-500/50 bg-rose-500/10 text-rose-300 font-bold";
                    }

                    return (
                      <div
                        key={optionIdx}
                        className={`p-3 rounded-xl border text-sm flex items-center justify-between ${optionStyle}`}
                      >
                        <span>{opt}</span>
                        {isRightAnswer && (
                          <span className="text-xs text-emerald-400 font-bold">✓ Correct Answer</span>
                        )}
                        {isUserSelection && !isRightAnswer && (
                          <span className="text-xs text-rose-400 font-bold">Your Answer</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation Box */}
                {q.explanation && (
                  <div className="p-3.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-xs text-blue-300 space-y-1">
                    <span className="font-extrabold uppercase text-[10px] text-blue-400 block">
                      💡 Official Explanation
                    </span>
                    <p className="leading-relaxed">{q.explanation}</p>
                  </div>
                )}

                {/* AI Tutor Integration */}
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