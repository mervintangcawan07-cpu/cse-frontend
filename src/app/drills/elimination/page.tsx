"use client";

import { formatPromptHTML } from "@/lib/formatPrompt";
import { cleanMathText } from "@/lib/sanitizeMath";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getOfflineDrillById } from "@/lib/offline-storage";

interface DrillQuestion {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  eliminationNotes?: { [optionIndex: number]: string };
}

interface QuestionRecord {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  eliminatedIndices: number[];
  struckCorrect: boolean;
}

const SAMPLE_QUESTIONS: DrillQuestion[] = [
  {
    id: "1",
    category: "Numerical Reasoning",
    prompt: "What is 15% of 300?",
    options: ["A. 45", "B. 3,000", "C. -15", "D. 90"],
    answerIndex: 0,
    explanation: "15% of 300 = 0.15 × 300 = 45.",
    eliminationNotes: {
      1: "3,000 is larger than 300. A percentage less than 100% cannot be larger than the original number.",
      2: "-15 is negative. Taking a positive percentage of a positive number yields a positive result.",
      3: "90 is 30% of 300 (double the requested 15%).",
    },
  },
  {
    id: "2",
    category: "Verbal Ability",
    prompt: "Which word is an antonym for 'BENEVOLENT'?",
    options: ["A. Kind", "B. Malevolent", "C. Generous", "D. Helpful"],
    answerIndex: 1,
    explanation: "'Benevolent' means well-meaning and kindly. 'Malevolent' means wishing to do evil.",
    eliminationNotes: {
      0: "'Kind' is a synonym, not an antonym.",
      2: "'Generous' is a positive attribute aligned with benevolent.",
      3: "'Helpful' is another positive synonym.",
    },
  },
];

const STORAGE_SEEN_KEY = "cse_elimination_seen_ids";
const STORAGE_CURRENT_SESSION = "cse_elimination_active_session";

