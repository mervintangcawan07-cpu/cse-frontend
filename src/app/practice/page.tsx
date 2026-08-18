// Relative Path: src/app/practice/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function PracticeAndPrepPage() {
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setIsPaid(data.user.isPaid || data.user.role === "ADMIN");
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-2 py-3 sm:px-4 sm:py-6 md:px-6">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
        {/* Top Banner Header - Seamlessly integrated */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-4 sm:p-6 md:p-8 space-y-3 overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
          <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-white/20 text-white rounded-full border border-white/30 backdrop-blur-md">
            🎯 Assessment Hub
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            Practice & Prep Center
          </h1>
          <p className="text-xs md:text-sm text-blue-100 max-w-xl leading-relaxed font-medium">
            Engage in timed mock exam simulations, practice specialized technique drills, or compete in multiplayer 1v1 duels.
          </p>
        </div>

        {/* Futuristic Launcher Cards Grid */}
        <div className="p-3.5 sm:p-6 md:p-8 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* CARD 1: PRACTICE MOCK EXAM */}
        <div className="bg-white text-slate-900 p-6 rounded-3xl border border-slate-200/90 shadow-md space-y-4 flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/50 hover:shadow-lg transition-all duration-300">
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                170 Timed Items
              </span>
              <span className="text-xs font-bold text-slate-500">Timed Simulation</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-3">Practice Mock Exam</h2>
            <p className="text-xs text-slate-600 leading-relaxed mt-2 font-medium">
              <strong className="text-slate-900 font-bold">Experience realistic exam conditions!</strong> Take full 170-item timed simulations with detailed step-by-step explanations and live score analytics.
            </p>
          </div>

          <div className="flex gap-2.5 pt-2 relative z-10">
            {isPaid ? (
              <>
                <Link
                  href="/mock-exam/take"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs text-center rounded-xl transition shadow-lg shadow-blue-600/30"
                >
                  Start Exam ⚡
                </Link>
                <Link
                  href="/mock-exam/history"
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs text-center rounded-xl border border-slate-200 transition shrink-0"
                >
                  📜 History
                </Link>
              </>
            ) : (
              <Link
                href="/dashboard"
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition text-center"
              >
                🔒 Unlock Mock Exam
              </Link>
            )}
          </div>
        </div>

        {/* CARD 2: SMART MISTAKE NOTEBOOK (BALIK-ARAL) */}
        <div className="bg-white text-slate-900 p-6 rounded-3xl border border-rose-200/90 shadow-md space-y-4 flex flex-col justify-between relative overflow-hidden group hover:border-rose-400 hover:shadow-lg transition-all duration-300">
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-rose-50 text-rose-700 rounded-md border border-rose-200 font-mono tracking-wider">
                BALIK-ARAL
              </span>
              <span className="text-xs font-bold text-rose-600">Error Tracker 📕</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-3">
              Mistake Notebook
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed mt-2 font-medium">
              <strong className="text-rose-700 font-bold">Never repeat the same error!</strong> Automatically captures every missed question from mock exams. Drill mistakes until you achieve 100% mastery.
            </p>
          </div>
          <div className="pt-2 relative z-10">
            <Link
              href="/mistakes"
              className="inline-block w-full py-3 bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-black text-xs text-center rounded-xl transition shadow-lg shadow-rose-600/30"
            >
              Open Mistake Notebook ⚡
            </Link>
          </div>
        </div>

        {/* CARD 3: SPECIALIZED STRATEGY & TECHNIQUE DRILLS */}
        <div className="bg-white text-slate-900 p-6 rounded-3xl border border-emerald-200/90 shadow-md space-y-4 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-400 hover:shadow-lg transition-all duration-300">
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 font-mono tracking-wider">
                EXAM TACTICS
              </span>
              <span className="text-xs font-bold text-emerald-700">Technique Center</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-3">
              Strategy & Technique Drills
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed mt-2 font-medium">
              <strong className="text-emerald-700 font-bold">Master exam strategy!</strong> Train option elimination tactics and keyword passage scanning to boost your educated guessing accuracy.
            </p>
          </div>
          <div className="pt-2 relative z-10">
            {isPaid ? (
              <Link
                href="/drills"
                className="inline-block w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs text-center rounded-xl transition shadow-lg shadow-emerald-600/30"
              >
                Launch Strategy Drills ⚡
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="inline-block w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs text-center rounded-xl transition"
              >
                🔒 Unlock Strategy Drills
              </Link>
            )}
          </div>
        </div>

        {/* CARD 4: 1v1 STUDY DUELS */}
        <div className="bg-white border border-amber-200/90 p-6 rounded-3xl shadow-md space-y-4 text-slate-900 flex flex-col justify-between relative overflow-hidden group hover:border-amber-400 hover:shadow-lg transition-all duration-300">
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-50 text-amber-800 rounded-md border border-amber-200">
                Live Arena
              </span>
              <span className="text-xs font-bold text-amber-700">Multiplayer ⚔️</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-3">1v1 Study Duels</h2>
            <p className="text-xs text-slate-600 leading-relaxed mt-2 font-medium">
              <strong className="text-slate-900 font-bold">Compete head-to-head in real time!</strong> Test your recall against fellow examinees in 5-round speed quizzes. Win duels and climb the ranks.
            </p>
          </div>
          <div className="pt-2 relative z-10">
            {isPaid ? (
              <Link
                href="/duels"
                className="inline-block w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs text-center rounded-xl transition shadow-lg shadow-amber-500/20"
              >
                Enter Battle Arena ⚔️
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="inline-block w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs text-center rounded-xl transition"
              >
                🔒 Unlock 1v1 Duels
              </Link>
            )}
          </div>
        </div>

        {/* CARD 5: CUSTOM PRACTICE QUIZ BUILDER */}
        <div className="bg-white border border-violet-200/90 p-6 rounded-3xl shadow-md space-y-4 text-slate-900 flex flex-col justify-between relative overflow-hidden group hover:border-violet-400 hover:shadow-lg transition-all duration-300 sm:col-span-2 lg:col-span-1">
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-violet-50 text-violet-700 rounded-md border border-violet-200">
                Custom Builder
              </span>
              <span className="text-xs font-bold text-violet-700">🎛️ Configurable</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-3">Custom Practice Quiz</h2>
            <p className="text-xs text-slate-600 leading-relaxed mt-2 font-medium">
              <strong className="text-violet-700 font-bold">Your quiz, your rules!</strong> Choose your topics, item count (10–170), question pool (All, Unattempted, or Mistakes), and mode (Timed or Self-Paced).
            </p>
          </div>
          <div className="pt-2 relative z-10">
            <Link
              href="/practice/custom"
              className="inline-block w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-xs text-center rounded-xl transition shadow-lg shadow-violet-600/30"
            >
              Build Custom Quiz 🎛️
            </Link>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}