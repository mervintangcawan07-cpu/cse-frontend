"use client";

import React, { useState } from "react";

interface User {
  readonly id: string;
  readonly name?: string | null;
  readonly email: string;
  readonly isBanned?: boolean;
  readonly banReason?: string | null;
}

interface UserActionModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly user: User | null;
  readonly mode: "BAN" | "UNBAN" | "RESET_PASSWORD" | null;
  readonly onSuccess: () => void;
}

export default function UserActionModal({
  isOpen,
  onClose,
  user,
  mode,
  onSuccess,
}: Readonly<UserActionModalProps>) {
  const [banReason, setBanReason] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen || !user || !mode) return null;

  // Uses React.SyntheticEvent to eliminate the deprecated FormEvent warning
  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/admin/users/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          userId: user.id,
          banReason,
          newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Action executed successfully.");
        onSuccess();
        onClose();
      } else {
        alert(data.error || "Action failed.");
      }
    } catch (err) {
      console.error("User moderation action error:", err);
      alert("An error occurred while performing this action.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl md:p-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-black text-slate-900">
            {mode === "BAN" && "🚨 Ban User Account"}
            {mode === "UNBAN" && "✅ Unban User Account"}
            {mode === "RESET_PASSWORD" && "🔑 Reset Password"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-lg font-bold text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* User Target Info */}
        <p className="text-xs font-medium text-slate-600">
          Target User: <strong className="text-slate-900">{user.email}</strong>
        </p>

        {/* Action Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "BAN" && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase text-slate-700">
                Reason for Ban
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Explain reason for account suspension..."
                rows={3}
                required
                className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none transition focus:border-red-500"
              />
            </div>
          )}

          {mode === "RESET_PASSWORD" && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase text-slate-700">
                New Administrative Password
              </label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter at least 6 characters..."
                minLength={6}
                required
                className="w-full rounded-xl border border-slate-200 p-3 font-mono text-xs outline-none transition focus:border-blue-500"
              />
            </div>
          )}

          {mode === "UNBAN" && (
            <p className="text-xs text-slate-500">
              Are you sure you want to restore full platform access for this user?
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`cursor-pointer rounded-xl px-5 py-2 text-xs font-black text-white shadow-md transition disabled:opacity-50 ${
                mode === "BAN" ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {loading ? "Processing..." : "Confirm Action"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}