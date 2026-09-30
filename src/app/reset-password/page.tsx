"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!token) {
      setError("Missing reset token from URL link.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage("Password updated! Redirecting to login...");
        redirectTimerRef.current = setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        setError(data.error || "Failed to reset password.");
      }
    } catch (err: unknown) {
      console.error("Password reset error:", err);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl text-white">
        <div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
            Set New Credentials
          </span>
          <h1 className="text-2xl font-black mt-2">Reset Password</h1>
          <p className="text-xs text-slate-400 mt-1">Enter your new account password below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="new-password-input"
              className="block text-xs font-bold uppercase text-slate-400 mb-1"
            >
              New Password
            </label>
            <input
              id="new-password-input"
              type="password"
              required
              minLength={8}
              placeholder="Minimum 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3.5 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-blue-500 text-white font-medium"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password-input"
              className="block text-xs font-bold uppercase text-slate-400 mb-1"
            >
              Confirm New Password
            </label>
            <input
              id="confirm-password-input"
              type="password"
              required
              minLength={8}
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3.5 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-blue-500 text-white font-medium"
            />
          </div>

          {message && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold">
              {message}
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Updating Password..." : "Update Password"}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800">
          <Link href="/login" className="text-xs text-slate-400 hover:text-white font-bold transition">
            &larr; Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white p-8">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}