"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RotateCw,
  Shuffle,
  Sparkles,
  CheckCircle,
  AlertCircle,
  ThumbsUp,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

interface Flashcard {
  id: string;
  category: string;
  topic: string;
  front: string;
  back: string;
}

export default function StudyFlashcardsPage() {
  const router = useRouter();
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [deck, setDeck] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Spaced Repetition Mastery Tracking
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [reviewAgainIds, setReviewAgainIds] = useState<Set<string>>(new Set());

  // Fetch real flashcards from DB
  useEffect(() => {
    async function loadFlashcards() {
      try {
        const res = await fetch("/api/flashcards");
        const data = await res.json();
        if (!res.ok || !Array.isArray(data.flashcards)) {
          throw new Error(data?.error || "Failed to load flashcards.");
        }

        setAllCards(data.flashcards);
        setDeck(data.flashcards);
      } catch (err) {
        console.error("Failed to fetch flashcards:", err);
        setLoadError(true);
        setAllCards([]);
        setDeck([]);
      } finally {
        setLoading(false);
      }
    }
    loadFlashcards();
  }, []);

  // Category filter
  useEffect(() => {
    setIsFlipped(false);
    setCurrentIndex(0);
    if (selectedCategory === "ALL") {
      setDeck(allCards);
    } else {
      setDeck(allCards.filter((c) => c.category === selectedCategory));
    }
  }, [selectedCategory, allCards]);

  const handleNext = useCallback(() => {
    setIsFlipped(false);
    if (currentIndex < deck.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  }, [currentIndex, deck.length]);

  const handlePrev = useCallback(() => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      setCurrentIndex(deck.length - 1);
    }
  }, [currentIndex, deck.length]);

  // Spaced Repetition Responses
  const handleRateAgain = () => {
    if (!currentCard) return;
    setReviewAgainIds((prev) => new Set(prev).add(currentCard.id));
    setMasteredIds((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNext();
  };

  const handleRateGood = () => {
    if (!currentCard) return;
    handleNext();
  };

  const handleRateMastered = () => {
    if (!currentCard) return;
    setMasteredIds((prev) => new Set(prev).add(currentCard.id));
    setReviewAgainIds((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNext();
  };

  const shuffleDeck = () => {
    setIsFlipped(false);
    setCurrentIndex(0);
    setDeck((prev) => [...prev].sort(() => Math.random() - 0.5));
  };

  // Keyboard Shortcuts (Space to flip, 1/2/3 to rate, Left/Right arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === "1") {
        e.preventDefault();
        handleRateAgain();
      } else if (e.key === "2") {
        e.preventDefault();
        handleRateGood();
      } else if (e.key === "3") {
        e.preventDefault();
        handleRateMastered();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, isFlipped]);

  const currentCard = deck[currentIndex];
  const categories = ["ALL", ...Array.from(new Set(allCards.map((c) => c.category)))];
  const masteredPercentage = deck.length > 0 ? Math.round((masteredIds.size / deck.length) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-bold text-sm animate-pulse">
        Loading active-recall study deck...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-4 sm:py-8 px-2 sm:px-4 md:px-6 flex flex-col justify-between">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <Link
            href="/flashcards"
            className="text-xs font-bold text-blue-400 hover:text-blue-300 transition flex items-center gap-1.5"
          >
            ← Back to Flashcard Decks
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={shuffleDeck}
              disabled={deck.length === 0}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Shuffle</span>
            </button>
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              Card {deck.length === 0 ? 0 : currentIndex + 1} of {deck.length}
            </span>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {cat === "ALL" ? "All Subjects" : cat}
            </button>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold text-slate-400">
            <span>Deck Mastery ({masteredIds.size}/{deck.length} cards)</span>
            <span className="text-emerald-400">{masteredPercentage}% Mastered</span>
          </div>
          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-emerald-500 h-2 transition-all duration-300 rounded-full"
              style={{ width: `${masteredPercentage}%` }}
            />
          </div>
        </div>

        {/* Interactive Flashcard with Flip Animation */}
        {currentCard ? (
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className={`rounded-3xl border p-8 sm:p-14 text-center cursor-pointer min-h-[340px] flex flex-col justify-between items-center relative transition-all duration-300 shadow-2xl ${
              isFlipped
                ? "bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border-indigo-500/50 shadow-indigo-950/50"
                : "bg-slate-900 border-slate-800 hover:border-slate-700 shadow-black/50"
            }`}
          >
            <div className="w-full flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/30 px-3 py-1 rounded-full">
                {currentCard.category}
              </span>
              <span className="text-xs font-mono font-bold text-slate-400">
                {isFlipped ? "💡 Answer Revealed" : "❓ Question / Prompt"}
              </span>
            </div>

            <div className="my-6">
              <p
                className={`font-black text-white leading-relaxed ${
                  isFlipped ? "text-lg sm:text-xl text-emerald-200" : "text-xl sm:text-2xl"
                }`}
              >
                {isFlipped ? currentCard.back : currentCard.front}
              </p>
            </div>

            <div className="w-full flex items-center justify-between text-[11px] text-slate-500 pt-4 border-t border-slate-800/80">
              <span className="hidden sm:inline">Press [Space] or tap anywhere to flip</span>
              <span className="flex items-center gap-1 text-slate-400">
                <RotateCw className="w-3.5 h-3.5" /> Tap to Flip
              </span>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500 bg-slate-900 rounded-3xl border border-slate-800">
            {loadError
              ? "The active flashcard deck could not be loaded. No bundled cards were substituted."
              : selectedCategory === "ALL"
                ? "No active flashcards are available. Cards will appear after an administrator adds or restores them."
                : "No active flashcards were found in this category."}
          </div>
        )}

        {/* Spaced Repetition Rating Buttons */}
        {currentCard && (isFlipped ? (
          <div className="space-y-2 pt-2">
            <div className="text-center text-xs font-bold text-slate-400">
              Rate your recall difficulty:
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleRateAgain}
                className="py-3 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-2xl font-bold text-xs transition flex flex-col items-center gap-1 cursor-pointer"
              >
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>Repeat Again</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">[1] Hard</span>
              </button>

              <button
                onClick={handleRateGood}
                className="py-3 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-2xl font-bold text-xs transition flex flex-col items-center gap-1 cursor-pointer"
              >
                <div className="flex items-center gap-1">
                  <ThumbsUp className="w-4 h-4 text-amber-400" />
                  <span>Good</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">[2] Normal</span>
              </button>

              <button
                onClick={handleRateMastered}
                className="py-3 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-2xl font-bold text-xs transition flex flex-col items-center gap-1 cursor-pointer"
              >
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Mastered</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">[3] Easy</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              onClick={handlePrev}
              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous [←]</span>
            </button>
            <button
              onClick={handleNext}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20"
            >
              <span>Next Card [→]</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
