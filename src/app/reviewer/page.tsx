"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProTipBullets from "@/components/notes/ProTipBullets";

interface NoteItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  content: string;
  proTip?: string;
}

export default function StudyNotesReviewerPage() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  const categories = [
    "All",
    "Verbal Ability",
    "Numerical Reasoning",
    "General Information",
    "Analytical Reasoning",
  ];

  useEffect(() => {
    async function fetchNotes() {
      try {
        const res = await fetch("/api/notes");
        if (res.ok) {
          const data = await res.json();
          setNotes(data.notes || []);
        }
      } catch (err) {
        console.error("Failed to fetch study notes:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchNotes();
  }, []);

  const filteredNotes = notes.filter(
    (note) => selectedCategory === "All" || note.category === selectedCategory
  );

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6 text-slate-900 dark:text-slate-100">
      {/* Top Header Banner */}
      <div className="bg-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-md flex justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Study Notes & Reviewer</h1>
          <p className="text-slate-400 text-sm mt-1">Read core principles and formulas.</p>
        </div>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition border border-slate-700 shrink-0"
        >
          &larr; Dashboard
        </Link>
      </div>

      {/* Category Selection Tabs */}
      <div className="flex flex-wrap gap-2 pt-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              selectedCategory === cat
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Study Notes List */}
      {loading ? (
        <div className="py-20 text-center font-bold text-slate-400 animate-pulse">
          Loading study notes & formulas...
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          No study notes available for this category.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="p-6 md:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-5 shadow-sm"
            >
              {/* Category Badge & Bookmark */}
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-full">
                  {note.category}
                </span>
                <button className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1">
                  🔖 Bookmark
                </button>
              </div>

              {/* Note Title & Subtitle */}
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {note.title}
                </h2>
                {note.subtitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {note.subtitle}
                  </p>
                )}
              </div>

              {/* 1. ORIGINAL MAIN CONTENT / EXPLANATION (UNTOUCHED) */}
              <div className="p-5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-700 dark:text-slate-300 space-y-3 leading-relaxed whitespace-pre-line">
                {note.content}
              </div>

              {/* 2. ONLY EXAM PRO-TIP BOX IN BULLET FORM */}
              {note.proTip && <ProTipBullets proTip={note.proTip} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
