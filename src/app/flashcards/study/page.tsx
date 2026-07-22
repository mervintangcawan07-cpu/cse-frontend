"use client";

import { useState } from "react";
import Link from "next/link";

export default function StudyFlashcardsPage() {
  const cards = [
    {
      id: 1,
      front: "What is the primary governing law of the Philippine Civil Service system?",
      back: "Executive Order No. 292 (Administrative Code of 1987) and Article IX-B of the 1987 Constitution."
    },
    {
      id: 2,
      front: "Define 'Procrastination'",
      back: "The action of delaying or postponing something, especially habitual or intentional delay of tasks that need to be accomplished."
    },
    {
      id: 3,
      front: "What is 15% of ₱1,200?",
      back: "₱180. (Formula: 1200 * 0.15 = 180)"
    },
    {
      id: 4,
      front: "What does the Filipino idiom 'Balat-sibuyas' mean?",
      back: "Sensitive or easily offended (literally: onion-skinned)."
    }
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleNext = () => {
    setIsFlipped(false);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const currentCard = cards[currentIndex];

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 flex flex-col justify-between">
      <div className="max-w-3xl mx-auto w-full space-y-8">
        
        <div className="flex justify-between items-center">
          <Link href="/flashcards" className="text-blue-600 font-semibold hover:underline">
            &larr; Back to Decks
          </Link>
          <span className="text-sm font-bold text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            Card {currentIndex + 1} of {cards.length}
          </span>
        </div>

        <div 
          onClick={() => setIsFlipped(!isFlipped)}
          className="bg-white rounded-3xl border border-slate-200 shadow-md p-10 md:p-16 text-center cursor-pointer min-h-[320px] flex flex-col justify-center items-center relative transition-all hover:shadow-lg"
        >
          <span className="absolute top-6 right-6 text-xs font-bold tracking-widest uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            {isFlipped ? "Answer / Explanation" : "Question / Term"}
          </span>

          <p className="text-2xl md:text-3xl font-bold text-slate-800 leading-snug">
            {isFlipped ? currentCard.back : currentCard.front}
          </p>

          <p className="absolute bottom-6 text-xs text-slate-400 font-medium">
            Click anywhere on the card to flip
          </p>
        </div>

        <div className="flex justify-between items-center gap-4">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`flex-1 py-4 rounded-xl font-bold border transition ${
              currentIndex === 0 
                ? "border-slate-200 text-slate-300 cursor-not-allowed bg-white" 
                : "border-slate-300 text-slate-700 hover:bg-slate-100 bg-white"
            }`}
          >
            Previous Card
          </button>

          <button
            onClick={handleNext}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-sm"
          >
            {currentIndex === cards.length - 1 ? "Restart Deck" : "Next Card"}
          </button>
        </div>

      </div>
    </div>
  );
}