export default function EliminationTrainerPage() {
  const [questions, setQuestions] = useState<DrillQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [eliminatedIndices, setEliminatedIndices] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<QuestionRecord[]>([]);

  // 🔄 Load drill questions from browser cache or single API request
  useEffect(() => {
    loadDrillSession();
  }, []);

  const loadDrillSession = async (forceNew = false) => {
    setLoading(true);
    setIsFinished(false);
    setCurrentIndex(0);
    setEliminatedIndices([]);
    setIsRevealed(false);
    setScore(0);
    setHistory([]);

    // 1. Check browser cache (sessionStorage) for an active session
    if (!forceNew) {
      const cachedSession = sessionStorage.getItem(STORAGE_CURRENT_SESSION);
      if (cachedSession) {
        try {
          const parsed = JSON.parse(cachedSession);
          if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            setQuestions(parsed.questions);
            setLoading(false);
            return;
          }
        } catch {
          sessionStorage.removeItem(STORAGE_CURRENT_SESSION);
        }
      }
    }

    // 2. Fetch new 10-item set from API passing seen IDs
    try {
      const seenRaw = localStorage.getItem(STORAGE_SEEN_KEY) || "";
      const res = await fetch(`/api/drills/elimination?seenIds=${encodeURIComponent(seenRaw)}`);
      const data = await res.json();

      if (res.ok && data.drills && data.drills.length > 0) {
        if (data.loopReset) {
          localStorage.removeItem(STORAGE_SEEN_KEY);
        }

        const dbQuestions: DrillQuestion[] = data.drills.map((item: any, idx: number) => {
          const rawOptions: string[] = Array.isArray(item.options) ? item.options : [];

          const formattedOptions = rawOptions.map((opt: string, oIdx: number) => {
            const prefix = `${String.fromCharCode(65 + oIdx)}. `;
            return opt.startsWith("A. ") || opt.startsWith("B. ") || opt.startsWith("C. ") || opt.startsWith("D. ")
              ? opt
              : `${prefix}${opt}`;
          });

          return {
            id: item.id || String(idx + 1),
            category: item.category || "General Ability",
            prompt: item.prompt,
            options: formattedOptions,
            answerIndex: typeof item.answerIndex === "number" ? item.answerIndex : 0,
            explanation: item.explanation || "No detailed explanation provided.",
            eliminationNotes: item.eliminationNotes || {
              0: "Incorrect distractor option.",
              1: "Incorrect distractor option.",
              2: "Incorrect distractor option.",
              3: "Incorrect distractor option.",
            },
          };
        });

        setQuestions(dbQuestions);

        // Cache 10-item session in sessionStorage
        sessionStorage.setItem(
          STORAGE_CURRENT_SESSION,
          JSON.stringify({ questions: dbQuestions })
        );
      } else {
        setQuestions(SAMPLE_QUESTIONS);
      }
    } catch (err) {
      console.error("Failed to load drill questions from API, trying offline cache:", err);
      // 🔌 Offline Fallback: load from IndexedDB if available
      try {
        const offlineDrill = await getOfflineDrillById("elimination_trainer");
        if (offlineDrill && Array.isArray(offlineDrill.questions) && offlineDrill.questions.length > 0) {
          const offlineQuestions: DrillQuestion[] = offlineDrill.questions.map((item: any, idx: number) => {
            const rawOptions: string[] = Array.isArray(item.options) ? item.options : [];
            const formattedOptions = rawOptions.map((opt: string, oIdx: number) => {
              const prefix = `${String.fromCharCode(65 + oIdx)}. `;
              return opt.startsWith("A. ") || opt.startsWith("B. ") || opt.startsWith("C. ") || opt.startsWith("D. ")
                ? opt
                : `${prefix}${opt}`;
            });
            return {
              id: item.id || String(idx + 1),
              category: item.category || "General Ability",
              prompt: item.prompt,
              options: formattedOptions,
              answerIndex: typeof item.answerIndex === "number" ? item.answerIndex : 0,
              explanation: item.explanation || "No detailed explanation provided.",
              eliminationNotes: item.eliminationNotes || {},
            };
          });
          setQuestions(offlineQuestions);
        } else {
          setQuestions(SAMPLE_QUESTIONS);
        }
      } catch {
        setQuestions(SAMPLE_QUESTIONS);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEliminate = (index: number) => {
    if (isRevealed) return;

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
          setIsRevealed(true);
        }
      }
    }
  };

  const handleRevealEarly = () => {
    if (isRevealed) return;
    const currentQ = questions[currentIndex];
    const struckCorrect = eliminatedIndices.includes(currentQ.answerIndex);

    if (eliminatedIndices.length === 2 && !struckCorrect) {
      setScore((prev) => prev + 1);
    }
    setIsRevealed(true);
  };

  // 🚀 Local State Navigation: ZERO DB calls on "Next Question"
  const handleNextQuestion = () => {
    const currentQ = questions[currentIndex];
    const struckCorrect = eliminatedIndices.includes(currentQ.answerIndex);

    const record: QuestionRecord = {
      id: currentQ.id,
      category: currentQ.category,
      prompt: currentQ.prompt,
      options: currentQ.options,
      answerIndex: currentQ.answerIndex,
      explanation: currentQ.explanation,
      eliminatedIndices: [...eliminatedIndices],
      struckCorrect,
    };

    const nextHistory = [...history, record];
    setHistory(nextHistory);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setEliminatedIndices([]);
      setIsRevealed(false);
    } else {
      finishDrill();
    }
  };

  const finishDrill = () => {
    setIsFinished(true);

    // Save completed IDs to localStorage for loop-prevention
    const currentSeenRaw = localStorage.getItem(STORAGE_SEEN_KEY) || "";
    const existingSeenIds = new Set(currentSeenRaw.split(",").filter(Boolean));
    questions.forEach((q) => existingSeenIds.add(q.id));

    localStorage.setItem(STORAGE_SEEN_KEY, Array.from(existingSeenIds).join(","));
    sessionStorage.removeItem(STORAGE_CURRENT_SESSION);
  };

  if (loading) {
    return (
      <div className="w-full py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading Elimination Trainer & Question Bank...
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const currentStruckCorrect = currentQ ? eliminatedIndices.includes(currentQ.answerIndex) : false;
  const accuracyPercent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <div className="w-full max-w-5xl mx-auto py-3 sm:py-6 px-2 sm:px-4 md:px-6 space-y-4 sm:space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-900 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
              Option Elimination Trainer
            </span>
            {!isFinished && questions.length > 0 && (
              <span className="text-xs text-slate-400 font-bold">
                Question {currentIndex + 1} of {questions.length}
              </span>
            )}
          </div>
          <h1 className="text-xl font-black mt-1.5">Option Elimination Trainer</h1>
          <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-xl bg-amber-500/15 px-3.5 py-2.5 border border-amber-500/30 text-amber-200 text-xs sm:text-sm font-medium shadow-sm">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950">
              🎯 DRILL GOAL
            </span>
            <span>
              Click to <strong className="text-amber-300 font-extrabold underline decoration-amber-400 decoration-2 underline-offset-2">strike out 2 WRONG choices</strong>. <span className="text-amber-100 font-semibold">(Do NOT pick the correct answer!)</span>
            </span>
          </div>
        </div>

        {/* Live Score Pill during drill */}
        {!isFinished && questions.length > 0 && (
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-6 shrink-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Drill Score</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-amber-400">{score}</span>
              <span className="text-xs font-bold text-slate-400">/ {currentIndex + (isRevealed ? 1 : 0)}</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold mt-0.5">
              {currentIndex + (isRevealed ? 1 : 0) > 0
                ? `${Math.round((score / (currentIndex + (isRevealed ? 1 : 0))) * 100)}% Safe Rate`
                : "Starts at Q1"}
            </span>
          </div>
        )}
      </div>

      {!isFinished && currentQ ? (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-500">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-xs font-black text-blue-600 uppercase">{currentQ.category}</span>
          </div>

          <div className="text-lg font-black text-slate-900" dangerouslySetInnerHTML={{ __html: formatPromptHTML(currentQ.prompt) }} />

          {/* Option Choices Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentQ.options.map((opt, idx) => {
              const isEliminated = eliminatedIndices.includes(idx);
              const isCorrectAnswer = idx === currentQ.answerIndex;

              let cardStyle = "bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-400";

              if (isEliminated) {
                cardStyle = "bg-red-50 border-red-300 text-red-500 line-through opacity-70";
              }

              if (isRevealed) {
                if (isCorrectAnswer) {
                  cardStyle = "bg-emerald-50 border-emerald-400 text-emerald-900 font-extrabold ring-2 ring-emerald-500/20";
                } else if (isEliminated) {
                  cardStyle = "bg-red-50 border-red-300 text-red-600 line-through opacity-80";
                } else {
                  cardStyle = "bg-slate-50 border-slate-200 text-slate-400 opacity-50";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleToggleEliminate(idx)}
                  disabled={isRevealed}
                  className={`p-4 rounded-2xl font-bold text-xs text-left transition border flex items-center justify-between ${cardStyle}`}
                >
                  <span>{opt}</span>
                  {isEliminated && !isRevealed && <span className="text-red-600 font-black text-sm">✕</span>}
                  {isRevealed && isCorrectAnswer && (
                    <span className="text-xs font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md shrink-0">
                      ✓ Correct Choice
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 💡 IMMEDIATE ELIMINATION & ANSWER REVIEW BOX */}
          {isRevealed && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Immediate Per-Question Scoring Feedback Alert */}
              {currentStruckCorrect ? (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 space-y-1">
                  <div className="flex items-center gap-2 font-black text-sm text-rose-700">
                    <span className="text-base">❌</span>
                    <span>Score +0: Struck Out the Correct Answer!</span>
                  </div>
                  <p className="text-xs text-rose-800 leading-relaxed font-medium">
                    You eliminated <strong>{cleanMathText(currentQ.options[currentQ.answerIndex] || "")}</strong>, which was the correct answer. In this drill, always strike out <em>wrong options (distractors)</em> to keep the correct answer safe!
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 space-y-1">
                  <div className="flex items-center gap-2 font-black text-sm text-emerald-700">
                    <span className="text-base">✅</span>
                    <span>Score +1: Safe Elimination!</span>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                    Great test instinct! You successfully avoided striking out the correct answer (<strong>{cleanMathText(currentQ.options[currentQ.answerIndex] || "")}</strong>) and discarded wrong distractors.
                  </p>
                </div>
              )}

              {/* Strategy Breakdown Card */}
              <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-4 border border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                    <span>💡</span> Elimination Strategy Breakdown
                  </span>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 break-words max-w-full sm:max-w-[65%]">
                    Correct Answer: {cleanMathText(currentQ.options[currentQ.answerIndex] || "")}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-medium whitespace-pre-line">
                  <strong className="text-white">Overall Explanation: </strong>
                  {currentQ.explanation}
                </p>
              </div>
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs font-bold text-slate-500">
              Eliminated: <strong className="text-slate-900">{eliminatedIndices.length}/2</strong>
            </span>

            {isRevealed ? (
              <button
                onClick={handleNextQuestion}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                {currentIndex + 1 < questions.length ? "Next Question →" : "View Final Review →"}
              </button>
            ) : (
              <button
                onClick={handleRevealEarly}
                disabled={eliminatedIndices.length === 0}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition disabled:opacity-40 cursor-pointer"
              >
                Reveal Answer & Notes
              </button>
            )}
          </div>
        </div>
      ) : (
        /* 🏆 FINAL DRILL SUMMARY */
        <div className="space-y-6">
          {/* Main Results Card */}
          <div className="bg-slate-900 text-white p-6 sm:p-10 rounded-3xl text-center space-y-6 border border-slate-800 shadow-xl">
            <span className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
              🎉 Technique Drill Completed
            </span>

            <div>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Option Elimination Results
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-lg mx-auto font-medium">
                Here is your performance breakdown for eliminating incorrect distractors.
              </p>
            </div>

            {/* Score Highlight Box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto pt-2">
              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col items-center justify-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Score</span>
                <div className="text-3xl sm:text-4xl font-black text-amber-400 mt-1">
                  {score} <span className="text-lg text-slate-400 font-semibold">/ {questions.length}</span>
                </div>
                <span className="text-[10px] text-slate-300 mt-1">Questions Protected</span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col items-center justify-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Elimination Accuracy</span>
                <div className={`text-3xl sm:text-4xl font-black mt-1 ${
                  accuracyPercent >= 80 ? "text-emerald-400" : accuracyPercent >= 50 ? "text-amber-400" : "text-rose-400"
                }`}>
                  {accuracyPercent}%
                </div>
                <span className="text-[10px] text-slate-300 mt-1">Safe Choice Rate</span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col items-center justify-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Proficiency Tier</span>
                <div className="text-lg font-black text-white mt-1">
                  {accuracyPercent >= 80 ? "⭐ Master Eliminator" : accuracyPercent >= 50 ? "🎯 Solid Instincts" : "💡 Needs Practice"}
                </div>
                <span className="text-[10px] text-slate-300 mt-1">
                  {accuracyPercent >= 80 ? "Exam Ready" : accuracyPercent >= 50 ? "Building Speed" : "Review Technique"}
                </span>
              </div>
            </div>

            {/* Understanding Your Score & Drill Mechanics Callout */}
            <div className="max-w-2xl mx-auto p-5 sm:p-6 rounded-2xl bg-slate-800/50 border border-slate-700 text-left space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-700/80 pb-3">
                <span className="text-lg">🎯</span>
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  Why did you receive this score?
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                  <div className="font-extrabold text-emerald-400 flex items-center gap-1.5">
                    <span>✓</span> Point Calculation
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    You earned <strong>+1 point</strong> for every question where you struck out wrong distractors <em>without</em> striking out the correct answer.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                  <div className="font-extrabold text-amber-300 flex items-center gap-1.5">
                    <span>⚠️</span> Did You Choose The Right Answer?
                  </div>
                  <p className="text-amber-200/90 leading-relaxed">
                    In this drill, clicking an option <strong>ELIMINATES (strikes it out)</strong>. If you clicked the correct answer thinking it was a quiz, you accidentally discarded the correct answer!
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => loadDrillSession(true)}
                className="px-7 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <span>⚡ Start Next 10-Item Drill</span>
              </button>
              <Link
                href="/drills"
                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition"
              >
                Strategy Drills Hub
              </Link>
              <Link
                href="/dashboard"
                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>

          {/* Itemized Question Breakdown */}
          {history.length > 0 && (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Item-by-Item Review</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review which choices you eliminated and check where mistakes happened.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ✓ {history.filter((h) => !h.struckCorrect).length} Protected
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                    ✕ {history.filter((h) => h.struckCorrect).length} Struck Out
                  </span>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                {history.map((record, index) => {
                  const wasProtected = !record.struckCorrect;

                  return (
                    <div
                      key={record.id || index}
                      className={`p-4 sm:p-5 rounded-2xl border transition ${
                        wasProtected ? "bg-slate-50/70 border-slate-200" : "bg-rose-50/30 border-rose-200"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-500">#{index + 1}</span>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                            {record.category}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                            wasProtected
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-rose-100 text-rose-800 border-rose-300"
                          }`}
                        >
                          {wasProtected ? "✅ Protected Correct Answer (+1)" : "❌ Struck Out Correct Answer (+0)"}
                        </span>
                      </div>

                      <div
                        className="text-xs sm:text-sm font-bold text-slate-800 mb-3"
                        dangerouslySetInnerHTML={{ __html: formatPromptHTML(record.prompt) }}
                      />

                      {/* Options Breakdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                        {record.options.map((opt, optIdx) => {
                          const isEliminated = record.eliminatedIndices.includes(optIdx);
                          const isCorrect = optIdx === record.answerIndex;

                          let itemStyle = "bg-white border-slate-200 text-slate-600";
                          if (isCorrect) {
                            itemStyle = "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold ring-1 ring-emerald-400";
                          } else if (isEliminated) {
                            itemStyle = "bg-rose-50/70 border-rose-200 text-rose-600 line-through";
                          }

                          return (
                            <div
                              key={optIdx}
                              className={`p-2.5 rounded-xl border flex items-center justify-between ${itemStyle}`}
                            >
                              <span>{opt}</span>
                              {isCorrect && (
                                <span className="text-[10px] font-black text-emerald-700 uppercase">Correct Choice</span>
                              )}
                              {isEliminated && !isCorrect && (
                                <span className="text-[10px] font-black text-rose-600 uppercase">Eliminated</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      <div className="text-[11px] text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                        <strong className="text-slate-800">Explanation: </strong>
                        {record.explanation}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}