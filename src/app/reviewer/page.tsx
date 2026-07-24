"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface StudyNote {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: string[];
  tips?: string;
}

export default function ReviewerPage() {
  const [studyNotes, setStudyNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "Verbal Ability", "Numerical Reasoning", "General Information", "Analytical Reasoning"];

  useEffect(() => {
    async function fetchNotes() {
      try {
        const res = await fetch("/api/reviewer");
        const data = await res.json();
        if (res.ok && data.notes) setStudyNotes(data.notes);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchNotes();
  }, []);

  const filteredNotes =
    selectedCategory === "All"
      ? studyNotes
      : studyNotes.filter((note) => note.category === selectedCategory);

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-8 rounded-3xl shadow-md">
        <div>
          <h1 className="text-3xl font-extrabold">Study Notes & Reviewer</h1>
          <p className="text-slate-400 text-sm mt-1">Read core principles and formulas.</p>
        </div>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition border border-slate-700"
        >
          &larr; Dashboard
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              selectedCategory === cat
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 font-bold text-sm animate-pulse">Loading study notes...</div>
      ) : filteredNotes.length === 0 ? (
        <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-slate-400 text-sm">
          No study notes published yet for this category.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredNotes.map((note) => (
            <div key={note.id} className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md">
                  {note.category}
                </span>
                <h2 className="text-xl font-extrabold text-slate-800 mt-3">{note.title}</h2>
                <p className="text-slate-500 text-xs mt-0.5">{note.summary}</p>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-2 text-sm text-slate-700">
                {note.content.map((line, idx) => (
                  <p key={idx} className="leading-relaxed font-medium">{line}</p>
                ))}
              </div>

              {note.tips && (
                <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-xs text-indigo-900 flex items-start gap-2.5">
                  <span className="text-base">💡</span>
                  <div>
                    <span className="font-extrabold">Exam Pro-Tip: </span>
                    {note.tips}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}