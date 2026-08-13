// Relative Path: src/components/exam/FlagQuestionButton.tsx
"use client";

import React, { useState } from "react";

const FLAG_REASONS = [
  { id: "WRONG_ANSWER", label: "❌ Wrong Answer Key", desc: "The marked correct answer appears incorrect." },
  { id: "TYPO_GRAMMAR", label: "✏️ Typo / Grammar Error", desc: "Contains spelling or grammatical mistakes." },
  { id: "BROKEN_IMAGE", label: "🖼️ Broken / Missing Image", desc: "An image is missing or not loading." },
  { id: "AMBIGUOUS", label: "❓ Ambiguous / Unclear", desc: "The question or choices are confusing or vague." },
  { id: "OTHER", label: "📝 Other", desc: "Another issue not listed above." },
];

interface FlagQuestionButtonProps {
  questionId: string;
  compact?: boolean;
}

export default function FlagQuestionButton({ questionId, compact = false }: FlagQuestionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/questions/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          reason: selectedReason,
          notes: notes.trim() || null,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setIsOpen(false);
          setSubmitted(false);
          setSelectedReason(null);
          setNotes("");
        }, 2000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to submit flag.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Flag an issue with this question"
        className={`flex items-center gap-1.5 transition cursor-pointer rounded-lg font-bold ${
          compact
            ? "px-2 py-1 text-[10px] text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20"
            : "px-3 py-1.5 text-xs text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/30"
        }`}
      >
        <span>🚩</span>
        <span>{compact ? "Flag" : "Flag Issue"}</span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl animate-fade-in">
            {submitted ? (
              <div className="text-center py-6 space-y-3">
                <span className="text-4xl block">✅</span>
                <p className="text-white font-black text-base">Flag Submitted!</p>
                <p className="text-xs text-slate-400">Thank you. Our admin team will review this question.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-white">🚩 Report an Issue</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Help us improve by flagging errors in this question.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-slate-500 hover:text-white text-xl leading-none cursor-pointer transition"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Select a reason</p>
                  {FLAG_REASONS.map((reason) => (
                    <button
                      key={reason.id}
                      type="button"
                      onClick={() => setSelectedReason(reason.id)}
                      className={`w-full p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                        selectedReason === reason.id
                          ? "bg-amber-500/15 border-amber-500/50 text-white"
                          : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <span className="text-xs font-bold">{reason.label}</span>
                      <span className="text-[11px] text-slate-400">{reason.desc}</span>
                    </button>
                  ))}
                </div>

                {selectedReason === "OTHER" && (
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Describe the issue briefly..."
                    rows={3}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition resize-none"
                  />
                )}

                {error && (
                  <p className="text-xs text-rose-400 font-medium">⚠️ {error}</p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!selectedReason || submitting}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit Flag 🚩"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
