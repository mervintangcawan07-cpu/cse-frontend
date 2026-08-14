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
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
      {/* Top Banner Header */}
      <div className="relative bg-slate-900 text-white p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-3 overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30">
          📚 Knowledge Vault
        </span>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
          Learning Hub
        </h1>
        <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed">
          Access high-yield study notes, official government handbooks, flashcard decks, and saved bookmarked items.
        </p>
      </div>

      {/* Futuristic Knowledge Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CARD 1: FLASHCARDS */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-blue-500/30 shadow-xl space-y-4 flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/50 transition-all duration-300">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-md border border-blue-500/30">
                Active Recall
              </span>
              <span className="text-xs font-bold text-slate-400">Memory Decks</span>
            </div>
            <h2 className="text-xl font-extrabold text-white mt-3">Flashcards</h2>
            <p className="text-xs text-slate-300 leading-relaxed mt-2 font-medium">
              <strong className="text-blue-400 font-bold">Boost long-term retention!</strong> Practice rapid-fire active recall flashcards across core Civil Service topics.
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
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-emerald-500/30 shadow-xl space-y-4 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-300">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/30">
                Flagged Vault
              </span>
              <span className="text-xs font-bold text-slate-400">Saved Items</span>
            </div>
            <h2 className="text-xl font-extrabold text-white mt-3">Bookmarks</h2>
            <p className="text-xs text-slate-300 leading-relaxed mt-2 font-medium">
              <strong className="text-emerald-400 font-bold">Review tricky questions!</strong> Access your personal vault of flagged exam items and saved questions.
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
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-amber-500/30 shadow-xl space-y-4 flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/50 transition-all duration-300">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-md border border-amber-500/30">
                Cheat Sheets
              </span>
              <span className="text-xs font-bold text-slate-400">{stats.notesCount} Notes</span>
            </div>
            <h2 className="text-xl font-extrabold text-white mt-3">Study Notes & Cheat Sheets</h2>
            <p className="text-xs text-slate-300 leading-relaxed mt-2 font-medium">
              <strong className="text-amber-400 font-bold">Master key formulas fast!</strong> Access concise cheat sheets covering Civil Service laws, math shortcuts, and grammar rules.
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
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-purple-500/30 shadow-xl space-y-4 flex flex-col justify-between relative overflow-hidden group hover:border-purple-500/50 transition-all duration-300">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-purple-500/20 text-purple-400 rounded-md border border-purple-500/30">
                PDF Repository
              </span>
              <span className="text-xs font-bold text-slate-400">{stats.handbooksCount} Handbooks</span>
            </div>
            <h2 className="text-xl font-extrabold text-white mt-3">Official Handbooks</h2>
            <p className="text-xs text-slate-300 leading-relaxed mt-2 font-medium">
              <strong className="text-purple-400 font-bold">Official references!</strong> Read PDF handbooks for 1987 Constitution, R.A. 6713, and Executive Orders.
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
  );
}