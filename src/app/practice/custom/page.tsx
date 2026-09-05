// Relative Path: src/app/practice/custom/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { id: "Verbal Ability", label: "Verbal Ability", icon: "📝", color: "blue" },
  { id: "Numerical Reasoning", label: "Numerical Reasoning", icon: "🔢", color: "emerald" },
  { id: "Analytical Reasoning", label: "Analytical Reasoning", icon: "🧠", color: "purple" },
  { id: "General Information", label: "General Information", icon: "📚", color: "amber" },
];

const ITEM_COUNTS = [10, 20, 30, 50, 100];

type Pool = "ALL" | "UNATTEMPTED" | "MISTAKES_ONLY";
type Mode = "TIMED" | "SELF_PACED";

const POOL_OPTIONS: { id: Pool; label: string; desc: string; icon: string }[] = [
  { id: "ALL", label: "All Questions", desc: "Draws from the full question bank", icon: "🌐" },
  { id: "UNATTEMPTED", label: "Unattempted Only", desc: "Prioritizes questions you've never seen", icon: "🆕" },
  { id: "MISTAKES_ONLY", label: "Mistake Notebook", desc: "Drills only your unmastered mistakes", icon: "📕" },
];

const MODE_OPTIONS: { id: Mode; label: string; desc: string; icon: string }[] = [
  { id: "TIMED", label: "Timed Test Mode", desc: "~45 seconds per question — simulates real exam pressure", icon: "⏱️" },
  { id: "SELF_PACED", label: "Self-Paced Study Mode", desc: "No timer — focus on understanding each question", icon: "🧘" },
];

