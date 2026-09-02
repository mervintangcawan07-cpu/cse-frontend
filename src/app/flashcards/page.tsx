"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [shuffledDeck, setShuffledDeck] = useState<Flashcard[] | null>(null);
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

  // Derived filtered cards without cascading effect renders
  const activeCards = shuffledDeck || allCards;
  const filteredCards =
    selectedCategory === "ALL"
      ? activeCards
      : activeCards.filter((c) => c.category === selectedCategory);

  const currentCard = filteredCards[currentIndex];

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleNext = useCallback(() => {
    setIsFlipped(false);
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0); // Loop back
    }
  }, [currentIndex, filteredCards.length]);

  const handlePrev = useCallback(() => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      setCurrentIndex(filteredCards.length - 1); // Loop to end
    }
  }, [currentIndex, filteredCards.length]);

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
    const shuffled = [...allCards].sort(() => Math.random() - 0.5);
    setShuffledDeck(shuffled);
  };

  // Keyboard Shortcuts: Spacebar to flip, ArrowLeft for previous, ArrowRight for next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcut interference when focus is in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading active-recall flashcard deck...
      </div>
    );
  }

  const isCurrentMastered = currentCard ? masteredIds.has(currentCard.id) : false;

  return (
    <div className="w-full max-w-6xl mx-auto px-2 py-3 sm:px-4 sm:py-6 md:px-6 text-slate-900 dark:text-slate-100">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden">
        {/* HEADER BANNER - Seamlessly integrated */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full border border-amber-500/30">
              Active Recall Practice
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              Interactive Flashcards
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Tap cards to flip between prompts and answers. Memorize key formulas, laws, and vocabulary.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold rounded-xl transition border border-slate-200 dark:border-slate-700 shrink-0"
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
                  type="button"
                  onClick={() => handleSelectCategory(cat)}
                  className={`px-3.5 py-2 rounded-xl transition shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>
                Card {filteredCards.length > 0 ? currentIndex + 1 : 0} of {filteredCards.length}
              </span>
              <button
                type="button"
                onClick={shuffleDeck}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 transition flex items-center gap-1 cursor-pointer"
              >
                <span>🔀</span>
                <span>Shuffle</span>
              </button>
            </div>
          </div>

          {/* MAIN FLASHCARD STACK - GENUINE 3D FLIP ARCHITECTURE */}
          {currentCard ? (
            <div className="space-y-4">
              {/* 3D Container with Perspective */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full min-h-[360px] sm:min-h-[400px] cursor-pointer select-none relative"
                style={{ perspective: "1000px" }}
              >
                {/* Rotating 3D Inner Layer */}
                <div
                  className="w-full h-full min-h-[360px] sm:min-h-[400px] relative transition-transform duration-500 ease-in-out"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  {/* FRONT FACE (Question / Prompt) */}
                  <div
                    className="absolute inset-0 w-full h-full p-6 sm:p-10 rounded-2xl sm:rounded-3xl border flex flex-col justify-between bg-white dark:bg-slate-950 border-slate-200 dark:border-blue-500/40 shadow-xl dark:shadow-blue-500/10 hover:border-blue-400 dark:hover:border-blue-400 transition-colors"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(0deg)",
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-500/20">
                        {currentCard.category} • {currentCard.topic}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                        <span>Tap to Flip</span>
                        <span>↻</span>
                      </span>
                    </div>

                    <div className="my-auto space-y-3 text-center sm:text-left py-4">
                      <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-snug">
                        {currentCard.front}
                      </h2>
                    </div>

                    <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-t border-slate-100 dark:border-slate-800 pt-3">
                      <span>[Space] to Flip</span>
                      <span>Question / Prompt</span>
                    </div>
                  </div>

                  {/* BACK FACE (Answer / Solution) — Correctly oriented, un-mirrored */}
                  <div
                    className="absolute inset-0 w-full h-full p-6 sm:p-10 rounded-2xl sm:rounded-3xl border flex flex-col justify-between bg-amber-50/60 dark:bg-slate-950 border-amber-300 dark:border-amber-500/40 shadow-xl dark:shadow-amber-500/10 transition-colors"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-md border border-amber-300 dark:border-amber-500/20">
                        Solution / Rationalization
                      </span>
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                        Answer Revealed ✅
                      </span>
                    </div>

                    <div className="my-auto space-y-3 text-center sm:text-left py-4">
                      <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                        {currentCard.back}
                      </p>
                    </div>

                    <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-t border-amber-200/60 dark:border-slate-800 pt-3">
                      <span>[Space] to Flip Back</span>
                      <span>Tap to turn back</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD NAVIGATION & MASTERY CONTROLS */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-5 py-3 bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-extrabold text-xs rounded-2xl border border-slate-200 dark:border-slate-800 transition shadow-sm cursor-pointer"
                >
                  ← Previous
                </button>

                <button
                  type="button"
                  onClick={() => toggleMastered(currentCard.id)}
                  className={`px-4 py-3 rounded-2xl font-black text-xs transition border shadow-sm cursor-pointer ${
                    isCurrentMastered
                      ? "bg-emerald-50 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300"
                      : "bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {isCurrentMastered ? "⭐ Mastered" : "☆ Mark as Mastered"}
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-2xl shadow-lg transition cursor-pointer"
                >
                  Next Card →
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-12 text-center space-y-3">
              <span className="text-3xl block">🎴</span>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                No flashcards found in this category.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
