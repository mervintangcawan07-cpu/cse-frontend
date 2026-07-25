"use client";

import Link from "next/link";

export default function DrillsPage() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-md space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
          5-Minute Challenge Center
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold">Specialized Strategy & Technique Drills</h1>
        <p className="text-xs md:text-sm text-slate-400">
          Train your speed, elimination tactics, and scanning efficiency for exam day.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Option Elimination Trainer Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md">
              10-Sec Rapid Elimination
            </span>
            <span className="text-xs font-bold text-amber-600">Technique Drill</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Option Elimination Trainer</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Train yourself to spot and strike out 2 obviously wrong choices in under 10 seconds. Boosts educated guessing speed under pressure!
          </p>
          <Link
            href="/drills/elimination"
            className="inline-block w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs text-center rounded-xl transition"
          >
            Launch Elimination Drill ⚡
          </Link>
        </div>

        {/* Rapid Reading Scanner Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md">
              Reading Comprehension
            </span>
            <span className="text-xs font-bold text-blue-600">Fast Scanning</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Keyword Passage Scanner</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Practice identifying qualifiers (*However, Therefore, NOT, EXCEPT*) in long reading passages to save 30–45 seconds per question.
          </p>
          <Link
            href="/reading-materials"
            className="inline-block w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs text-center rounded-xl transition"
          >
            Open Reader with Scanner 📚
          </Link>
        </div>
      </div>
    </div>
  );
}