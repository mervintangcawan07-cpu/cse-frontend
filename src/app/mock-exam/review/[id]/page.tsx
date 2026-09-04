"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuestionReview from "@/components/question/QuestionReview";
import ExplainMistakeButton from "@/components/ExplainMistakeButton";
import { StructuredQuestion } from "@/types/question";

interface ReviewItem {
  id: string;
  userAnswerIndex?: number | null;
  isCorrect: boolean;
  isSkipped?: boolean;
  question: StructuredQuestion;
}

export default function ExamReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [attempt, setAttempt] = useState<any | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "INCORRECT" | "CORRECT" | "SKIPPED">("ALL");

  useEffect(() => {
    async function loadReview() {
      try {
        const res = await fetch(`/api/mock-exam/history/${resolvedParams.id}`);
        const data = await res.json();

        if (res.ok && data.attempt) {
          const att = data.attempt;
          setAttempt(att);

          const parsedItems: ReviewItem[] = [];

          if (Array.isArray(att.details) && att.details.length > 0) {
            att.details.forEach((det: any, idx: number) => {
              const q: StructuredQuestion = {
                id: det.id || String(idx),
                category: det.category || "General",
                subtopic: det.subtopic || "General",
                prompt: det.prompt || "",
                options: det.options || [],
                answerIndex: det.answerIndex ?? 0,
                explanation: det.explanation || null,
                imageUrl: det.imageUrl || null,
                stepByStep: det.stepByStep || null,
                whyA: det.whyA || null,
                whyB: det.whyB || null,
                whyC: det.whyC || null,
                whyD: det.whyD || null,
                eliminationStrategy: det.eliminationStrategy || null,
                commonTrap: det.commonTrap || null,
                examTip: det.examTip || null,
                difficulty: det.difficulty || "MEDIUM",
                tags: det.tags || [],
              };

              const userChoice =
                det.selectedIndex !== undefined && det.selectedIndex !== null
                  ? det.selectedIndex
                  : null;
              const isCorrect = userChoice === q.answerIndex;
              const isSkipped = userChoice === null;

              parsedItems.push({
                id: det.id || String(idx),
                userAnswerIndex: userChoice,
                isCorrect,
                isSkipped,
                question: q,
              });
            });
          } else if (Array.isArray(att.answers) && att.answers.length > 0) {
            att.answers.forEach((ans: any, idx: number) => {
              const q = ans.question || {};
              const formattedQ: StructuredQuestion = {
                id: q.id || String(idx),
                category: q.category || "General",
                subtopic: q.subtopic || "General",
                prompt: q.prompt || "",
                options: q.options || [],
                answerIndex: q.answerIndex ?? 0,
                explanation: q.explanation || null,
                imageUrl: q.imageUrl || null,
                stepByStep: q.stepByStep || null,
                whyA: q.whyA || null,
                whyB: q.whyB || null,
                whyC: q.whyC || null,
                whyD: q.whyD || null,
                eliminationStrategy: q.eliminationStrategy || null,
                commonTrap: q.commonTrap || null,
                examTip: q.examTip || null,
                difficulty: q.difficulty || "MEDIUM",
                tags: q.tags || [],
              };

              parsedItems.push({
                id: ans.id || String(idx),
                userAnswerIndex: ans.userAnswerIndex ?? null,
                isCorrect: Boolean(ans.isCorrect),
                isSkipped: ans.userAnswerIndex === null || ans.userAnswerIndex === undefined,
                question: formattedQ,
              });
            });
          }

          setItems(parsedItems);
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
      <div className="w-full py-24 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="font-extrabold text-slate-700 dark:text-slate-300">
          Loading detailed exam review answers and explanations...
        </p>
      </div>
    );
  }

  if (!attempt) return null;

  const correctCount = items.filter((a) => a.isCorrect).length;
  const skippedCount = items.filter((a) => a.isSkipped).length;
  const incorrectCount = items.length - correctCount - skippedCount;

  const filteredItems = items.filter((item) => {
    if (filter === "CORRECT") return item.isCorrect;
    if (filter === "INCORRECT") return !item.isCorrect && !item.isSkipped;
    if (filter === "SKIPPED") return item.isSkipped;
    return true;
  });

  return (
    <div className="w-full px-2 py-3.5 sm:px-4 sm:py-6 md:px-6 lg:px-8 space-y-4 sm:space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full border border-blue-500/20">
            Diagnostic Review Mode
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2">
            Detailed Exam Rationalization
          </h1>
          <p className="text-xs text-slate-500 mt-1">
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
            <span className="text-3xl font-black text-blue-600 dark:text-amber-400">
              {attempt.percentage}%
            </span>
            <span className="text-[10px] font-bold text-slate-500 block">
              {correctCount} / {items.length} Correct
            </span>
          </div>
          <Link
            href="/mock-exam/history"
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold rounded-xl transition border border-slate-200 dark:border-slate-700"
          >
            ← Exam History
          </Link>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-wrap items-center justify-between bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 gap-1.5 text-xs font-bold">
        <button
          onClick={() => setFilter("ALL")}
          className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
            filter === "ALL"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          All Items ({items.length})
        </button>
        <button
          onClick={() => setFilter("INCORRECT")}
          className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
            filter === "INCORRECT"
              ? "bg-rose-600 text-white shadow-xs font-black"
              : "text-slate-500 hover:text-rose-600"
          }`}
        >
          ❌ Incorrect ({incorrectCount})
        </button>
        <button
          onClick={() => setFilter("CORRECT")}
          className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
            filter === "CORRECT"
              ? "bg-emerald-600 text-white shadow-xs font-black"
              : "text-slate-500 hover:text-emerald-600"
          }`}
        >
          ✅ Correct ({correctCount})
        </button>
        {skippedCount > 0 && (
          <button
            onClick={() => setFilter("SKIPPED")}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
              filter === "SKIPPED"
                ? "bg-slate-900 text-white shadow-xs font-black"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Skipped ({skippedCount})
          </button>
        )}
      </div>

      {/* REUSABLE QUESTION REVIEW LIST */}
      <div className="space-y-6">
        {filteredItems.map((item, idx) => {
          const q = item.question;
          const userChoice = item.userAnswerIndex;

          return (
            <QuestionReview
              key={item.id || idx}
              question={q}
              userAnswerIndex={userChoice}
              itemNumber={idx + 1}
              mode="REVIEW"
              isSkipped={item.isSkipped}
              actions={
                !item.isCorrect && !item.isSkipped && userChoice !== null && userChoice !== undefined ? (
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
        })}
      </div>
    </div>
  );
}