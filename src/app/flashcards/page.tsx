import Link from "next/link";

export default function FlashcardsPage() {
  const decks = [
    { title: "Vocabulary Builder", description: "Synonyms, antonyms, and context clues.", cards: 150, color: "border-blue-200 bg-blue-50 text-blue-700", icon: "VB" },
    { title: "Phil. Constitution", description: "Key articles, sections, and amendments.", cards: 85, color: "border-amber-200 bg-amber-50 text-amber-700", icon: "PC" },
    { title: "Math Formulas", description: "Essential formulas for Numerical Ability.", cards: 45, color: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: "MF" },
    { title: "Idioms & Grammar", description: "Common idiomatic expressions and rules.", cards: 120, color: "border-purple-200 bg-purple-50 text-purple-700", icon: "IG" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="bg-linear-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-white shadow-md flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold">Flashcards</h1>
          <p className="text-slate-300 mt-2">Master concepts faster using active recall and spaced repetition.</p>
        </div>
        <button className="bg-white text-slate-900 font-bold px-6 py-3 rounded-xl shadow-sm hover:bg-slate-100 transition whitespace-nowrap">
          Start Random Review
        </button>
      </div>

      <h2 className="text-xl font-bold text-slate-800 px-1">Your Study Decks</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {decks.map((deck, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition p-6 flex flex-col justify-between h-56">
            <div>
              <div className={`w-12 h-12 rounded-xl mb-4 border flex items-center justify-center text-sm font-bold ${deck.color}`}>
                {deck.icon}
              </div>
              <h3 className="font-bold text-slate-800 text-lg">{deck.title}</h3>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{deck.description}</p>
            </div>
            
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500">{deck.cards} Cards</span>
              <Link href="#" className="text-sm font-bold text-blue-600 hover:underline">
                Study Now
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}