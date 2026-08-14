// Relative Path: src/components/common/PaymentConfirmationLoader.tsx
"use client";

import React, { useEffect, useState } from "react";

interface PaymentConfirmationLoaderProps {
  isOpen: boolean;
  onComplete?: () => void;
}

export default function PaymentConfirmationLoader({
  isOpen,
}: PaymentConfirmationLoaderProps) {
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      return;
    }

    const t1 = setTimeout(() => setStep(2), 1200);
    const t2 = setTimeout(() => setStep(3), 2600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Animated Icon & Radar Rings */}
        <div className="relative flex items-center justify-center pt-2">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping" />
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-3xl shadow-inner">
              💳
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-950 border border-emerald-400 flex items-center justify-center">
              <svg
                className="animate-spin h-3.5 w-3.5 text-emerald-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/30 inline-block">
            PayMongo Verification in Progress
          </span>
          <h2 className="text-xl font-black text-white">
            Confirming Payment & Unlocking PRO
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            Please keep this window open while we verify your transaction and sync your account entitlements.
          </p>
        </div>

        {/* Step Progress Tracker */}
        <div className="space-y-2.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 text-left">
          <div className="flex items-center gap-3 text-xs">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              step >= 1 ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
            }`}>
              {step > 1 ? "✓" : "1"}
            </span>
            <span className={step >= 1 ? "text-slate-200 font-bold" : "text-slate-500"}>
              Contacting PayMongo Gateway
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              step >= 2 ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
            }`}>
              {step > 2 ? "✓" : "2"}
            </span>
            <span className={step >= 2 ? "text-slate-200 font-bold" : "text-slate-500"}>
              Verifying transaction signature & checkout session
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              step >= 3 ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
            }`}>
              {step >= 3 ? "⚡" : "3"}
            </span>
            <span className={step >= 3 ? "text-slate-200 font-bold" : "text-slate-500"}>
              Activating Civil Service PRO Pass duration
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
