// Relative Path: src/components/social/ChallengeDuelModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ClassmateItem {
  id: string;
  name: string;
  isOnline?: boolean;
}

interface ChallengeDuelModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTargetId?: string;
  defaultTargetName?: string;
}

export default function ChallengeDuelModal({
  isOpen,
  onClose,
  defaultTargetId,
  defaultTargetName,
}: ChallengeDuelModalProps) {
  const router = useRouter();
  const [classmates, setClassmates] = useState<ClassmateItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(defaultTargetId || "");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (defaultTargetId) {
        setSelectedUserId(defaultTargetId);
      }
      setLoading(true);
      fetch("/api/social/classmates?type=connected")
        .then((r) => r.json())
        .then((data) => {
          if (data.classmates) {
            const items = data.classmates.map((c: any) => {
              const u = c.user || c;
              return {
                id: u.id,
                name: u.name || u.studyProfile?.displayName || "Examinee",
                isOnline: u.isOnline,
              };
            });
            setClassmates(items);
            if (!defaultTargetId && items.length > 0) {
              setSelectedUserId(items[0].id);
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen, defaultTargetId]);

  if (!isOpen) return null;

  const handleSendChallenge = async () => {
    if (!selectedUserId) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/duels/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: selectedUserId }),
      });

      const data = await res.json();
      if (res.ok && data.match) {
        onClose();
        router.push(`/duels?matchId=${data.match.id}`);
      } else {
        setError(data.error || "Failed to challenge classmate.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-white">⚔️ Challenge Classmate 1v1</h3>
            <p className="text-xs text-slate-400 mt-0.5">Send a 5-question speed duel challenge.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white text-xl leading-none transition"
          >
            ×
          </button>
        </div>

        {defaultTargetName ? (
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <div>
              <p className="text-xs font-bold text-slate-400">Target Opponent:</p>
              <p className="text-sm font-black text-white">{defaultTargetName}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Select Connected Classmate
            </label>
            {loading ? (
              <div className="py-4 text-center text-xs text-slate-500 font-bold animate-pulse">
                Loading classmates...
              </div>
            ) : classmates.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center bg-slate-950 border border-slate-800 rounded-xl">
                No connected classmates yet. Connect with examinees in the Study Hub first!
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {classmates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedUserId(c.id)}
                    className={`w-full p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                      selectedUserId === c.id
                        ? "bg-amber-500/15 border-amber-500/50 text-white font-bold"
                        : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-xs font-bold">{c.name}</span>
                    <span className="text-[10px] font-bold text-emerald-400">
                      {c.isOnline ? "🟢 Online" : "⚪ Offline"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-rose-400 font-medium">⚠️ {error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSendChallenge}
            disabled={!selectedUserId || submitting}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Send Challenge ⚔️"}
          </button>
        </div>
      </div>
    </div>
  );
}
