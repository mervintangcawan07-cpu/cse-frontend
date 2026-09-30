"use client";

import { useState, type SyntheticEvent } from "react";
import Link from "next/link";

interface ForgotPasswordApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data: ForgotPasswordApiResponse = await res.json();

      if (res.ok && data.success) {
        setMessage(data.message || "Password reset instructions have been sent to your email.");
      } else {
        setError(data.error || "Failed to process request.");
      }
    } catch (err: unknown) {
      console.error("Forgot password request error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl text-white">
        <div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
            Account Security
          </span>
          <h1 className="text-2xl font-black mt-2">Forgot Password?</h1>
          <p className="text-xs text-slate-400 mt-1">
            Enter your registered email address to receive a password reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="forgot-password-email"
              className="block text-xs font-bold uppercase text-slate-400 mb-1"
            >
              Email Address
            </label>
            <input
              id="forgot-password-email"
              type="email"
              autoComplete="email"
              required
              placeholder="e.g., juan@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {loading ? "Sending Link..." : "Send Password Reset Link"}
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