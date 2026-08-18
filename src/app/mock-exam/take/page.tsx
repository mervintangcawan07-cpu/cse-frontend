"use client";

import { formatPromptHTML, cleanMathText } from "@/lib/formatPrompt";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import FlagQuestionButton from "@/components/exam/FlagQuestionButton";
import DatabaseLoadingIndicator from "@/components/common/DatabaseLoadingIndicator";
import ExamSubmissionLoader from "@/components/exam/ExamSubmissionLoader";

interface Question {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
  imageUrl?: string;
}

const LOCAL_STORAGE_KEY = "cse_active_exam_session";

const DEFAULT_CATEGORIES = [
  "Verbal Ability",
  "Numerical Reasoning",
  "Analytical Reasoning",
  "General Information",
  "Clerical Ability",
];

function TakeExamPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data States
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  // App State
  const [loading, setLoading] = useState(true);
  const [startingExam, setStartingExam] = useState(false);
  const [isSetupPhase, setIsSetupPhase] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [savedSessionData, setSavedSessionData] = useState<any | null>(null);

  // Configuration States
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [timerMinutes, setTimerMinutes] = useState(0); // 0 means untimed
  // Custom quiz metadata (from builder)
  const [isCustomQuiz, setIsCustomQuiz] = useState(false);
  const [customQuizLabel, setCustomQuizLabel] = useState("");
  const [timeLeft, setTimeLeft] = useState(0); // In seconds

  // Exam States
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});

  // 1. Load Initial Categories, Bookmarks & Check for In-Progress Session
  useEffect(() => {
    async function initExam() {
      try {
        const [questionsRes, bookmarkRes] = await Promise.allSettled([
          fetch("/api/questions").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/bookmarks").then((r) => (r.ok ? r.json() : null)),
        ]);

        if (questionsRes.status === "fulfilled" && questionsRes.value?.questions) {
          // Standard official CSE category normalization & deduplication
          const categoryMap = new Map<string, string>();
          questionsRes.value.questions.forEach((q: Question) => {
            const raw = q.category?.trim();
            if (raw && !raw.toLowerCase().includes("elimination drill")) {
              const lower = raw.toLowerCase();
              if (!categoryMap.has(lower)) {
                if (lower.includes("verbal")) categoryMap.set(lower, "Verbal Ability");
                else if (lower.includes("numerical")) categoryMap.set(lower, "Numerical Reasoning");
                else if (lower.includes("analytical")) categoryMap.set(lower, "Analytical Reasoning");
                else if (lower.includes("general")) categoryMap.set(lower, "General Information");
                else if (lower.includes("clerical")) categoryMap.set(lower, "Clerical Ability");
                else {
                  categoryMap.set(lower, raw.charAt(0).toUpperCase() + raw.slice(1));
                }
              }
            }
          });
          const catList = Array.from(new Set(categoryMap.values()));
          if (catList.length > 0) {
            setCategories(catList);
          }
        }

        if (bookmarkRes.status === "fulfilled" && bookmarkRes.value?.bookmarks) {
          const ids = new Set<string>(
            bookmarkRes.value.bookmarks
              .filter((b: any) => b.targetType === "QUESTION" || !b.targetType)
              .map((b: any) => b.id)
          );
          setBookmarkedIds(ids);
        }

        // Check for active unfinished exam session in local storage
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.examQuestions && parsed.examQuestions.length > 0) {
              setSavedSessionData(parsed);
            }
          } catch (e) {
            console.error("Error parsing saved exam session:", e);
          }
        }
      } catch (err) {
        console.error("Failed to initialize exam session:", err);
      } finally {
        setLoading(false);
      }
    }
    initExam();
  }, []);

  // 2. Auto-Save Active Exam State to LocalStorage
  useEffect(() => {
    if (!isSetupPhase && examQuestions.length > 0 && !submitting) {
      const activeSession = {
        examQuestions,
        selectedAnswers,
        currentIndex,
        timerMinutes,
        timeLeft,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(activeSession));
    }
  }, [isSetupPhase, examQuestions, selectedAnswers, currentIndex, timerMinutes, timeLeft, submitting]);

  // Toggle Bookmark Handler
  const toggleBookmark = async (questionId: string) => {
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: questionId, targetType: "QUESTION" }),
      });

      const data = await res.json();
      if (res.ok) {
        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          if (data.isBookmarked) {
            next.add(questionId);
          } else {
            next.delete(questionId);
          }
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to update bookmark:", err);
    }
  };

  // 3. Submit Exam & Clear Active Session
  const handleSubmitExam = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);

    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;

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

    const formattedAnswers = examQuestions.map((q, idx) => {
      const selectedIdx = selectedAnswers[idx];
      return {
        questionId: q.id,
        selectedIndex: selectedIdx !== undefined ? selectedIdx : -1,
        selectedOption: selectedIdx !== undefined ? ["A", "B", "C", "D"][selectedIdx] : "",
      };
    });

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

    const reviewData = {
      questions: examQuestions,
      selectedAnswers,
      score: finalScore,
      correct: correctCount,
      incorrect: incorrectCount,
      skipped: skippedCount,
    };
    localStorage.setItem("cse_latest_review", JSON.stringify(reviewData));

    // Clear active session from storage on exam completion
    localStorage.removeItem(LOCAL_STORAGE_KEY);

    router.push("/mock-exam/results");
  }, [examQuestions, selectedAnswers, submitting, router]);

  // Timer Logic
  useEffect(() => {
    if (!isSetupPhase && timerMinutes > 0 && !isPauseModalOpen) {
      if (timeLeft > 0) {
        const timerId = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
        return () => clearInterval(timerId);
      } else if (timeLeft === 0 && !submitting) {
        handleSubmitExam();
      }
    }
  }, [isSetupPhase, timerMinutes, timeLeft, submitting, handleSubmitExam, isPauseModalOpen]);

  // Resume Saved Session Handler
  function handleResumeSavedSession() {
    if (!savedSessionData) return;
    setExamQuestions(savedSessionData.examQuestions);
    setSelectedAnswers(savedSessionData.selectedAnswers || {});
    setCurrentIndex(savedSessionData.currentIndex || 0);
    setTimerMinutes(savedSessionData.timerMinutes || 0);
    setTimeLeft(savedSessionData.timeLeft || 0);
    setIsSetupPhase(false);
  }

  // 4. Auto-start custom quiz if URL params are present
  useEffect(() => {
    const itemCount = searchParams.get("itemCount");
    const categories = searchParams.get("categories");
    const pool = searchParams.get("pool");
    const mode = searchParams.get("mode");

    if (itemCount && categories && pool && mode) {
      setIsCustomQuiz(true);
      const modeLabel = mode === "SELF_PACED" ? "Self-Paced" : "Timed";
      setCustomQuizLabel(`${itemCount}-item ${modeLabel} Quiz`);
      // Auto-launch
      void handleStartCustomExam(itemCount, categories, pool, mode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStartCustomExam(
    itemCount: string,
    categories: string,
    pool: string,
    mode: string
  ) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setSavedSessionData(null);
    setStartingExam(true);

    const isTimed = mode === "TIMED";
    const count = parseInt(itemCount, 10) || 20;
    const mins = isTimed ? Math.ceil((count * 45) / 60) : 0;
    setTimerMinutes(mins);

    try {
      const params = new URLSearchParams({ itemCount, categories, pool, mode });
      const res = await fetch(`/api/exam/start?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.questions && data.questions.length > 0) {
        setExamQuestions(data.questions);
        setCurrentIndex(0);
        setSelectedAnswers({});
        setTimeLeft(mins * 60);
        setIsSetupPhase(false);
      } else {
        alert("Unable to generate custom quiz questions. Please try again.");
        router.push("/practice/custom");
      }
    } catch (err) {
      console.error("Error starting custom exam:", err);
      alert("Connection error starting exam.");
      router.push("/practice/custom");
    } finally {
      setStartingExam(false);
    }
  }

  // 5. Start New Smart Exam Session (Spaced Repetition Engine)
  async function handleStartExam() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setSavedSessionData(null);
    setStartingExam(true);

    try {
      const res = await fetch(
        `/api/exam/start?category=${encodeURIComponent(selectedCategory)}`
      );
      const data = await res.json();

      if (res.ok && data.questions && data.questions.length > 0) {
        setExamQuestions(data.questions);
        setCurrentIndex(0);
        setSelectedAnswers({});
        setTimeLeft(timerMinutes * 60);
        setIsSetupPhase(false);
      } else {
        alert("Unable to generate exam questions. Please try again.");
      }
    } catch (err) {
      console.error("Error starting exam:", err);
      alert("Connection error starting exam.");
    } finally {
      setStartingExam(false);
    }
  }

  function handleSelectOption(optionIndex: number) {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionIndex,
    }));
  }

  // Save for Later Handler
  function handleSaveAndExit() {
    const activeSession = {
      examQuestions,
      selectedAnswers,
      currentIndex,
      timerMinutes,
      timeLeft,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(activeSession));
    router.push("/dashboard");
  }

  // Discard & End Exam Handler
  function handleDiscardAndExit() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setExamQuestions([]);
    setSelectedAnswers({});
    setCurrentIndex(0);
    setSavedSessionData(null);
    setIsSetupPhase(true);
    setIsPauseModalOpen(false);
    router.push("/dashboard");
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
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
        <DatabaseLoadingIndicator
          title="Assembling Civil Service Mock Exam Pool..."
          subtitle="Querying official question bank, subject categories, and active study sessions."
          skeletonCount={3}
        />
      </div>
    );
  }

  // PHASE 1: SETUP SCREEN
  if (isSetupPhase) {
    return (
      <div className="w-full max-w-2xl mx-auto py-6 sm:py-10 px-2 sm:px-4 space-y-4 sm:space-y-6">
        <div className="flex justify-between items-center">
          <Link
            href="/practice"
            className="text-xs font-extrabold text-blue-400 hover:text-blue-300 transition flex items-center gap-1.5"
          >
            ← Back to Practice & Prep Hub
          </Link>
        </div>

        {savedSessionData && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 border border-amber-500/30 p-6 rounded-3xl space-y-3 shadow-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                ⏸️ Unfinished Exam Found
              </span>
            </div>
            <h2 className="text-base font-extrabold text-white">
              You have a saved exam session in progress!
            </h2>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Answered {Object.keys(savedSessionData.selectedAnswers || {}).length} of{" "}
              {savedSessionData.examQuestions?.length || 0} items.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleResumeSavedSession}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                Resume Saved Exam ⚡
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem(LOCAL_STORAGE_KEY);
                  setSavedSessionData(null);
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
              >
                Discard & Start Fresh
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 relative overflow-hidden text-slate-900">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">⏱️</span>
              <h1 className="text-2xl font-black text-slate-900">Configure Mock Exam</h1>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">
              Customize your practice session with smart non-repeating question queue.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Category
              </label>
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-blue-500 transition cursor-pointer appearance-none shadow-xs"
                >
                  <option value="All" className="bg-white text-slate-900 py-2">
                    All Categories (170 Items - Smart Repetition)
                  </option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-white text-slate-900 py-2">
                      {cat}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs font-bold">
                  ▼
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Time Limit
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Untimed", value: 0 },
                  { label: "15 Minutes", value: 15 },
                  { label: "30 Minutes", value: 30 },
                  { label: "3 Hours 10 Mins (Official)", value: 190 },
                ].map((timer) => (
                  <button
                    key={timer.value}
                    type="button"
                    onClick={() => setTimerMinutes(timer.value)}
                    className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center text-center ${
                      timerMinutes === timer.value
                        ? "border-blue-600 bg-blue-600 text-white font-black shadow-md shadow-blue-600/20"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:text-slate-900 hover:bg-slate-100 shadow-xs"
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
            disabled={startingExam}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-sm sm:text-base rounded-2xl transition shadow-lg shadow-blue-600/30 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>🚀</span>
            <span>{startingExam ? "Assembling Smart Exam Pool..." : "Start 170-Item Exam"}</span>
          </button>
        </div>
      </div>
    );
  }

  // PHASE 2: ACTIVE EXAM SCREEN
  if (examQuestions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <p className="text-slate-600 dark:text-slate-300 font-semibold">No questions available for this category.</p>
        <button onClick={() => setIsSetupPhase(true)} className="text-blue-600 font-bold hover:underline cursor-pointer">
          Go back to Setup
        </button>
      </div>
    );
  }

  const currentQ = examQuestions[currentIndex];
  const isBookmarked = currentQ ? bookmarkedIds.has(currentQ.id) : false;
  const answeredCount = Object.keys(selectedAnswers).length;
  const progressPercent = Math.round((answeredCount / examQuestions.length) * 100);

  return (
    <div className="w-full max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-4 space-y-4 sm:space-y-6">
      {/* EXAM SUBMISSION & GRADING FULLSCREEN OVERLAY */}
      <ExamSubmissionLoader isSubmitting={submitting} totalQuestions={examQuestions.length || 170} />

      {/* TOP HEADER */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-4 md:p-5 rounded-3xl shadow-lg shadow-blue-600/15 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-extrabold uppercase px-3 py-1 bg-white/20 text-white rounded-full border border-white/30 backdrop-blur-md">
            {currentQ?.category || "General"}
          </span>
          <span className="text-xs font-bold text-blue-100 hidden sm:inline">
            Item {currentIndex + 1} of {examQuestions.length} ({answeredCount} answered)
          </span>
        </div>

        <div className="flex items-center gap-3">
          {timerMinutes > 0 && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-bold text-xs ${
                timeLeft <= 180
                  ? "border-rose-400 bg-rose-500 text-white animate-pulse"
                  : "border-white/30 bg-white/20 text-white backdrop-blur-md"
              }`}
            >
              <span>⏱</span>
              <span>{formatTime(timeLeft)}</span>
            </div>
          )}

          <button
            onClick={() => setIsPauseModalOpen(true)}
            className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>⏸️</span>
            <span>Pause / Exit</span>
          </button>
        </div>
      </div>

      {/* VISUAL PROGRESS BAR */}
      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
        <div
          className="bg-blue-600 h-2 transition-all duration-300 ease-out rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* EXAM QUESTION CARD */}
      <div className="bg-white dark:bg-slate-900 shadow-xl shadow-blue-900/5 dark:shadow-none border border-slate-200/90 dark:border-slate-800 rounded-2xl border-t-4 border-t-blue-600 dark:border-t-indigo-500">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Question #{currentIndex + 1} • {currentQ?.category}
          </span>

          <div className="flex items-center gap-2">
            {currentQ && <FlagQuestionButton questionId={currentQ.id} compact />}
            <button
              onClick={() => currentQ && toggleBookmark(currentQ.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 cursor-pointer ${
                isBookmarked
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-600"
                  : "bg-slate-50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100"
              }`}
            >
              <span>{isBookmarked ? "🔖 Bookmarked" : "🔖 Bookmark"}</span>
            </button>
          </div>
        </div>

        {/* PROMPT RENDERING WITH HTML TABLE SUPPORT */}
        <div
          className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-relaxed overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: formatPromptHTML(currentQ?.prompt || "") }}
        />

        {/* CHART / GRAPH IMAGE DISPLAY */}
        {currentQ?.imageUrl && (
          <div className="my-4 flex justify-center bg-slate-50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <img
              src={currentQ.imageUrl}
              alt="Question Diagram or Chart"
              className="max-h-64 object-contain rounded-xl shadow-sm"
            />
          </div>
        )}

        <div className="space-y-3">
          {currentQ?.options.map((opt, idx) => {
            const isSelected = selectedAnswers[currentIndex] === idx;
            return (
              <button
                key={idx}
                onClick={() => handleSelectOption(idx)}
                className={`w-full text-left p-4 rounded-2xl border text-sm font-medium transition flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/50 text-blue-900 font-bold"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 bg-slate-50/50"
                }`}
              >
                <span>{cleanMathText(opt)}</span>
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
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>

          {currentIndex < examQuestions.length - 1 ? (
            <button
              onClick={() => setCurrentIndex((prev) => Math.min(examQuestions.length - 1, prev + 1))}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition shadow-sm cursor-pointer"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmitExam}
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Submitting..." : "Submit Exam"}
            </button>
          )}
        </div>
      </div>

      {/* PAUSE / EXIT MODAL OVERLAY */}
      {isPauseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 shadow-xl shadow-blue-900/5 dark:shadow-none border border-slate-200/90 dark:border-slate-800 rounded-2xl border-t-4 border-t-blue-600 dark:border-t-indigo-500">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-2xl mx-auto">
                ⏸️
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Pause or Exit Exam?
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Your exam timer is currently paused. What would you like to do?
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleSaveAndExit}
                className="w-full p-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-2xl transition shadow-md flex items-center justify-between cursor-pointer"
              >
                <div className="text-left">
                  <p className="font-extrabold">💾 Save & Exit for Later</p>
                  <p className="text-[11px] text-blue-100 font-normal">
                    Save current answers & timer. Resume from Dashboard anytime.
                  </p>
                </div>
                <span>→</span>
              </button>

              <button
                onClick={handleDiscardAndExit}
                className="w-full p-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-sm rounded-2xl transition flex items-center justify-between cursor-pointer"
              >
                <div className="text-left">
                  <p className="font-extrabold">🛑 Discard & Exit</p>
                  <p className="text-[11px] text-rose-500 font-normal">
                    Clear progress and return to dashboard.
                  </p>
                </div>
                <span>→</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                onClick={() => setIsPauseModalOpen(false)}
                className="px-5 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                ← Resume Exam Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TakeExamPage() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Preparing your exam...
      </div>
    }>
      <TakeExamPageInner />
    </Suspense>
  );
}