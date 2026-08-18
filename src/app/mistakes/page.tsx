// Relative Path: src/app/mistakes/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import MistakeNotebookSection from "@/components/exam/MistakeNotebookSection";

export default function MistakesPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-2 py-3.5 sm:px-4 sm:py-6 md:px-6 space-y-4 sm:space-y-8 animate-fade-in">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-r from-rose-600 via-pink-600 to-orange-600 text-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-xl shadow-rose-600/15 space-y-3 overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-white/20 text-white rounded-full border border-white/30 backdrop-blur-md">
            📕 Error Tracking & Mastery
          </span>
          <Link
            href="/practice"
            className="text-xs text-rose-100 hover:text-white flex items-center gap-1 transition font-bold"
          >
            ← Practice Center
          </Link>
        </div>

        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
          Smart Mistake Notebook <span className="text-amber-200 font-bold">(Balik-Aral)</span>
        </h1>
        <p className="text-xs md:text-sm text-rose-100 max-w-2xl leading-relaxed font-medium">
          Automatically records every question you missed in mock exams and drills. Practice your mistaken questions until you achieve 100% mastery and eliminate repeat errors.
        </p>
      </div>

      {/* Main Notebook Section */}
      <MistakeNotebookSection />
    </div>
  );
}
