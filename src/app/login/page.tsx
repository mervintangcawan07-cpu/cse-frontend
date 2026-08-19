"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUnverified, setIsUnverified] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIsUnverified(false);
    setResendMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      // Handle Unverified Email Gate (403 Status)
      if (res.status === 403 && data.unverified) {
        setIsUnverified(true);
        setUnverifiedEmail(data.email || email);
        setError("Please verify your email address before logging in.");
        return;
      }

      if (res.ok) {
        if (data.user?.name) {
          localStorage.setItem("cse_user_name", data.user.name);
        }

        // Full window navigation ensures newly set auth cookie attaches immediately to request headers
        const targetUrl = data.user?.role === "ADMIN" ? "/admin/questions" : "/dashboard";
        window.location.href = targetUrl;
      } else {
        setError(data.error || "Invalid email or password.");
      }
    } catch (err) {
      setError("Failed to connect to authentication server.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    setResendMessage(null);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResendMessage("A new verification link has been sent to your email!");
      } else {
        setResendMessage(data.error || "Failed to resend link.");
      }
    } catch (err) {
      setResendMessage("Failed to connect to email server.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl text-white">
        <div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
            Welcome Back
          </span>
          <h1 className="text-2xl font-black mt-2">Sign In to Your Account</h1>
          <p className="text-xs text-slate-400 mt-1">Access your mock exams and study analytics.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="juan@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3.5 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-blue-500 text-white font-medium"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold uppercase text-slate-400">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-blue-400 hover:underline font-bold">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3.5 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-blue-500 text-white font-medium"
            />
          </div>

          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          {/* 📧 Unverified Alert & Resend Link Trigger */}
          {isUnverified && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
              <p className="text-xs text-amber-300 font-medium leading-relaxed">
                📩 We sent a verification link to <strong className="text-white">{unverifiedEmail}</strong>. Please check your inbox and click the link to activate your account.
              </p>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs rounded-xl transition disabled:opacity-50 cursor-pointer"
              >
                {resending ? "Sending New Link..." : "🔄 Resend Verification Email"}
              </button>
            </div>
          )}

          {resendMessage && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold">
              {resendMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800 space-y-2">
          <p className="text-xs text-slate-400">
            {"Don't have an account? "}
            <Link href="/signup" className="text-blue-400 font-bold hover:underline">
              Register here
            </Link>
          </p>
          <div className="flex justify-center items-center gap-3 text-[11px] text-slate-500">
            <Link href="/terms" className="hover:text-slate-300 transition">
              Terms
            </Link>
            <span>&bull;</span>
            <Link href="/privacy" className="hover:text-slate-300 transition">
              Privacy
            </Link>
            <span>&bull;</span>
            <Link href="/contact" className="hover:text-slate-300 transition">
              Help
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}