// Relative Path: src/components/social/commons/PostComposerModal.tsx
"use client";

import React, { useState } from "react";

export type PostTopic = "QUESTION_HELP" | "EXAM_INTEL" | "MINDSET_VENT" | "STUDY_HACKS";

interface PostComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (post: any) => void;
}

const TOPIC_OPTIONS: { id: PostTopic; label: string; icon: string; desc: string; color: string }[] = [
  {
    id: "QUESTION_HELP",
    label: "Question Help",
    icon: "❓",
    desc: "Tricky Math, Verbal, or Logic problems needing solutions",
    color: "bg-blue-500/10 text-blue-600 border-blue-300",
  },
  {
    id: "EXAM_INTEL",
    label: "Exam Intel",
    icon: "📢",
    desc: "CSC official updates, testing center news, requirements",
    color: "bg-amber-500/10 text-amber-700 border-amber-300",
  },
  {
    id: "MINDSET_VENT",
    label: "Mindset & Vent",
    icon: "☕",
    desc: "Study fatigue, exam anxiety, peer pep talks, and encouragement",
    color: "bg-rose-500/10 text-rose-600 border-rose-300",
  },
  {
    id: "STUDY_HACKS",
    label: "Study Hacks",
    icon: "💡",
    desc: "Mnemonics, speed-reading tips, formulas & shortcut techniques",
    color: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  },
];

export const PostComposerModal: React.FC<PostComposerModalProps> = ({
  isOpen,
  onClose,
  onPostCreated,
}) => {
  const [topic, setTopic] = useState<PostTopic>("QUESTION_HELP");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hasSpoiler, setHasSpoiler] = useState(false);
  const [spoilerContent, setSpoilerContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError("Please enter what you want to share.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          title: title.trim() || undefined,
          content: content.trim(),
          hasSpoiler,
          spoilerContent: hasSpoiler ? spoilerContent.trim() : undefined,
          isAnonymous,
        }),
      });

      const data = await res.json();
      if (res.ok && data.post) {
        onPostCreated(data.post);
        // Reset form
        setTitle("");
        setContent("");
        setHasSpoiler(false);
        setSpoilerContent("");
        setIsAnonymous(false);
        onClose();
      } else {
        setError(data.error || "Failed to publish post.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error while creating post.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60">
          <div>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-purple-100 text-purple-700 rounded-md">
              CSE Study Commons
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1">
              Create Study Commons Post
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 flex items-center justify-center text-xs font-black text-slate-600 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
              {error}
            </div>
          )}

          {/* Topic Selector */}
          <div>
            <label className="block text-xs font-extrabold uppercase text-slate-700 mb-2">
              Select Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TOPIC_OPTIONS.map((opt) => {
                const isSelected = topic === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTopic(opt.id)}
                    className={`p-2.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-base sm:text-lg mb-1">{opt.icon}</span>
                    <span className="text-xs font-black leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title (Optional) */}
          <div>
            <label className="block text-xs font-extrabold uppercase text-slate-700 mb-1">
              Title <span className="text-slate-400 font-medium lowercase">(optional)</span>
            </label>
            <input
              type="text"
              placeholder={
                topic === "QUESTION_HELP"
                  ? "e.g. Tricky Work Rate / Speed-Time problem from 2025 Mock Exam"
                  : topic === "EXAM_INTEL"
                  ? "e.g. CSC Region 7 School Assignment updates"
                  : topic === "MINDSET_VENT"
                  ? "e.g. Feeling overwhelmed with Math formulas..."
                  : "e.g. 5-second trick for percentage discounts"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              maxLength={150}
            />
          </div>

          {/* Main Content */}
          <div>
            <label className="block text-xs font-extrabold uppercase text-slate-700 mb-1">
              Post Content
            </label>
            <textarea
              rows={5}
              placeholder={
                topic === "QUESTION_HELP"
                  ? "Type your question here. Include choices (A, B, C, D) if available..."
                  : topic === "MINDSET_VENT"
                  ? "Express your thoughts, fatigue, or ask peers for encouragement..."
                  : "Write your study tips, advice, or announcement details..."
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition leading-relaxed"
              required
            />
          </div>

          {/* Interactive Spoiler Solution Box Toggle (Great for Q&A practice!) */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasSpoiler}
                  onChange={(e) => setHasSpoiler(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                />
                <span className="text-xs font-black text-amber-900">
                  🔒 Add Hidden Solution / Answer Key (Spoiler Box)
                </span>
              </label>
              <span className="text-[10px] text-amber-700 font-semibold hidden sm:inline">
                Peers can try solving before revealing
              </span>
            </div>

            {hasSpoiler && (
              <textarea
                rows={3}
                placeholder="Enter the correct answer and step-by-step solution here. This will be hidden behind a 'Reveal Solution' button on your post."
                value={spoilerContent}
                onChange={(e) => setSpoilerContent(e.target.value)}
                className="w-full p-3 bg-white border border-amber-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition leading-relaxed"
              />
            )}
          </div>

          {/* Anonymous Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
              />
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-800">
                  🎭 Post as "Anonymous Examinee"
                </span>
                <span className="text-[10px] text-slate-500">
                  Your name and avatar will be hidden to protect your privacy.
                </span>
              </div>
            </label>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Publishing..." : "Publish to Commons 🚀"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
