"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Question {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

interface UserAnswer {
  id: string;
  userAnswerIndex: number;
  isCorrect: boolean;
  question: Question;
}

interface ExamAttempt {
  id: string;
  score: number;
  totalItems: number;
  percentage: number;
  createdAt: string;
  answers: UserAnswer[];
}

export default function ExamReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "INCORRECT" | "CORRECT">("ALL");

  useEffect(() => {
    async function loadReview() {
      try {
        const res = await fetch(`/api/mock-exam/history/${resolvedParams.id}`);
        const data = await res.json();

        if (res.ok && data.attempt) {
          setAttempt(data.attempt);
        } else {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Failed to fetch review data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadReview();
  }, [resolvedParams.id, router]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading exam review answers and explanations...
      </div>
    );
  }

  if (!attempt) return null;

  const filteredAnswers = attempt.answers.filter((ans) => {
    if (filter === "CORRECT") return ans.isCorrect;
    if (filter === "INCORRECT") return !ans.isCorrect;
    return true;
  });

  const correctCount = attempt.answers.filter((a) => a.isCorrect).length;
  const incorrectCount = attempt.answers.length - correctCount;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6 text-slate-100">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
            Exam Review Mode
          </span>
          <h1 className="text-2xl font-black text-white mt-2">
            Detailed Diagnostic Review
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Exam Taken:{" "}
            {new Date(attempt.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-2xl font-black text-amber-400">
              {attempt.percentage}%
            </span>
            <span className="text-[10px] font-bold text-slate-400 block">
              {correctCount} / {attempt.totalItems} Correct
            </span>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-2 gap-2 text-xs font-bold">
        <button
          onClick={() => setFilter("ALL")}
          className={`flex-1 py-2.5 rounded-xl transition ${
            filter === "ALL"
              ? "bg-blue-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          All Items ({attempt.answers.length})
        </button>
        <button
          onClick={() => setFilter("INCORRECT")}
          className={`flex-1 py-2.5 rounded-xl transition ${
            filter === "INCORRECT"
              ? "bg-red-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          ❌ Incorrect ({incorrectCount})
        </button>
        <button
          onClick={() => setFilter("CORRECT")}
          className={`flex-1 py-2.5 rounded-xl transition ${
            filter === "CORRECT"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          ✅ Correct ({correctCount})
        </button>
      </div>

      {/* QUESTION REVIEW CARDS */}
      <div className="space-y-4">
        {filteredAnswers.map((ans, idx) => {
          const q = ans.question;

          return (
            <div
              key={ans.id}
              className={`p-6 rounded-3xl border transition ${
                ans.isCorrect
                  ? "bg-slate-900/80 border-slate-800"
                  : "bg-slate-900/90 border-red-500/30"
              }`}
            >
              <div className="flex justify-between items-start gap-4 mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg border border-slate-700">
                  Item #{idx + 1} • {q.category}
                </span>
                <span
                  className={`text-xs font-black px-3 py-1 rounded-full border ${
                    ans.isCorrect
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-red-500/10 text-red-400 border-red-500/30"
                  }`}
                >
                  {ans.isCorrect ? "✅ Correct" : "❌ Incorrect"}
                </span>
              </div>

              {/* Prompt */}
              <h3 className="text-sm font-extrabold text-white mb-4 leading-relaxed">
                {q.prompt}
              </h3>

              {/* Options */}
              <div className="space-y-2 mb-4">
                {q.options.map((opt, optIdx) => {
                  const isUserSelection = ans.userAnswerIndex === optIdx;
                  const isCorrectAnswer = q.answerIndex === optIdx;

                  let optionStyle =
                    "bg-slate-950 border-slate-800 text-slate-400";
                  if (isCorrectAnswer) {
                    optionStyle =
                      "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold";
                  } else if (isUserSelection && !ans.isCorrect) {
                    optionStyle =
                      "bg-red-500/10 border-red-500/40 text-red-300 font-bold";
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`p-3.5 rounded-xl border text-xs flex justify-between items-center ${optionStyle}`}
                    >
                      <span>
                        <strong className="mr-2 uppercase">
                          {String.fromCharCode(65 + optIdx)}.
                        </strong>
                        {opt}
                      </span>
                      {isCorrectAnswer && (
                        <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400">
                          Correct Answer
                        </span>
                      )}
                      {isUserSelection && !isCorrectAnswer && (
                        <span className="text-[10px] uppercase font-black tracking-wider text-red-400">
                          Your Choice
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation Box */}
              {q.explanation && (
                <div className="p-4 rounded-2xl bg-blue-600/10 border border-blue-500/30 space-y-1">
                  <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider block">
                    💡 Solution & Explanation
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {q.explanation}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}