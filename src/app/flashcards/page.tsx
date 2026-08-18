"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Flashcard {
  id: string;
  category: string;
  topic: string;
  front: string;
  back: string;
}

export default function FlashcardsPage() {
  const router = useRouter();
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [filteredCards, setFilteredCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadFlashcards() {
      try {
        const res = await fetch("/api/flashcards");
        const data = await res.json();

        if (res.ok && data.flashcards) {
          setAllCards(data.flashcards);
          setFilteredCards(data.flashcards);
        } else {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Failed to fetch flashcards:", err);
      } finally {
        setLoading(false);
      }
    }
    loadFlashcards();
  }, [router]);

  // Handle Category Filtering
  useEffect(() => {
    setIsFlipped(false);
    setCurrentIndex(0);
    if (selectedCategory === "ALL") {
      setFilteredCards(allCards);
    } else {
      setFilteredCards(allCards.filter((c) => c.category === selectedCategory));
    }
  }, [selectedCategory, allCards]);

  const currentCard = filteredCards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0); // Loop back
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      setCurrentIndex(filteredCards.length - 1); // Loop to end
    }
  };

  const toggleMastered = (id: string) => {
    setMasteredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const shuffleDeck = () => {
    setIsFlipped(false);
    setCurrentIndex(0);
    const shuffled = [...filteredCards].sort(() => Math.random() - 0.5);
    setFilteredCards(shuffled);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading active-recall flashcard deck...
      </div>
    );
  }

  const isCurrentMastered = currentCard ? masteredIds.has(currentCard.id) : false;

  return (
    <div className="w-full max-w-6xl mx-auto px-2 py-3 sm:px-4 sm:py-6 md:px-6 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden">
        {/* HEADER BANNER - Seamlessly integrated */}
        <div className="bg-slate-900 p-4 sm:p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
              Active Recall Practice
            </span>
            <h1 className="text-2xl font-black text-white mt-2">
              Interactive Flashcards
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Tap cards to flip between prompts and answers. Memorize key formulas, laws, and vocabulary.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 shrink-0"
          >
            ← Return to Dashboard
          </Link>
        </div>

        {/* UNIFIED CONTENT BODY */}
        <div className="p-3.5 sm:p-6 md:p-8 space-y-6">
          {/* CATEGORY FILTERS & CONTROLS */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold">
              {["ALL", "Verbal Ability", "General Information", "Numerical Reasoning"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 rounded-xl transition shrink-0 ${
                    selectedCategory === cat
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs font-bold text-slate-400">
              <span>
                Card {filteredCards.length > 0 ? currentIndex + 1 : 0} of {filteredCards.length}
              </span>
              <button
                onClick={shuffleDeck}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition flex items-center gap-1 cursor-pointer"
              >
                <span>🔀</span>
                <span>Shuffle</span>
              </button>
            </div>
          </div>

          {/* MAIN FLASHCARD STACK */}
          {currentCard ? (
            <div className="space-y-4">
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className={`w-full min-h-[340px] sm:min-h-[380px] p-6 sm:p-10 rounded-2xl sm:rounded-3xl border transition-all duration-300 cursor-pointer flex flex-col justify-between select-none relative shadow-xl ${
                  isFlipped
                    ? "bg-slate-950 border-amber-500/40 shadow-amber-500/10"
                    : "bg-slate-950 border-blue-500/40 shadow-blue-500/10 hover:border-blue-400"
                }`}
                style={{ perspective: "1000px" }}
              >
                {/* FRONT SIDE */}
                {!isFlipped && (
                  <div className="flex flex-col justify-between h-full space-y-6">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20">
                        {currentCard.category} • {currentCard.topic}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">
                        Tap anywhere to Flip ↻
                      </span>
                    </div>

                    <div className="my-auto space-y-3 text-center sm:text-left">
                      <h2 className="text-lg sm:text-2xl font-black text-white leading-snug">
                        {currentCard.front}
                      </h2>
                    </div>

                    <div className="text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Question / Prompt
                    </div>
                  </div>
                )}

                {/* BACK SIDE */}
                {isFlipped && (
                  <div
                    className="flex flex-col justify-between h-full space-y-6"
                    style={{ transform: "rotateY(180deg)" }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-md border border-amber-500/20">
                        Solution / Rationalization
                      </span>
                      <span className="text-xs text-amber-400 font-bold">
                        Answer Revealed ✅
                      </span>
                    </div>

                    <div className="my-auto space-y-3 text-center sm:text-left">
                      <p className="text-sm sm:text-base font-bold text-slate-200 leading-relaxed whitespace-pre-line">
                        {currentCard.back}
                      </p>
                    </div>

                    <div className="text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Tap to turn back
                    </div>
                  </div>
                )}
              </div>

              {/* CARD NAVIGATION & MASTERY CONTROLS */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={handlePrev}
                  className="px-5 py-3 bg-slate-950 hover:bg-slate-800 text-white font-extrabold text-xs rounded-2xl border border-slate-800 transition shadow-md cursor-pointer"
                >
                  ← Previous
                </button>

                <button
                  onClick={() => toggleMastered(currentCard.id)}
                  className={`px-4 py-3 rounded-2xl font-black text-xs transition border shadow-md cursor-pointer ${
                    isCurrentMastered
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {isCurrentMastered ? "⭐ Mastered" : "☆ Mark as Mastered"}
                </button>

                <button
                  onClick={handleNext}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-2xl shadow-lg transition cursor-pointer"
                >
                  Next Card →
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl sm:rounded-3xl p-12 text-center space-y-3">
              <span className="text-3xl block">🎴</span>
              <p className="text-xs font-bold text-slate-400">
                No flashcards found in this category.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
