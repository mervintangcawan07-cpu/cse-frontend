"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Missing verification token.");
      return;
    }

    async function verify() {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Failed to verify email.");
        }
      } catch (err) {
        setStatus("error");
        setErrorMessage("An unexpected error occurred during verification.");
      }
    }

    verify();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl text-white">
        {status === "loading" && (
          <div className="space-y-3">
            <div className="text-3xl animate-bounce">⚡</div>
            <h1 className="text-xl font-black">Verifying Your Email...</h1>
            <p className="text-xs text-slate-400">Please wait a moment while we confirm your credentials.</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="text-4xl">🎉</div>
            <h1 className="text-2xl font-black text-emerald-400">Email Verified!</h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your account is now fully active. You can log in and start reviewing for the Civil Service Exam.
            </p>
            <Link
              href="/login"
              className="inline-block w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition"
            >
              {"Proceed to Login →"}
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="text-4xl">❌</div>
            <h1 className="text-xl font-black text-rose-400">Verification Failed</h1>
            <p className="text-xs text-slate-400">{errorMessage}</p>
            <Link
              href="/login"
              className="inline-block w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
            >
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-bold text-xs">
          Loading...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}