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
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
      {/* Top Banner Header */}
      <div className="relative bg-slate-900 text-white p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-3 overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
          🎯 Assessment Hub
        </span>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
          Practice & Prep Center
        </h1>
        <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed">
          Engage in timed mock exam simulations, practice specialized technique drills, or compete in multiplayer 1v1 duels.
        </p>
      </div>

      {/* Futuristic Launcher Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CARD 1: PRACTICE MOCK EXAM */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4 flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/40 transition-all duration-300">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-md border border-blue-500/30">
                170 Timed Items
              </span>
              <span className="text-xs font-bold text-slate-400">Timed Simulation</span>
            </div>
            <h2 className="text-xl font-extrabold text-white mt-3">Practice Mock Exam</h2>
            <p className="text-xs text-slate-300 leading-relaxed mt-2 font-medium">
              <strong className="text-white font-bold">Experience realistic exam conditions!</strong> Take full 170-item timed simulations with detailed step-by-step explanations and live score analytics.
            </p>
          </div>

          <div className="flex gap-2.5 pt-2 relative z-10">
            {isPaid ? (
              <>
                <Link
                  href="/exam"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs text-center rounded-xl transition shadow-lg shadow-blue-600/30"
                >
                  Start Exam ⚡
                </Link>
                <Link
                  href="/history"
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs text-center rounded-xl border border-slate-700 transition shrink-0"
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

        {/* CARD 2: SPECIALIZED STRATEGY & TECHNIQUE DRILLS */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-emerald-500/30 shadow-xl space-y-4 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-300">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/30 font-mono tracking-wider">
                EXAM TACTICS
              </span>
              <span className="text-xs font-bold text-emerald-400">Technique Center</span>
            </div>
            <h2 className="text-xl font-extrabold text-white mt-3">
              Specialized Strategy & Technique Drills
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed mt-2 font-medium">
              <strong className="text-emerald-400 font-bold">Master exam strategy!</strong> Train option elimination tactics and keyword passage scanning to boost your educated guessing accuracy and scan speed.
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

        {/* CARD 3: 1v1 STUDY DUELS */}
        <div className="bg-slate-900 border border-amber-500/30 p-6 rounded-3xl shadow-xl space-y-4 text-white flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/50 transition-all duration-300">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-md border border-amber-500/30">
                Live Arena
              </span>
              <span className="text-xs font-bold text-slate-400">Multiplayer ⚔️</span>
            </div>
            <h2 className="text-xl font-extrabold text-white mt-3">1v1 Study Duels</h2>
            <p className="text-xs text-slate-300 leading-relaxed mt-2 font-medium">
              <strong className="text-white font-bold">Compete head-to-head in real time!</strong> Test your recall against fellow examinees in 5-round speed quizzes. Win duels, earn XP, and rule the leaderboard.
            </p>
          </div>
          <div className="pt-2 relative z-10">
            {isPaid ? (
              <Link
                href="/1v1"
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
      </div>
    </div>
  );
}