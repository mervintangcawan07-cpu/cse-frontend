// Relative Path: src/app/partner-portal/forgot-password/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  ArrowRight,
  Building2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";

export default function PartnerForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/partner/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });

      const json = await res.json();
      setMsg(
        json.message ||
          "If an eligible partner account matches the information provided, password reset instructions will be sent to the registered email."
      );
      setSubmitted(true);
    } catch {
      setMsg(
        "If an eligible partner account matches the information provided, password reset instructions will be sent to the registered email."
      );
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950">
      <header className="border-b border-slate-800/80 bg-slate-950/80 py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/brand/govstudyx-icon.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 object-contain"
            />
            <div className="font-extrabold text-sm tracking-tight text-white">
              GovStudyX <span className="text-emerald-400 text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 font-mono">RECOVERY</span>
            </div>
          </Link>

          <Link href="/partner-portal/login" className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-white">Reset Partner Password</h1>
            <p className="text-xs text-slate-400">
              Enter your registered Email or Partner ID (e.g. PT-000123). Reset instructions will be delivered strictly to the verified contact email.
            </p>
          </div>

          {submitted ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Request Received</span>
                </div>
                <p className="leading-relaxed">{msg}</p>
              </div>

              <Link
                href="/partner-portal/login"
                className="block text-center w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
              >
                Return to Partner Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                  Registered Email or Partner ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PT-000123 or partner@email.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                <span>{loading ? "Sending Instructions..." : "Send Reset Instructions"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-slate-800 text-center space-y-2">
            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>GovStudyX Enterprise Partner Network</span>
            </p>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-600 border-t border-slate-900">
        &copy; {new Date().getFullYear()} GovStudyX Partner Portal. Protected by enterprise security.
      </footer>
    </div>
  );
}
