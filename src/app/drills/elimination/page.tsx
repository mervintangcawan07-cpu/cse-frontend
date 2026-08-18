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
        } catch (e) {
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

  // 🚀 Local State Navigation: ZERO DB calls on "Next Question"
  const handleNextQuestion = () => {
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
      <div className="max-w-2xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading Elimination Trainer & Question Bank...
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="w-full max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-4 space-y-4 sm:space-y-6">
      {/* Header Banner */}
      <div className="flex justify-between items-center bg-slate-900 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-md">
        <div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
            Option Elimination Trainer
          </span>
          <h1 className="text-xl font-black mt-1">Option Elimination Trainer</h1>
          <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-xl bg-amber-500/15 px-3.5 py-2 border border-amber-500/30 text-amber-200 text-xs sm:text-sm font-medium shadow-sm">
  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950">
    ⚡ DRILL GOAL
  </span>
  <span>
    Click to <strong className="text-amber-300 font-extrabold underline decoration-amber-400 decoration-2 underline-offset-2">strike out 2 wrong choices</strong> to reveal the strategy breakdown!
  </span>
</div>
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
                    <span className="text-xs font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">
                      ✓ Correct Choice
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 💡 IMMEDIATE ELIMINATION & ANSWER REVIEW BOX */}
          {isRevealed && (
            <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-4 border border-slate-800 animate-in fade-in duration-200">
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
                onClick={() => setIsRevealed(true)}
                disabled={eliminatedIndices.length === 0}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition disabled:opacity-40 cursor-pointer"
              >
                Reveal Answer & Notes
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ðŸ† FINAL DRILL SUMMARY */
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-8 rounded-3xl text-center space-y-4 border border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
              Drill Completed
            </span>
            <h2 className="text-3xl font-black text-white">Technique Drill Results</h2>
            <p className="text-xs text-slate-300">
              You avoided striking out the correct answer on <strong className="text-amber-400">{score}</strong> out of{" "}
              {questions.length} questions.
            </p>
            <div className="pt-4 flex justify-center gap-3">
              <button
                onClick={() => loadDrillSession(true)}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                ⚡ Start Next 10-Item Drill
              </button>
              <Link
                href="/dashboard"
                className="inline-block px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}