export default function CustomQuizBuilderPage() {
  const router = useRouter();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([...CATEGORIES.map((c) => c.id)]);
  const [itemCount, setItemCount] = useState<number>(20);
  const [customCount, setCustomCount] = useState<string>("");
  const [pool, setPool] = useState<Pool>("ALL");
  const [mode, setMode] = useState<Mode>("TIMED");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((c) => c !== id) : prev) : [...prev, id]
    );
  };

  const resolvedItemCount = customCount ? parseInt(customCount, 10) || itemCount : itemCount;

  const handleLaunch = async () => {
    setError(null);
    if (resolvedItemCount < 1 || resolvedItemCount > 170) {
      setError("Item count must be between 1 and 170.");
      return;
    }
    if (selectedCategories.length === 0) {
      setError("Please select at least one category.");
      return;
    }

    setLaunching(true);

    // Verify the user has a valid session before navigating to exam page
    const meRes = await fetch("/api/auth/me").catch(() => null);
    if (!meRes?.ok) {
      setError("You must be logged in to start a quiz.");
      setLaunching(false);
      return;
    }

    const params = new URLSearchParams({
      itemCount: String(resolvedItemCount),
      categories: selectedCategories.join(","),
      pool,
      mode,
    });

    // Navigate to the exam take page with custom params in the query string
    router.push(`/mock-exam/take?${params.toString()}`);
  };

  const allCatsSelected = selectedCategories.length === CATEGORIES.length;

  return (
    <div className="w-full px-0 py-2 sm:px-3 sm:py-4 lg:px-6">
      <div className="bg-slate-900 rounded-none border-x-0 sm:rounded-2xl sm:border lg:rounded-3xl border-slate-800 shadow-2xl overflow-hidden">
        {/* Header - Seamlessly integrated */}
        <div className="relative bg-slate-900 text-white p-4 sm:p-8 space-y-3 overflow-hidden border-b border-slate-800">
          <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
          <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-violet-500/20 text-violet-400 rounded-full border border-violet-500/30">
            🎛️ Custom Quiz Builder
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            Build Your Practice Quiz
          </h1>
          <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed">
            Configure your ideal study session — choose topics, item count, question pool, and exam mode. Every detail tailored to your preparation goals.
          </p>
        </div>

        {/* Configuration Sections */}
        <div className="p-3.5 sm:p-6 md:p-8 space-y-6">

          {/* SECTION 1: Categories */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-black text-white">Subject Categories</h2>
              <p className="text-xs text-slate-400 mt-0.5">Select one or more subjects to include.</p>
            </div>
            <button
              type="button"
              onClick={() =>
                setSelectedCategories(allCatsSelected ? [CATEGORIES[0].id] : CATEGORIES.map((c) => c.id))
              }
              className="text-xs font-bold text-violet-400 hover:text-white transition"
            >
              {allCatsSelected ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`p-4 rounded-2xl border text-left transition flex flex-col gap-2 cursor-pointer ${
                    isSelected
                      ? "bg-violet-600/20 border-violet-500/60 text-white shadow-md"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-xs font-bold leading-tight">{cat.label}</span>
                  {isSelected && (
                    <span className="text-[10px] font-black text-violet-400">✓ Selected</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: Item Count */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-black text-white">Number of Questions</h2>
            <p className="text-xs text-slate-400 mt-0.5">Choose a preset or enter a custom count (1–170).</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {ITEM_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { setItemCount(n); setCustomCount(""); }}
                className={`px-5 py-2.5 rounded-xl border text-sm font-bold transition cursor-pointer ${
                  itemCount === n && !customCount
                    ? "bg-violet-600 border-violet-500 text-white shadow-md"
                    : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600"
                }`}
              >
                {n}
              </button>
            ))}

            <div className="flex items-center gap-2 ml-1">
              <input
                type="number"
                min={1}
                max={170}
                placeholder="Custom"
                value={customCount}
                onChange={(e) => { setCustomCount(e.target.value); setItemCount(0); }}
                className="w-24 px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 font-bold focus:outline-none focus:border-violet-500 transition"
              />
              <span className="text-xs text-slate-400 font-medium">items</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400">
              Estimated time:{" "}
              <strong className="text-white">
                {mode === "TIMED"
                  ? `~${Math.ceil((resolvedItemCount * 45) / 60)} min (timed)`
                  : "Untimed (self-paced)"}
              </strong>
            </span>
          </div>
        </div>

        {/* SECTION 3: Question Pool */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-black text-white">Question Pool</h2>
            <p className="text-xs text-slate-400 mt-0.5">Which questions should your quiz draw from?</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {POOL_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPool(opt.id)}
                className={`p-4 rounded-2xl border text-left transition flex flex-col gap-2 cursor-pointer ${
                  pool === opt.id
                    ? "bg-violet-600/20 border-violet-500/60 text-white shadow-md"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{opt.icon}</span>
                  {pool === opt.id && (
                    <span className="text-[10px] font-black text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/30">
                      Active
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold">{opt.label}</span>
                <span className="text-[11px] text-slate-400 leading-tight">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 4: Exam Mode */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-black text-white">Exam Mode</h2>
            <p className="text-xs text-slate-400 mt-0.5">Choose your study environment.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                className={`p-5 rounded-2xl border text-left transition flex flex-col gap-2 cursor-pointer ${
                  mode === opt.id
                    ? "bg-violet-600/20 border-violet-500/60 text-white shadow-md"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{opt.icon}</span>
                  {mode === opt.id && (
                    <span className="text-[10px] font-black text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/30">
                      Selected
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold">{opt.label}</span>
                <span className="text-[11px] text-slate-400 leading-relaxed">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SUMMARY & LAUNCH */}
        <div className="bg-slate-900 border border-violet-500/30 rounded-3xl p-6 space-y-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <h2 className="text-base font-black text-white mb-3">Quiz Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                <p className="text-slate-400 font-medium">Items</p>
                <p className="text-white font-black text-lg">{resolvedItemCount}</p>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                <p className="text-slate-400 font-medium">Categories</p>
                <p className="text-white font-black text-lg">{selectedCategories.length}</p>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                <p className="text-slate-400 font-medium">Pool</p>
                <p className="text-violet-400 font-black text-sm pt-1">
                  {POOL_OPTIONS.find((p) => p.id === pool)?.icon} {pool.replace("_", " ")}
                </p>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                <p className="text-slate-400 font-medium">Mode</p>
                <p className="text-violet-400 font-black text-sm pt-1">
                  {MODE_OPTIONS.find((m) => m.id === mode)?.icon} {mode.replace("_", " ")}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-medium">
              ⚠️ {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleLaunch}
            disabled={launching}
            className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-sm rounded-2xl transition shadow-2xl shadow-violet-600/30 cursor-pointer disabled:opacity-60"
          >
            {launching ? "Preparing Your Quiz..." : `🚀 Launch Custom Quiz — ${resolvedItemCount} Items`}
          </button>
        </div>
      </div>
    </div>
  </div>
);
}
