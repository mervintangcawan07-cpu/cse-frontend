"use client";

import { useState } from "react";

interface User {
  id: string;
  name?: string | null;
  email: string;
  isBanned?: boolean;
  banReason?: string | null;
}

interface UserActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  mode: "BAN" | "UNBAN" | "RESET_PASSWORD" | null;
  onSuccess: () => void;
}

export default function UserActionModal({
  isOpen,
  onClose,
  user,
  mode,
  onSuccess,
}: UserActionModalProps) {
  const [banReason, setBanReason] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen || !user || !mode) return null;

  const handleSubmit = async (e: React.FormEvent) => {
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
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-5">
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h2 className="text-lg font-black text-slate-900">
            {mode === "BAN" && "🚨 Ban User Account"}
            {mode === "UNBAN" && "✅ Unban User Account"}
            {mode === "RESET_PASSWORD" && "🔑 Reset Password"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* User Target Info */}
        <p className="text-xs text-slate-600 font-medium">
          Target User: <strong className="text-slate-900">{user.email}</strong>
        </p>

        {/* Action Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "BAN" && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Reason for Ban
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Explain reason for account suspension..."
                rows={3}
                required
                className="w-full p-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-red-500 transition"
              />
            </div>
          )}

          {mode === "RESET_PASSWORD" && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                New Administrative Password
              </label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter at least 6 characters..."
                minLength={6}
                required
                className="w-full p-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 transition font-mono"
              />
            </div>
          )}

          {mode === "UNBAN" && (
            <p className="text-xs text-slate-500">
              Are you sure you want to restore full platform access for this user?
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2 text-white font-black text-xs rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer ${
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