"use client";

import { useState } from "react";

interface ExplainMistakeButtonProps {
  prompt: string;
  userChoice: string;
  correctChoice: string;
  officialExplanation?: string | null;
  category?: string;
}

export default function ExplainMistakeButton({
  prompt,
  userChoice,
  correctChoice,
  officialExplanation,
  category,
}: ExplainMistakeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetchExplanation = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/explain-mistake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          userChoice,
          correctChoice,
          officialExplanation,
          category,
        }),
      });

      const data = await res.json();
      if (res.ok && data.explanation) {
        setExplanation(data.explanation);
      } else {
        setError(data.error || "Could not generate AI explanation.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error generating explanation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3">
      {!explanation ? (
        <button
          onClick={handleFetchExplanation}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 border border-purple-300 rounded-xl font-extrabold text-xs transition disabled:opacity-50"
        >
          <span>🤖</span>
          <span>{loading ? "AI Analyzing..." : "Why was my choice wrong?"}</span>
        </button>
      ) : (
        <div className="p-4 rounded-2xl bg-purple-900 text-purple-100 border border-purple-700 text-xs space-y-1.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 font-black text-purple-300">
            <span>✨ AI Tutor Breakdown:</span>
          </div>
          <p className="leading-relaxed">{explanation}</p>
        </div>
      )}

      {error && <p className="text-[11px] text-red-500 font-bold mt-1">{error}</p>}
    </div>
  );
}