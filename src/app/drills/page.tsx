"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Question {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
}

export default function DrillsPage() {
  const router = useRouter();

  // Data States
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [drillQuestions, setDrillQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Phase States
  const [loading, setLoading] = useState(true);
  const [isSetup, setIsSetup] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Drill Config
  const [selectedCategory, setSelectedCategory] = useState("Verbal Ability");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes (300s)

  // Fetch Questions
  useEffect(() => {
    async function fetchQuestions() {
      try {
        const res = await fetch("/api/questions");
        const data = await res.json();
        if (res.ok && data.questions) {
          setAllQuestions(data.questions);
          const uniqueCats = Array.from(
            new Set(data.questions.map((q: Question) => q.category))
          ) as string[];
          setCategories(uniqueCats);
          if (uniqueCats.length > 0) setSelectedCategory(uniqueCats[0]);
        }
      } catch (err) {
        console.error("Failed to fetch questions for drills:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, []);

  // Submit Drill Results
  const handleSubmitDrill = useCallback(async () => {
    if (submitting || isFinished) return;
    setSubmitting(true);

    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;

    drillQuestions.forEach((q, idx) => {
      const selected = selectedAnswers[idx];
      if (selected === undefined) {
        skippedCount++;
      } else if (selected === q.answerIndex) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    });

    const totalItems = drillQuestions.length;
    const scorePercentage = totalItems > 0 ? (correctCount / totalItems) * 100 : 0;
    const finalScore = Math.round(scorePercentage);

    try {
      await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: finalScore,
          totalItems,
          correct: correctCount,
          incorrect: incorrectCount,
          skipped: skippedCount,
        }),
      });
    } catch (err) {
      console.error("Failed to submit drill score:", err);
    } finally {
      setSubmitting(false);
      setIsFinished(true);
    }
  }, [drillQuestions, selectedAnswers, submitting, isFinished]);

  // Countdown Timer
  useEffect(() => {
    if (!isSetup && !isFinished && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (!isSetup && !isFinished && timeLeft === 0) {
      handleSubmitDrill();
    }
  }, [isSetup, isFinished, timeLeft, handleSubmitDrill]);

  // Start Drill
  const handleStartDrill = () => {
    const matching = allQuestions.filter((q) => q.category === selectedCategory);
    // Shuffle and pick up to 10 questions
    const shuffled = [...matching].sort(() => 0.5 - Math.random()).slice(0, 10);

    setDrillQuestions(shuffled);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setTimeLeft(300); // 5 min timer
    setIsFinished(false);
    setIsSetup(false);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading category drill engine...
      </div>
    );
  }

  // ==========================================
  // SETUP PHASE
  // ==========================================
  if (isSetup) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 space-y-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
              ⚡ Speed Challenge
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-3">Timed Category Drill</h1>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed">
              10 rapid-fire questions under a 5-minute timer. Test your speed and precision on specific topics!
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase text-slate-700 tracking-wider">
              Select Category
            </label>
            <div className="grid grid-cols-1 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`p-4 rounded-2xl border text-left font-bold text-sm transition flex justify-between items-center ${
                    selectedCategory === cat
                      ? "border-emerald-600 bg-emerald-50/50 text-emerald-900"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <span>{cat}</span>
                  <span className="text-xs font-normal text-slate-400">
                    {allQuestions.filter((q) => q.category === cat).length} Qs available
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <Link
              href="/dashboard"
              className="w-1/3 py-3.5 text-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
            >
              Cancel
            </Link>
            <button
              onClick={handleStartDrill}
              className="w-2/3 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-sm"
            >
              Start 5-Min Drill ⚡
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RESULTS PHASE
  // ==========================================
  if (isFinished) {
    let correctCount = 0;
    drillQuestions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.answerIndex) correctCount++;
    });
    const pct = Math.round((correctCount / drillQuestions.length) * 100);

    return (
      <div className="max-w-xl mx-auto py-12 px-4 space-y-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-6">
          <div className="inline-flex p-4 bg-emerald-50 text-emerald-600 rounded-2xl text-2xl font-black">
            {pct}%
          </div>

          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Drill Completed!</h1>
            <p className="text-slate-500 text-xs mt-1">
              You scored <span className="font-bold text-slate-800">{correctCount}</span> out of{" "}
              <span className="font-bold text-slate-800">{drillQuestions.length}</span> correct in{" "}
              <span className="font-bold text-slate-800">{selectedCategory}</span>.
            </p>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => setIsSetup(true)}
              className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
            >
              Try Another Drill
            </button>
            <Link
              href="/dashboard"
              className="w-1/2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition text-center"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // DRILL ACTIVE PHASE
  // ==========================================
  const currentQ = drillQuestions[currentIndex];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Top Status Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <span className="text-[10px] font-extrabold uppercase text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md">
            {selectedCategory} Drill
          </span>
          <p className="text-xs font-bold text-slate-500 mt-1">
            Question {currentIndex + 1} of {drillQuestions.length}
          </p>
        </div>

        <div
          className={`px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1.5 border ${
            timeLeft <= 60
              ? "bg-rose-50 border-rose-200 text-rose-600 animate-pulse"
              : "bg-slate-50 border-slate-200 text-slate-700"
          }`}
        >
          <span>⏱</span>
          <span>{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-slate-800 leading-relaxed">{currentQ.prompt}</h2>

        <div className="space-y-2.5">
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedAnswers[currentIndex] === idx;
            return (
              <button
                key={idx}
                onClick={() => setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: idx }))}
                className={`w-full text-left p-4 rounded-2xl border text-sm font-medium transition flex items-center justify-between ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-50/60 text-emerald-900 font-bold"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                }`}
              >
                <span>{opt}</span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"
                  }`}
                >
                  {isSelected && <span className="text-[10px]">✓</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Nav */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition disabled:opacity-40"
          >
            Previous
          </button>

          {currentIndex < drillQuestions.length - 1 ? (
            <button
              onClick={() => setCurrentIndex((prev) => Math.min(drillQuestions.length - 1, prev + 1))}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-sm"
            >
              Next Question
            </button>
          ) : (
            <button
              onClick={handleSubmitDrill}
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Finish Drill"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}