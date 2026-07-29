"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface BookmarkedQuestion {
  bookmarkId: string;
  id: string;
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string | null;
  bookmarkedAt: string;
}

export default function BookmarksPage() {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<BookmarkedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
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

  const toggleAnswerReveal = (questionId: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  // Extract Categories
  const categories = ["ALL", ...Array.from(new Set(bookmarks.map((b) => b.category)))];

  // Filter Bookmarks
  const filteredBookmarks = bookmarks.filter((b) => {
    const matchesCategory = selectedCategory === "ALL" || b.category === selectedCategory;
    const matchesSearch =
      b.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading bookmarked questions library...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6 text-slate-100">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
            Personalized Revision
          </span>
          <h1 className="text-2xl font-black text-white mt-2">
            Bookmarked Questions Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review and re-test saved questions from your mock exams and speed drills.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 shrink-0"
        >
          ← Dashboard
        </Link>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2 rounded-xl transition shrink-0 ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {cat === "ALL" ? "🔖 All Categories" : cat}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search saved items..."
          className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-64 shrink-0"
        />
      </div>

      {/* BOOKMARKS LIST */}
      {filteredBookmarks.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
          <span className="text-4xl block">🔖</span>
          <h3 className="text-sm font-bold text-white">No Saved Questions Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click the bookmark icon during mock exams or drills to save challenging questions here for focused revision.
          </p>
          <Link
            href="/mock-exam/take"
            className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-md transition"
          >
            Start Practice Exam
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookmarks.map((item, idx) => {
            const isRevealed = revealedIds.has(item.id);

            return (
              <div
                key={item.bookmarkId}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-lg hover:border-slate-700 transition"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20">
                      Item #{idx + 1} • {item.category}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Saved {new Date(item.bookmarkedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <button
                    onClick={() => handleRemoveBookmark(item.bookmarkId)}
                    className="text-xs font-bold text-red-400 hover:text-red-300 transition px-2.5 py-1 bg-red-500/10 rounded-lg border border-red-500/20"
                  >
                    🗑️ Remove
                  </button>
                </div>

                {/* Prompt */}
                <h3 className="text-sm font-extrabold text-white leading-relaxed">
                  {item.prompt}
                </h3>

                {/* Options List */}
                <div className="space-y-2">
                  {item.options.map((opt, optIdx) => {
                    const isCorrectOption = optIdx === item.answerIndex;

                    let optStyle = "bg-slate-950 border-slate-800/80 text-slate-300";
                    if (isRevealed && isCorrectOption) {
                      optStyle = "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold";
                    }

                    return (
                      <div
                        key={optIdx}
                        className={`p-3.5 rounded-xl border text-xs flex justify-between items-center transition ${optStyle}`}
                      >
                        <span>
                          <strong className="mr-2 uppercase">
                            {String.fromCharCode(65 + optIdx)}.
                          </strong>
                          {opt}
                        </span>
                        {isRevealed && isCorrectOption && (
                          <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400">
                            Correct Answer
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action & Solution Section */}
                <div className="pt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-t border-slate-800/80">
                  <button
                    onClick={() => toggleAnswerReveal(item.id)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700"
                  >
                    {isRevealed ? "🙈 Hide Answer" : "💡 Reveal Correct Answer"}
                  </button>
                </div>

                {isRevealed && item.explanation && (
                  <div className="p-4 rounded-2xl bg-blue-600/10 border border-blue-500/30 space-y-1">
                    <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider block">
                      Solution & Rationalization
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {item.explanation}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}