"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { prepareShuffledExam, QuestionItem } from "@/lib/quizUtils";

interface Question {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
}

export default function TakeExamPage() {
  const router = useRouter();

  // Data States
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // App State
  const [loading, setLoading] = useState(true);
  const [isSetupPhase, setIsSetupPhase] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Configuration States
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [timerMinutes, setTimerMinutes] = useState(0); // 0 means untimed
  const [timeLeft, setTimeLeft] = useState(0); // In seconds

  // Exam States
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});

  useEffect(() => {
    async function loadQuestions() {
      try {
        const res = await fetch("/api/questions");
        const data = await res.json();
        if (res.ok && data.questions) {
          setAllQuestions(data.questions);
          // Automatically extract unique categories from the database questions
          const uniqueCategories = Array.from(
            new Set(data.questions.map((q: Question) => q.category))
          ) as string[];
          setCategories(uniqueCategories);
        }
      } catch (err) {
        console.error("Failed to load questions:", err);
      } finally {
        setLoading(false);
      }
    }
    loadQuestions();
  }, []);

  // Secure Submit Logic
  const handleSubmitExam = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);

    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;

    // Calculate client-side totals for immediate local review display
    examQuestions.forEach((q, idx) => {
      const selected = selectedAnswers[idx];
      if (selected === undefined) {
        skippedCount++;
      } else if (selected === q.answerIndex) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    });

    const totalItems = examQuestions.length;
    const scorePercentage = totalItems > 0 ? (correctCount / totalItems) * 100 : 0;
    const finalScore = Math.round(scorePercentage);

    // Format selected answers array for tamper-proof server verification
    const formattedAnswers = examQuestions.map((q, idx) => {
      const selectedIdx = selectedAnswers[idx];
      const optionLetter = selectedIdx !== undefined ? ["A", "B", "C", "D"][selectedIdx] : "";
      const optionText = selectedIdx !== undefined ? q.options[selectedIdx] : "";

      return {
        questionId: q.id,
        selectedOption: optionLetter || optionText || "",
      };
    });

    // Send formatted answers to API for server-side grading and DB recording
    try {
      await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalItems,
          answers: formattedAnswers,
        }),
      });
    } catch (err) {
      console.error("Error submitting result:", err);
    }

    // Save review data locally for the results screen
    const reviewData = {
      questions: examQuestions,
      selectedAnswers,
      score: finalScore,
      correct: correctCount,
      incorrect: incorrectCount,
      skipped: skippedCount,
    };
    localStorage.setItem("cse_latest_review", JSON.stringify(reviewData));

    router.push("/mock-exam/results");
  }, [examQuestions, selectedAnswers, submitting, router]);

  // Timer Logic
  useEffect(() => {
    if (!isSetupPhase && timerMinutes > 0) {
      if (timeLeft > 0) {
        const timerId = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
        return () => clearInterval(timerId);
      } else if (timeLeft === 0 && !submitting) {
        handleSubmitExam();
      }
    }
  }, [isSetupPhase, timerMinutes, timeLeft, submitting, handleSubmitExam]);

  function handleStartExam() {
    // Filter questions based on selected category
    const filtered =
      selectedCategory === "All"
        ? allQuestions
        : allQuestions.filter((q) => q.category === selectedCategory);

    // Shuffle question order AND option placements dynamically
    const preparedQuestions = prepareShuffledExam(filtered as QuestionItem[]) as Question[];

    setExamQuestions(preparedQuestions);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setTimeLeft(timerMinutes * 60);
    setIsSetupPhase(false);
  }

  function handleSelectOption(optionIndex: number) {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionIndex,
    }));
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <p className="text-slate-500 font-medium animate-pulse">Loading exam configurations...</p>
      </div>
    );
  }

  if (allQuestions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <p className="text-slate-600 font-semibold">No questions found in the database.</p>
        <p className="text-slate-400 text-sm">Please make sure you have run the seed script.</p>
      </div>
    );
  }

  // ==========================================
  // PHASE 1: SETUP SCREEN
  // ==========================================
  if (isSetupPhase) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 space-y-8">
        <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-200 shadow-sm space-y-8">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Configure Mock Exam</h1>
            <p className="text-slate-500 text-sm mt-1">Customize your practice session before you begin.</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">
                Select Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 text-slate-800 font-medium outline-none focus:border-blue-500 focus:bg-white transition"
              >
                <option value="All">All Categories (Comprehensive Exam)</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">
                Time Limit
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Untimed", value: 0 },
                  { label: "5 Minutes", value: 5 },
                  { label: "15 Minutes", value: 15 },
                  { label: "30 Minutes", value: 30 },
                ].map((timer) => (
                  <button
                    key={timer.value}
                    onClick={() => setTimerMinutes(timer.value)}
                    className={`p-3 rounded-xl border text-sm font-bold transition ${
                      timerMinutes === timer.value
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {timer.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleStartExam}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg rounded-2xl transition shadow-sm"
          >
            Start Exam Now (Shuffled Mode) 🔀
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // PHASE 2: EXAM SCREEN
  // ==========================================
  if (examQuestions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <p className="text-slate-600 font-semibold">No questions available for this category.</p>
        <button onClick={() => setIsSetupPhase(true)} className="text-blue-600 font-bold hover:underline">
          Go back to Setup
        </button>
      </div>
    );
  }

  const currentQ = examQuestions[currentIndex];

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            {currentQ.category}
          </span>
          <span className="text-sm font-semibold text-slate-500">
            {currentIndex + 1} / {examQuestions.length}
          </span>
        </div>

        {timerMinutes > 0 && (
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full border font-bold text-sm ${
              timeLeft <= 60
                ? "border-rose-200 bg-rose-50 text-rose-600 animate-pulse"
                : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            <span>⏱</span>
            <span>{formatTime(timeLeft)}</span>
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h2 className="text-lg font-bold text-slate-800 leading-relaxed">{currentQ.prompt}</h2>

        <div className="space-y-3">
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedAnswers[currentIndex] === idx;
            return (
              <button
                key={idx}
                onClick={() => handleSelectOption(idx)}
                className={`w-full text-left p-4 rounded-2xl border text-sm font-medium transition flex items-center justify-between ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/50 text-blue-900 font-bold"
                    : "border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50"
                }`}
              >
                <span>{opt}</span>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                  }`}
                >
                  {isSelected && <span className="text-xs">✓</span>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition disabled:opacity-40"
          >
            Previous
          </button>

          {currentIndex < examQuestions.length - 1 ? (
            <button
              onClick={() => setCurrentIndex((prev) => Math.min(examQuestions.length - 1, prev + 1))}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition shadow-sm"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmitExam}
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Exam"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}