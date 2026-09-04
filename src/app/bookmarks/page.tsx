"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface BookmarkedItem {
  bookmarkId: string;
  targetType: "QUESTION" | "STUDY_NOTE";
  id: string;
  category: string;
  bookmarkedAt: string;

  // Question Fields
  prompt?: string;
  options?: string[];
  answerIndex?: number;
  explanation?: string | null;

  // Study Note Fields
  title?: string;
  summary?: string;
  content?: string[];
  tips?: string | null;
}

export default function BookmarksPage() {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"ALL" | "QUESTION" | "STUDY_NOTE">("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const loadBookmarks = async () => {
    try {
      const res = await fetch("/api/bookmarks");
      const data = await res.json();

      if (res.ok && data.bookmarks) {
        setBookmarks(data.bookmarks);
      } else if (res.status === 401) {
        router.push("/login");
      }
    } catch (err) {
      console.error("Failed to fetch bookmarks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookmarks();
  }, []);

  const handleRemoveBookmark = async (bookmarkId: string) => {
    try {
      const res = await fetch(`/api/bookmarks?id=${bookmarkId}`, { method: "DELETE" });
      if (res.ok) {
        setBookmarks((prev) => prev.filter((b) => b.bookmarkId !== bookmarkId));
      } else {
        alert("Failed to remove bookmark.");
      }
    } catch (err) {
      console.error(err);
      alert("Error removing bookmark.");
    }
  };

  const toggleAnswerReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Categories extraction
  const categories = ["ALL", ...Array.from(new Set(bookmarks.map((b) => b.category)))];

  // Filter Logic
  const filteredBookmarks = bookmarks.filter((b) => {
    const matchesType = filterType === "ALL" || b.targetType === filterType;
    const matchesCategory = selectedCategory === "ALL" || b.category === selectedCategory;
    const searchTarget = (
      b.prompt ||
      b.title ||
      b.summary ||
      b.category ||
      ""
    ).toLowerCase();
    const matchesSearch = searchTarget.includes(searchQuery.toLowerCase());

    return matchesType && matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="w-full py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading saved bookmarks...
      </div>
    );
  }

  return (
    <div className="w-full px-0 py-2 sm:px-3 sm:py-4 lg:px-6 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-none border-x-0 sm:rounded-2xl sm:border lg:rounded-3xl shadow-xl overflow-hidden">
        {/* HEADER BANNER - Seamlessly integrated */}
        <div className="bg-slate-900 p-4 sm:p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
              Personalized Revision Hub
            </span>
            <h1 className="text-2xl font-black text-white mt-2">
              Bookmarked Items Hub
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Review and re-test saved practice questions and study notes.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 shrink-0"
          >
            ← Dashboard
          </Link>
        </div>

        {/* UNIFIED CONTENT SECTION */}
        <div className="p-3.5 sm:p-6 md:p-8 space-y-6">
          {/* FILTER CONTROLS */}
          <div className="space-y-3">
            {/* TYPE FILTER TABS */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 text-xs font-bold">
              <button
                onClick={() => setFilterType("ALL")}
                className={`px-4 py-2 rounded-xl transition ${
                  filterType === "ALL"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                🔖 All Saved Items ({bookmarks.length})
              </button>
              <button
                onClick={() => setFilterType("QUESTION")}
                className={`px-4 py-2 rounded-xl transition ${
                  filterType === "QUESTION"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                ❓ Questions ({bookmarks.filter((b) => b.targetType === "QUESTION").length})
              </button>
              <button
                onClick={() => setFilterType("STUDY_NOTE")}
                className={`px-4 py-2 rounded-xl transition ${
                  filterType === "STUDY_NOTE"
                    ? "bg-amber-500 text-slate-950 font-black shadow-md"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                📝 Study Notes ({bookmarks.filter((b) => b.targetType === "STUDY_NOTE").length})
              </button>
            </div>

            {/* SEARCH AND CATEGORY FILTERS */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg transition shrink-0 ${
                      selectedCategory === cat
                        ? "bg-slate-700 text-white"
                        : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    {cat === "ALL" ? "All Subjects" : cat}
                  </button>
                ))}
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Search bookmarks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-60"
                />
              </div>
            </div>
          </div>

          {/* LIST OF SAVED BOOKMARKS */}
          {filteredBookmarks.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-12 text-center space-y-3">
              <div className="text-4xl">🔖</div>
              <h2 className="text-base font-bold text-white">No Bookmarks Found</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                You haven&apos;t saved any items matching this filter yet. Bookmark questions during exams and review notes in the Learning Vault.
              </p>
              <div className="pt-2">
                <Link
                  href="/practice"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition inline-block"
                >
                  Start Practicing →
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBookmarks.map((item) => {
                const isRevealed = revealedIds.has(item.id);

                return (
                  <div
                    key={item.bookmarkId}
                    className="bg-slate-950/80 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 md:p-6 space-y-4 transition hover:border-slate-700"
                  >
                    {/* ITEM HEADER */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md ${
                            item.targetType === "QUESTION"
                              ? "bg-blue-900/60 text-blue-300 border border-blue-700"
                              : "bg-amber-900/60 text-amber-300 border border-amber-700"
                          }`}
                        >
                          {item.targetType === "QUESTION" ? "Question" : "Study Note"}
                        </span>
                        <span className="text-xs font-bold text-slate-400">{item.category}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-400">
                          Saved on {new Date(item.bookmarkedAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => handleRemoveBookmark(item.bookmarkId)}
                          className="text-xs text-rose-400 hover:text-rose-300 font-bold transition cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* QUESTION ITEM DISPLAY */}
                    {item.targetType === "QUESTION" && (
                      <div className="space-y-3 text-sm">
                        <p className="font-semibold text-slate-200 leading-relaxed">{item.prompt}</p>

                        {item.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {item.options.map((opt, optIdx) => {
                              const isCorrect = item.answerIndex === optIdx;

                              return (
                                <div
                                  key={optIdx}
                                  className={`p-3 rounded-xl border text-xs font-medium transition ${
                                    isRevealed
                                      ? isCorrect
                                        ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300 font-bold"
                                        : "bg-slate-900/60 border-slate-800 text-slate-400 opacity-60"
                                      : "bg-slate-900/40 border-slate-800 text-slate-300"
                                  }`}
                                >
                                  <span className="font-mono mr-2 font-bold text-slate-400">
                                    {String.fromCharCode(65 + optIdx)}.
                                  </span>
                                  {opt}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                          <button
                            onClick={() => toggleAnswerReveal(item.id)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition"
                          >
                            {isRevealed ? "Hide Answer & Rationale" : "Reveal Correct Answer"}
                          </button>
                        </div>

                        {isRevealed && item.explanation && (
                          <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl text-xs space-y-1 mt-2">
                            <span className="font-bold text-emerald-400">Explanation & Rationale:</span>
                            <p className="text-slate-300 leading-relaxed font-normal">{item.explanation}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* STUDY NOTE ITEM DISPLAY */}
                    {item.targetType === "STUDY_NOTE" && (
                      <div className="space-y-3">
                        <div>
                          <h2 className="text-base font-extrabold text-white">{item.title}</h2>
                          <p className="text-xs text-slate-400 mt-0.5">{item.summary}</p>
                        </div>

                        {item.content && (
                          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-300">
                            {item.content.map((bullet, bIdx) => (
                              <p key={bIdx} className="leading-relaxed font-medium">
                                {bullet}
                              </p>
                            ))}
                          </div>
                        )}

                        {item.tips && (
                          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-xs text-indigo-300">
                            <span className="font-extrabold uppercase text-[10px] text-indigo-400 block">
                              💡 Exam Tip:
                            </span>
                            <p className="font-medium leading-relaxed">{item.tips}</p>
                          </div>
                        )}
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
