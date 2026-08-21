"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function SignupForm() {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  // Capture referral code from URL search param e.g. ?ref=GSX-ABC123 or localStorage fallback
  useEffect(() => {
    let effectiveCode = searchParams.get("ref")?.trim();
    if (!effectiveCode && typeof window !== "undefined" && window.localStorage) {
      effectiveCode = localStorage.getItem("cse_ref") || localStorage.getItem("cse_partner_ref") || "";
    }

    if (effectiveCode) {
      const cleanCode = effectiveCode.trim();
      setReferralCode(cleanCode);

      // Validate referral code
      fetch(`/api/referral/validate-code?code=${encodeURIComponent(cleanCode)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.isValid) {
            setInviterName(data.inviterName || "A fellow GovStudyX student");
          }
        })
        .catch(() => null);
    }
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          referralCode: referralCode || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setRegisteredEmail(email);
      } else {
        setError(data.error || "Failed to create account.");
      }
    } catch (err) {
      setError("Error connecting to registration server.");
    } finally {
      setLoading(false);
    }
  };

  // 🎉 Post-Registration Confirmation View
  if (registeredEmail) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl text-white">
          <div className="text-4xl">📧</div>
          <div>
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
              Check Your Inbox
            </span>
            <h1 className="text-2xl font-black mt-2">Verification Email Sent!</h1>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            We have dispatched a verification link to <strong className="text-white">{registeredEmail}</strong>. Please open your email and click the button to activate your account.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-block w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition"
            >
              {"Go to Sign In →"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl text-white">
        <div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
            Get Started
          </span>
          <h1 className="text-2xl font-black mt-2">Create Student Account</h1>
          <p className="text-xs text-slate-400 mt-1">
            Start reviewing for the Civil Service Exam today.
          </p>
        </div>

        {/* 🎁 Referral Invitation Welcome Banner */}
        {referralCode && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-left">
            <span className="text-2xl">🎁</span>
            <div className="text-xs">
              <div className="font-bold text-emerald-400">
                You were invited to GovStudyX!
              </div>
              <div className="text-slate-300 text-[11px]">
                {inviterName ? `Invited by ${inviterName}.` : "Referral code applied:"}{" "}
                <span className="font-mono text-emerald-300 font-bold">{referralCode}</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              placeholder="Juan Dela Cruz"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3.5 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-blue-500 text-white font-medium"
            />
          </div>

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
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="Minimum 8 characters"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Creating Account..." : "Register & Send Verification Link"}
          </button>

          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="text-blue-400 underline font-semibold hover:text-blue-300">
              Terms &amp; Conditions
            </Link>{" "}
            and acknowledge our{" "}
            <Link href="/privacy" className="text-blue-400 underline font-semibold hover:text-blue-300">
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        <div className="text-center pt-2 border-t border-slate-800">
          <p className="text-xs text-slate-400">
            {"Already have an account? "}
            <Link href="/login" className="text-blue-400 font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-bold">
          Loading registration...
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}