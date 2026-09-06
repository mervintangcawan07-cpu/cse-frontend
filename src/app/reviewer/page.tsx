"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import ProTipBullets from "@/components/notes/ProTipBullets";
import AudioSpeechButton from "@/components/common/AudioSpeechButton";
import { fetchWithClientCache } from "@/lib/clientCache";


interface StudyNote {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: string[];
  tips?: string;
  videoUrl?: string;
}

export default function ReviewerPage() {
  const [studyNotes, setStudyNotes] = useState<StudyNote[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = [
    "All",
    "Verbal Ability",
    "Numerical Reasoning",
    "General Information",
    "Analytical Reasoning",
  ];

  useEffect(() => {
    async function fetchNotesAndBookmarks() {
      try {
        const [notesData, bookmarkRes] = await Promise.all([
          fetchWithClientCache<{ notes: StudyNote[] }>("/api/reviewer"),
          fetch("/api/bookmarks"),
        ]);

        if (notesData && notesData.notes) setStudyNotes(notesData.notes);

        if (bookmarkRes.ok) {
          const bookmarkData = await bookmarkRes.json();
          const ids = new Set<string>(
            bookmarkData.bookmarks
              ?.filter((b: any) => b.targetType === "STUDY_NOTE")
              .map((b: any) => b.id) || []
          );
          setBookmarkedIds(ids);
        }
      } catch (err) {
        console.error("Failed to load reviewer notes or bookmarks:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchNotesAndBookmarks();
  }, []);

  const toggleBookmark = async (noteId: string) => {
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: noteId, targetType: "STUDY_NOTE" }),
      });

      const data = await res.json();
      if (res.ok) {
        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          if (data.isBookmarked) {
            next.add(noteId);
          } else {
            next.delete(noteId);
          }
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to toggle study note bookmark:", err);
    }
  };

  const filteredNotes =
    selectedCategory === "All"
      ? studyNotes
      : studyNotes.filter((note) => note.category === selectedCategory);

  return (
    <div className="w-full px-0 py-2 sm:px-3 sm:py-4 lg:px-6">
      <div className="bg-white rounded-none border-x-0 sm:rounded-2xl sm:border lg:rounded-3xl border-slate-200/90 shadow-md overflow-hidden">
        {/* Header - Seamlessly integrated */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-4 sm:p-6 md:p-8 print:hidden">
          <div>
            <h1 className="text-3xl font-extrabold">Study Notes &amp; Reviewer</h1>
            <p className="text-slate-400 text-sm mt-1">Read core principles, formulas, and law summaries.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              title="Print or Save as Clean PDF Cheat Sheet"
            >
              <Printer className="w-4 h-4" />
              <span>Print Cheat Sheet (PDF)</span>
            </button>
            <Link
              href="/dashboard"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition border border-slate-700"
            >
              &larr; Dashboard
            </Link>
          </div>
        </div>

        {/* Content Inside Unified Frame */}
        <div className="p-3.5 sm:p-6 md:p-8 bg-slate-50/60 space-y-6">
          <div className="flex flex-wrap gap-2 pb-2 print:hidden">
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
            <div className="py-12 text-center text-slate-400 font-bold text-sm animate-pulse">
              Loading study notes...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-slate-400 text-sm">
              No study notes published yet for this category.
            </div>
          ) : (
            <div className="space-y-6">
              {filteredNotes.map((note) => {
                const isBookmarked = bookmarkedIds.has(note.id);
                const noteSpeechText = `${note.title}. ${note.summary}. ${note.content.join(" ")}. ${note.tips || ""}`;

                return (
                  <div
                    key={note.id}
                    className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm space-y-4 print:border-slate-300 print:shadow-none print:break-inside-avoid"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md print:bg-slate-100 print:text-slate-800">
                        {note.category}
                      </span>

                      <div className="flex items-center gap-2 print:hidden">
                        <AudioSpeechButton textToSpeak={noteSpeechText} label="Listen" />
                        <button
                          onClick={() => toggleBookmark(note.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 ${
                            isBookmarked
                              ? "bg-amber-500/10 border-amber-500/40 text-amber-600"
                              : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          <span>{isBookmarked ? "🔖 Bookmarked" : "🔖 Bookmark"}</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <h2 className="text-xl font-extrabold text-slate-800 mt-1">{note.title}</h2>
                      <p className="text-slate-500 text-xs mt-0.5">{note.summary}</p>
                    </div>

                    {/* ORIGINAL MAIN CONTENT BOX (UNTOUCHED) */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-2 text-sm text-slate-700">
                      {note.content.map((line, idx) => (
                        <p key={idx} className="leading-relaxed font-medium">
                          {line}
                        </p>
                      ))}
                    </div>

                    {/* EXAM PRO-TIP BOX IN BULLET FORM */}
                    {note.tips && <ProTipBullets proTip={note.tips} />}

                    {/* VIDEO EXPLANATION BUTTON */}
                    {note.videoUrl && (
                      <div className="pt-1">
                        <a
                          href={note.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition shadow-xs cursor-pointer"
                        >
                          <span>🎬 Watch Video Explanation on Facebook</span>
                          <span>&rarr;</span>
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
