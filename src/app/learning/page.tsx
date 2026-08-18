// Relative Path: src/app/learning/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchWithClientCache } from "@/lib/clientCache";

export default function LearningHubPage() {
  const [isPaid, setIsPaid] = useState(false);
  const [stats, setStats] = useState({ notesCount: 0, handbooksCount: 0 });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setIsPaid(data.user.isPaid || data.user.role === "ADMIN");
        }
      })
      .catch(() => {});

    Promise.all([
      fetchWithClientCache<{ notes: any[] }>("/api/reviewer"),
      fetchWithClientCache<{ handbooks: any[] }>("/api/reading-materials"),
    ])
      .then(([notesData, hbData]) => {
        setStats({
          notesCount: notesData.notes?.length || 0,
          handbooksCount: hbData.handbooks?.length || 0,
        });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-2 py-3 sm:px-4 sm:py-6 md:px-6">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
        {/* Top Banner Header - Seamlessly integrated */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-700 text-white p-4 sm:p-6 md:p-8 space-y-3 overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
          <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-white/20 text-white rounded-full border border-white/30 backdrop-blur-md">
            📚 Knowledge Vault
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            Learning Hub
          </h1>
          <p className="text-xs md:text-sm text-indigo-100 max-w-xl leading-relaxed font-medium">
            Access high-yield study notes, official government handbooks, flashcard decks, and saved bookmarked items.
          </p>
        </div>

        {/* Futuristic Knowledge Cards Grid */}
        <div className="p-3.5 sm:p-6 md:p-8 bg-slate-50/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* CARD 1: FLASHCARDS */}
        <div className="bg-white text-slate-900 p-6 rounded-3xl border border-blue-200/90 shadow-md space-y-4 flex flex-col justify-between relative overflow-hidden group hover:border-blue-400 hover:shadow-lg transition-all duration-300">
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                Active Recall
              </span>
              <span className="text-xs font-bold text-slate-500">Memory Decks</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-3">Flashcards</h2>
            <p className="text-xs text-slate-600 leading-relaxed mt-2 font-medium">
              <strong className="text-blue-600 font-bold">Boost long-term retention!</strong> Practice rapid-fire active recall flashcards across core Civil Service topics.
            </p>
          </div>
          <div className="pt-2 relative z-10">
            {isPaid ? (
              <Link
                href="/flashcards"
                className="inline-block w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs text-center rounded-xl transition shadow-lg shadow-blue-600/30"
              >
                Study Flashcards 🎴
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="inline-block w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs text-center rounded-xl transition"
              >
                🔒 Unlock Flashcards
              </Link>
            )}
          </div>
        </div>

        {/* CARD 2: BOOKMARKS */}
        <div className="bg-white text-slate-900 p-6 rounded-3xl border border-emerald-200/90 shadow-md space-y-4 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-400 hover:shadow-lg transition-all duration-300">
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                Flagged Vault
              </span>
              <span className="text-xs font-bold text-slate-500">Saved Items</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-3">Bookmarks</h2>
            <p className="text-xs text-slate-600 leading-relaxed mt-2 font-medium">
              <strong className="text-emerald-700 font-bold">Review tricky questions!</strong> Access your personal vault of flagged exam items and saved questions.
            </p>
          </div>
          <div className="pt-2 relative z-10">
            {isPaid ? (
              <Link
                href="/bookmarks"
                className="inline-block w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs text-center rounded-xl transition shadow-lg shadow-emerald-600/30"
              >
                View Bookmarks 🔖
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="inline-block w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs text-center rounded-xl transition"
              >
                🔒 Unlock Bookmarks
              </Link>
            )}
          </div>
        </div>

        {/* CARD 3: STUDY NOTES & CHEAT SHEETS */}
        <div className="bg-white text-slate-900 p-6 rounded-3xl border border-amber-200/90 shadow-md space-y-4 flex flex-col justify-between relative overflow-hidden group hover:border-amber-400 hover:shadow-lg transition-all duration-300">
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-50 text-amber-800 rounded-md border border-amber-200">
                Cheat Sheets
              </span>
              <span className="text-xs font-bold text-slate-500">{stats.notesCount} Notes</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-3">Study Notes & Cheat Sheets</h2>
            <p className="text-xs text-slate-600 leading-relaxed mt-2 font-medium">
              <strong className="text-amber-700 font-bold">Master key formulas fast!</strong> Access concise cheat sheets covering Civil Service laws, math shortcuts, and grammar rules.
            </p>
          </div>
          <div className="pt-2 relative z-10">
            {isPaid ? (
              <Link
                href="/reviewer"
                className="inline-block w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs text-center rounded-xl transition shadow-lg shadow-amber-500/20"
              >
                Read Study Notes 📚
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="inline-block w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs text-center rounded-xl transition"
              >
                🔒 Unlock Study Notes
              </Link>
            )}
          </div>
        </div>

        {/* CARD 4: OFFICIAL READING MATERIALS & HANDBOOKS */}
        <div className="bg-white text-slate-900 p-6 rounded-3xl border border-purple-200/90 shadow-md space-y-4 flex flex-col justify-between relative overflow-hidden group hover:border-purple-400 hover:shadow-lg transition-all duration-300">
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-purple-50 text-purple-700 rounded-md border border-purple-200">
                PDF Repository
              </span>
              <span className="text-xs font-bold text-slate-500">{stats.handbooksCount} Handbooks</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-3">Official Handbooks</h2>
            <p className="text-xs text-slate-600 leading-relaxed mt-2 font-medium">
              <strong className="text-purple-700 font-bold">Official references!</strong> Read PDF handbooks for 1987 Constitution, R.A. 6713, and Executive Orders.
            </p>
          </div>
          <div className="pt-2 relative z-10">
            {isPaid ? (
              <Link
                href="/reading-materials"
                className="inline-block w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs text-center rounded-xl transition shadow-lg shadow-purple-600/30"
              >
                Open PDF Reader 📖
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="inline-block w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs text-center rounded-xl transition"
              >
                🔒 Unlock Handbooks
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);
}