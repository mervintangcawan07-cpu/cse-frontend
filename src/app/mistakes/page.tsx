// Relative Path: src/app/mistakes/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import MistakeNotebookSection from "@/components/exam/MistakeNotebookSection";

export default function MistakesPage() {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8 animate-fade-in">
      {/* Hero Header */}
      <div className="relative bg-slate-900 text-white p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-3 overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-rose-500/20 text-rose-400 rounded-full border border-rose-500/30">
            📕 Error Tracking & Mastery
          </span>
          <Link
            href="/practice"
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
          >
            ← Practice Center
          </Link>
        </div>

        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
          Smart Mistake Notebook <span className="text-rose-400 font-bold">(Balik-Aral)</span>
        </h1>
        <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
          Automatically records every question you missed in mock exams and drills. Practice your mistaken questions until you achieve 100% mastery and eliminate repeat errors.
        </p>
      </div>

      {/* Main Notebook Section */}
      <MistakeNotebookSection />
    </div>
  );
}
