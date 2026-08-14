// Relative Path: src/components/social/rooms/ActiveTopicCard.tsx
"use client";

import { useState } from "react";

interface ActiveTopicCardProps {
  topicType: "QUESTION" | "IMAGE" | null;
  questionMeta?: {
    id?: string;
    category?: string;
    subtopic?: string;
    prompt?: string;
    options?: string[];
    imageUrl?: string | null;
    selectedAt?: string;
  } | null;
  topicImage?: string | null;
  topicMeta?: {
    title?: string;
    uploadedAt?: string;
  } | null;
  isHost?: boolean;
  onChangeTopic?: () => void;
  onRemoveTopic?: () => void;
}

export function ActiveTopicCard({
  topicType,
  questionMeta,
  topicImage,
  topicMeta,
  isHost = false,
  onChangeTopic,
  onRemoveTopic,
}: ActiveTopicCardProps) {
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (!topicType) return null;

  const handleRemove = async () => {
    if (!onRemoveTopic || removing) return;
    if (confirm("Are you sure you want to remove the current study topic from this session?")) {
      setRemoving(true);
      try {
        await onRemoveTopic();
      } finally {
        setRemoving(false);
      }
    }
  };

  return (
    <div className="w-full bg-slate-950/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 relative overflow-hidden animate-fade-in">
      {/* BACKGROUND ACCENT GLOW */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOPIC HEADER RIBBON */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800/80 pb-3.5 relative z-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
            <span>📌</span>
            <span>Current Study Topic</span>
          </span>

          {topicType === "QUESTION" && questionMeta && (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 rounded-full truncate max-w-[150px]">
                {questionMeta.category || "General"}
              </span>
              {questionMeta.subtopic && (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full truncate max-w-[160px]">
                  {questionMeta.subtopic}
                </span>
              )}
            </>
          )}

          {topicType === "IMAGE" && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
              <span>🖼️</span>
              <span>Reviewer Material</span>
            </span>
          )}
        </div>

        {/* HOST TOPIC ACTIONS */}
        {isHost && (
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onChangeTopic && (
              <button
                type="button"
                onClick={onChangeTopic}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-1"
                title="Change active study topic"
              >
                <span>🔄</span>
                <span>Change Topic</span>
              </button>
            )}

            {onRemoveTopic && (
              <button
                type="button"
                disabled={removing}
                onClick={handleRemove}
                className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                title="Remove study topic from room"
              >
                <span>🗑️</span>
                <span>{removing ? "Removing..." : "Remove"}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* TOPIC CONTENT: QUESTION DISPLAY */}
      {topicType === "QUESTION" && questionMeta && (
        <div className="space-y-4 relative z-10">
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-inner">
            <h4 className="text-sm sm:text-base font-extrabold text-white leading-relaxed">
              {questionMeta.prompt}
            </h4>
          </div>

          {/* QUESTION CHOICES GRID */}
          {Array.isArray(questionMeta.options) && questionMeta.options.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block px-1">
                Answer Choices (Discussion Mode)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {questionMeta.options.map((optionText, idx) => {
                  const letters = ["A", "B", "C", "D", "E"];
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-slate-900/90 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs flex items-start gap-2.5 transition"
                    >
                      <span className="w-5 h-5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                        {letters[idx] || `${idx + 1}`}
                      </span>
                      <span className="text-slate-200 font-medium leading-relaxed">{optionText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p-3 bg-blue-950/30 border border-blue-500/20 rounded-xl flex items-center gap-2 text-xs text-blue-300">
            <span>💡</span>
            <span>
              <strong>Group Study Mode:</strong> Correct answer is kept hidden so the group can discuss, share solutions, and compare logic!
            </span>
          </div>
        </div>
      )}

      {/* TOPIC CONTENT: UPLOADED IMAGE DISPLAY */}
      {topicType === "IMAGE" && topicImage && (
        <div className="space-y-3 relative z-10">
          {topicMeta?.title && (
            <h4 className="text-sm font-black text-white px-1 flex items-center gap-2">
              <span>📄</span>
              <span>{topicMeta.title}</span>
            </h4>
          )}

          <div className="relative group bg-slate-900 border border-slate-800 rounded-2xl p-2 overflow-hidden flex items-center justify-center min-h-[260px] max-h-[420px]">
            <img
              src={topicImage}
              alt={topicMeta?.title || "Study Topic Material"}
              className="max-h-[400px] w-auto max-w-full object-contain rounded-xl shadow-lg cursor-pointer transition transform group-hover:scale-[1.01]"
              onClick={() => setIsImageExpanded(true)}
            />

            <button
              type="button"
              onClick={() => setIsImageExpanded(true)}
              className="absolute bottom-4 right-4 px-3 py-1.5 bg-slate-950/80 hover:bg-slate-900 text-white text-xs font-bold rounded-xl border border-slate-700 shadow-xl opacity-90 hover:opacity-100 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>🔍</span>
              <span>Click to Zoom</span>
            </button>
          </div>
        </div>
      )}

      {/* EXPANDED FULLSCREEN IMAGE MODAL */}
      {isImageExpanded && topicImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={() => setIsImageExpanded(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] p-2 bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-3 border-b border-slate-800 text-xs text-white">
              <span className="font-bold truncate">{topicMeta?.title || "Uploaded Material"}</span>
              <button
                onClick={() => setIsImageExpanded(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2 flex items-center justify-center">
              <img
                src={topicImage}
                alt="Full Material View"
                className="max-h-[80vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
