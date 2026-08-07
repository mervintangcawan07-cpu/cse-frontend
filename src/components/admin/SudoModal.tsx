// Relative Path: src/components/admin/SudoModal.tsx
"use client";

import React, { useState } from "react";

interface SudoModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SudoModal({ isOpen, onSuccess, onCancel }: SudoModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/sudo/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setPassword("");
        onSuccess();
      } else {
        setError(data.error || "Invalid password. Please try again.");
      }
    } catch {
      setError("Network error verifying password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-lg font-black">
            🔒
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Sudo Mode Required</h2>
            <p className="text-xs text-slate-400">Confirm your password to proceed with this high-risk action.</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your account password"
              required
              autoFocus
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white text-xs focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Confirm Sudo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
