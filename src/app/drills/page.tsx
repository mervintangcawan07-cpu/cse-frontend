// Relative Path: src/app/drills/page.tsx
"use client";

import Link from "next/link";

export default function DrillsPage() {
  return (
    <div className="w-full px-0 py-2 sm:px-3 sm:py-4 lg:px-6">
      <div className="bg-white rounded-none border-x-0 sm:rounded-2xl sm:border lg:rounded-3xl border-slate-200/90 shadow-md overflow-hidden">
        {/* Top Hero Banner - Seamlessly integrated */}
        <div className="bg-slate-900 text-white p-4 sm:p-8 md:p-10 space-y-3">
          <span className="text-xs font-black uppercase tracking-widest px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
            ⚡ 5-Minute Challenge Center
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            Specialized Strategy & Technique Drills
          </h1>
          <p className="text-xs md:text-sm text-slate-300 max-w-2xl font-medium leading-relaxed">
            Train your speed, elimination tactics, and scanning efficiency to maximize your score on Civil Service exam day.
          </p>
        </div>

        {/* Drill Modules Grid */}
        <div className="p-3.5 sm:p-6 md:p-8 bg-slate-50/60 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Module 1: Option Elimination Trainer */}
          <div className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-6 hover:shadow-md transition">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase px-3 py-1 bg-amber-100 text-amber-800 rounded-lg">
                  OPTION ELIMINATION
                </span>
                <span className="text-xs font-bold text-amber-600 font-mono">Technique Drill</span>
              </div>

              <h2 className="text-xl font-extrabold text-slate-900">
                Option Elimination Trainer
              </h2>

              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-900">Sharpen your test instincts!</strong> Master the process of elimination by quickly striking out distractor choices to dramatically boost your educated guessing accuracy under pressure.
              </p>

              <ul className="space-y-1.5 pt-2 text-xs text-slate-600 font-medium">
                <li className="flex items-center gap-2">
                  <span className="text-amber-500 font-bold">✓</span> Strike out 2 obviously wrong choices in seconds
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-500 font-bold">✓</span> Boost educated guessing accuracy on tricky items
                </li>
              </ul>
            </div>

            <Link
              href="/drills/elimination"
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition text-center shadow-md flex items-center justify-center gap-2"
            >
              <span>Launch Elimination Drill</span>
              <span>⚡</span>
            </Link>
          </div>

          {/* Module 2: Keyword Passage Scanner */}
          <div className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-6 hover:shadow-md transition">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase px-3 py-1 bg-blue-100 text-blue-800 rounded-lg">
                  READING COMPREHENSION
                </span>
                <span className="text-xs font-bold text-blue-600 font-mono">Fast Scanning</span>
              </div>

              <h2 className="text-xl font-extrabold text-slate-900">
                Keyword Passage Scanner
              </h2>

              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-900">Conquer lengthy reading passages!</strong> Train your eyes to instantly spot key qualifiers (<code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-bold">NOT</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-bold">EXCEPT</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-bold">However</code>) and extract answers without reading full paragraphs word-for-word.
              </p>

              <ul className="space-y-1.5 pt-2 text-xs text-slate-600 font-medium">
                <li className="flex items-center gap-2">
                  <span className="text-blue-500 font-bold">✓</span> Spot high-frequency qualifier keywords instantly
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-500 font-bold">✓</span> Save 30–45 seconds per reading comprehension item
                </li>
              </ul>
            </div>

            <Link
              href="/reading-materials"
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition text-center shadow-md flex items-center justify-center gap-2"
            >
              <span>Open Reader with Scanner</span>
              <span>📚</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
