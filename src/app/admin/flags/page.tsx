// Relative Path: src/app/admin/flags/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FormattedPrompt from "@/components/FormattedPrompt";

const REASON_LABELS: Record<string, string> = {
  WRONG_ANSWER: "❌ Wrong Answer Key",
  TYPO_GRAMMAR: "✏️ Typo / Grammar",
  BROKEN_IMAGE: "🖼️ Broken Image",
  AMBIGUOUS: "❓ Ambiguous",
  OTHER: "📝 Other",
};

interface FlagEntry {
  questionId: string;
  flagCount: number;
  question: {
    id: string;
    category: string;
    subtopic: string;
    prompt: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    options?: string[];
    answerIndex: number;
    explanation?: string;
    deletedAt?: string | null;
    flags: {
      id: string;
      reason: string;
      notes?: string;
      createdAt: string;
      user: { name: string; email: string };
    }[];
  } | null;
}

export default function AdminFlagsPage() {
  const router = useRouter();
  const [flags, setFlags] = useState<FlagEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [actioning, setActioning] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/flags?status=${statusFilter}`);
      if (res.status === 403) {
        router.push("/dashboard");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setFlags(data.flags || []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, router]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleAction = async (questionId: string, action: string) => {
    setActioning(questionId + action);
    try {
      const res = await fetch("/api/admin/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, action }),
      });
      if (res.ok) {
        await fetchFlags();
      }
    } finally {
      setActioning(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Link href="/admin" className="text-xs text-slate-400 hover:text-white transition">
              ← Admin Portal
            </Link>
          </div>
          <h1 className="text-2xl font-black text-white">🚩 Question Flag Queue</h1>
          <p className="text-xs text-slate-400 mt-1">
            Review and action question issues flagged by examinees.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2">
          {["PENDING", "DISMISSED", "RESOLVED"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                statusFilter === s
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Flag List */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 font-bold animate-pulse">
          Loading flagged questions...
        </div>
      ) : flags.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <span className="text-4xl block">✅</span>
          <p className="text-sm font-bold text-white">No {statusFilter.toLowerCase()} flags</p>
          <p className="text-xs text-slate-400">
            {statusFilter === "PENDING"
              ? "All flagged questions have been reviewed."
              : "No flags with this status yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {flags.map((entry) => {
            const q = entry.question;
            if (!q) return null;
            const isExpanded = expandedId === entry.questionId;
            const options =
              Array.isArray(q.options) && q.options.length > 0
                ? q.options
                : [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean) as string[];
            const optionLetters = ["A", "B", "C", "D", "E"];
            const reasonCounts: Record<string, number> = {};
            q.flags.forEach((f) => {
              reasonCounts[f.reason] = (reasonCounts[f.reason] || 0) + 1;
            });

            return (
              <div
                key={entry.questionId}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
              >
                {/* Summary Row */}
                <div className="p-5 flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-md border border-amber-500/30">
                        🚩 {entry.flagCount} Report{entry.flagCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 text-slate-400 rounded-md">
                        {q.category}
                      </span>
                      {q.subtopic && (
                        <span className="text-[10px] text-slate-500 font-medium">{q.subtopic}</span>
                      )}
                      {q.deletedAt && (
                        <span className="text-[10px] font-black px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded-md border border-rose-500/30">
                          🗑️ Soft-Deleted
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-white font-medium line-clamp-2 leading-relaxed">
                      {q.prompt}
                    </p>

                    {/* Reason Breakdown */}
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(reasonCounts).map(([reason, count]) => (
                        <span
                          key={reason}
                          className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md"
                        >
                          {REASON_LABELS[reason] || reason} ×{count}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-start gap-2 shrink-0 flex-wrap sm:flex-col">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : entry.questionId)}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      {isExpanded ? "▲ Collapse" : "▼ Inspect"}
                    </button>
                    {statusFilter === "PENDING" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAction(entry.questionId, "DISMISS")}
                          disabled={actioning === entry.questionId + "DISMISS"}
                          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                        >
                          ✅ Dismiss
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAction(entry.questionId, "RESOLVE")}
                          disabled={actioning === entry.questionId + "RESOLVE"}
                          className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                        >
                          ✏️ Resolve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Soft-delete this question? It will be removed from all exams.")) {
                              handleAction(entry.questionId, "DELETE_QUESTION");
                            }
                          }}
                          disabled={actioning === entry.questionId + "DELETE_QUESTION" || Boolean(q.deletedAt)}
                          className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/30 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                        >
                          🗑️ Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-slate-800 p-5 space-y-4 bg-slate-950/40">
                    {/* Full Question */}
                    <div className="space-y-3">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Full Question</p>
                      <FormattedPrompt text={q.prompt} className="text-sm text-white font-medium leading-relaxed" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {options.map((opt, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2 ${
                              idx === q.answerIndex
                                ? "bg-emerald-600/15 border-emerald-500/40 text-emerald-300"
                                : "bg-slate-900 border-slate-800 text-slate-300"
                            }`}
                          >
                            <span className="font-black shrink-0">{optionLetters[idx]}.</span>
                            <span>{opt}</span>
                            {idx === q.answerIndex && (
                              <span className="ml-auto shrink-0 text-emerald-400 font-black">✓</span>
                            )}
                          </div>
                        ))}
                      </div>
                      {q.explanation && (
                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300">
                          <strong className="text-slate-200">Explanation:</strong> {q.explanation}
                        </div>
                      )}
                    </div>

                    {/* Individual Reports */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                        Individual Reports ({q.flags.length})
                      </p>
                      {q.flags.map((flag) => (
                        <div key={flag.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white">
                              {REASON_LABELS[flag.reason] || flag.reason}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {flag.user.name} · {new Date(flag.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {flag.notes && (
                            <p className="text-xs text-slate-400 italic">&quot;{flag.notes}&quot;</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Edit Link */}
                    <div className="flex justify-end">
                      <Link
                        href={`/admin/questions?edit=${q.id}`}
                        className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 text-xs font-bold rounded-xl transition"
                      >
                        ✏️ Edit This Question in Admin Panel →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
