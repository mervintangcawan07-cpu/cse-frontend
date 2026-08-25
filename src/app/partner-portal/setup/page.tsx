// Relative Path: src/app/partner-portal/setup/page.tsx
"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Building2,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";

function SetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [partnerInfo, setPartnerInfo] = useState<any | null>(null);
  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setVerifyError("No setup token provided. Please use the link sent to your email.");
      return;
    }

    async function verifyToken() {
      try {
        const res = await fetch(`/api/partner/auth/setup?token=${token}`);
        const json = await res.json();
        if (res.ok && json.success) {
          setPartnerInfo(json.partner);
        } else {
          setVerifyError(json.error || "Invalid or expired setup token.");
        }
      } catch {
        setVerifyError("Network error. Please try again.");
      } finally {
        setVerifying(false);
      }
    }

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/partner/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setSuccessMsg(json.message);
        setTimeout(() => {
          router.push("/partner-portal/dashboard");
        }, 2000);
      } else {
        setFormError(json.error || "Failed to activate partner account.");
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (verifying) {
    return (
      <div className="text-center space-y-3 py-12">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Verifying partner invitation...</p>
      </div>
    );
  }

  if (verifyError) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Setup Link Expired or Invalid</h2>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">{verifyError}</p>
        <Link
          href="/partner-portal/login"
          className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl text-white transition"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
          <Building2 className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-white">Activate Partner Account</h1>
        <p className="text-xs text-slate-400">
          Welcome, <strong className="text-emerald-400">{partnerInfo?.name}</strong>! Your Partner ID is{" "}
          <strong className="font-mono text-emerald-400">{partnerInfo?.partnerId}</strong>. Create your password below.
        </p>
      </div>

      {formError && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs font-semibold text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs font-semibold text-emerald-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg} Redirecting to dashboard...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
            Create Password (Min. 8 characters)
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3.5 pr-11 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
            Confirm Password
          </label>
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition font-mono"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
        >
          <span>{submitting ? "Activating Account..." : "Activate Account & Sign In"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

export default function PartnerSetupPage() {
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
              GovStudyX <span className="text-emerald-400 text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 font-mono">ONBOARDING</span>
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <Suspense fallback={<div className="text-center text-xs text-slate-400">Loading setup...</div>}>
            <SetupForm />
          </Suspense>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-600 border-t border-slate-900">
        &copy; {new Date().getFullYear()} GovStudyX Partner Portal. Protected by enterprise security.
      </footer>
    </div>
  );
}
