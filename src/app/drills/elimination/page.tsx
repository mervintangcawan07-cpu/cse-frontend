"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface DrillQuestion {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
}

export default function EliminationTrainerPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<DrillQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [eliminatedIndices, setEliminatedIndices] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(10);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initDrill() {
      try {
        const res = await fetch("/api/auth/me");
        const userData = await res.json();

        if (!userData.user?.isPaid && userData.user?.role !== "ADMIN") {
          router.push("/dashboard");
          return;
        }

        const sampleSet: DrillQuestion[] = [
          {
            id: "1",
            category: "Numerical Reasoning",
            prompt: "Find 15% of 300.",
            options: ["A. 45", "B. 3,000", "C. -15", "D. 90"],
            answerIndex: 0,
          },
          {
            id: "2",
            category: "Verbal Ability",
            prompt: "Which word is an antonym for 'BENEVOLENT'?",
            options: ["A. Kind", "B. Malevolent", "C. Generous", "D. Helpful"],
            answerIndex: 1,
          },
        ];

        setQuestions(sampleSet);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    initDrill();
  }, [router]);

  useEffect(() => {
    if (isFinished || loading || questions.length === 0) return;

    if (timeLeft === 0) {
      handleNextQuestion();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isFinished, loading, questions]);

  const handleToggleEliminate = (index: number) => {
    if (eliminatedIndices.includes(index)) {
      setEliminatedIndices(eliminatedIndices.filter((i) => i !== index));
    } else {
      if (eliminatedIndices.length < 2) {
        const nextIndices = [...eliminatedIndices, index];
        setEliminatedIndices(nextIndices);

        if (nextIndices.length === 2) {
          const currentQ = questions[currentIndex];
          const struckCorrect = nextIndices.includes(currentQ.answerIndex);

          if (!struckCorrect) {
            setScore((prev) => prev + 1);
          }
        }
      }
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setEliminatedIndices([]);
      setTimeLeft(10);
    } else {
      setIsFinished(true);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading 10-Sec Elimination Trainer...
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md">
        <div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
            Speed Strategy Drill
          </span>
          <h1 className="text-xl font-black mt-1">Option Elimination Trainer</h1>
          <p className="text-xs text-slate-400">Strike out 2 obviously wrong choices in under 10 seconds!</p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-2xl font-black text-amber-400">{timeLeft}s</span>
          <span className="block text-[10px] text-slate-400 uppercase font-bold">Time Left</span>
        </div>
      </div>

      {!isFinished && currentQ ? (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-500">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-xs font-black text-blue-600 uppercase">{currentQ.category}</span>
          </div>

          <h2 className="text-lg font-black text-slate-900">{currentQ.prompt}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentQ.options.map((opt, idx) => {
              const isEliminated = eliminatedIndices.includes(idx);

              return (
                <button
                  key={idx}
                  onClick={() => handleToggleEliminate(idx)}
                  className={`p-4 rounded-2xl font-bold text-xs text-left transition border flex items-center justify-between ${
                    isEliminated
                      ? "bg-red-50 border-red-300 text-red-500 line-through opacity-60"
                      : "bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-400"
                  }`}
                >
                  <span>{opt}</span>
                  {isEliminated && <span className="text-red-600 font-black text-sm">✕</span>}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-xs font-bold text-slate-500">
              Eliminated: <strong className="text-slate-900">{eliminatedIndices.length}/2</strong>
            </span>

            <button
              onClick={handleNextQuestion}
              disabled={eliminatedIndices.length < 2 && timeLeft > 0}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition disabled:opacity-40"
            >
              Next Question &rarr;
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 text-white p-8 rounded-3xl text-center space-y-4 border border-slate-800">
          <h2 className="text-2xl font-black text-amber-400">Drill Completed! 🎉</h2>
          <p className="text-sm text-slate-300">
            You successfully eliminated choices on <strong className="text-white">{score}</strong> out of{" "}
            {questions.length} questions.
          </p>
          <div className="pt-2">
            <Link
              href="/drills"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              Return to Drills Hub
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}