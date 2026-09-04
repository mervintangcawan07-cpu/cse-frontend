"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const LOCAL_STORAGE_KEY = "cse_active_exam_session";

interface SavedSession {
  examMode?: "SIMULATION" | "GUIDED_REVIEW";
  examQuestions: any[];
  selectedAnswers: Record<number, number>;
  currentIndex: number;
  timerMinutes: number;
  timeLeft: number;
}

export default function ResumeExamBanner() {
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);

  // Check for saved exam session in localStorage
  useEffect(() => {
    const session = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (parsed.examQuestions && parsed.examQuestions.length > 0) {
          setSavedSession(parsed);
        }
      } catch (err) {
        console.error("Failed to parse active exam session:", err);
      }
    }
  }, []);

  const handleDiscard = () => {
    if (confirm("Are you sure you want to discard your saved exam attempt?")) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setSavedSession(null);
    }
  };

  if (!savedSession) return null;

  const totalQuestions = savedSession.examQuestions.length;
  const answeredCount = Object.keys(savedSession.selectedAnswers || {}).length;
  const currentItemNum = (savedSession.currentIndex || 0) + 1;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const isGuided = savedSession.examMode === "GUIDED_REVIEW";

  return (
    <div
      className={`border rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
        isGuided
          ? "bg-gradient-to-r from-emerald-500/10 via-emerald-500/15 to-emerald-500/10 border-emerald-500/30"
          : "bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 border-amber-500/30"
      }`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
              isGuided
                ? "text-emerald-700 bg-emerald-500/20 border-emerald-500/30"
                : "text-amber-600 bg-amber-500/20 border-amber-500/30"
            }`}
          >
            {isGuided ? "💡 Paused Guided Review" : "⏸️ Unfinished Exam Paused"}
          </span>
          {savedSession.timerMinutes > 0 && savedSession.timeLeft > 0 && (
            <span className="text-xs font-bold text-slate-500">
              ⏱️ {formatTime(savedSession.timeLeft)} left
            </span>
          )}
        </div>
        <h2 className="text-lg font-extrabold text-slate-900">
          {isGuided
            ? "You have an active Guided Review session in progress!"
            : "You have an active exam session in progress!"}
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          Answered <strong className="text-slate-800">{answeredCount} of {totalQuestions}</strong> items (currently at Question #{currentItemNum}).
        </p>
      </div>

      <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
        <button
          onClick={handleDiscard}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
        >
          Discard
        </button>
        <Link
          href="/mock-exam/take"
          className={`flex-1 md:flex-initial text-center px-6 py-2.5 text-white font-black text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
            isGuided
              ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
              : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
          }`}
        >
          <span>{isGuided ? "Resume Guided Review" : "Resume Exam"}</span>
          <span>{isGuided ? "💡" : "⚡"}</span>
        </Link>
      </div>
    </div>
  );
}