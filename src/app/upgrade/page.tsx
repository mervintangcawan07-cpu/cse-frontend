// Relative Path: src/app/upgrade/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LoadingButton from "@/components/common/LoadingButton";
import { useDoubleSubmitPreventer } from "@/hooks/useDoubleSubmitPreventer";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export default function UpgradePage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const executeUpgrade = async () => {
    setErrorMsg(null);
    try {
      // Automatically abort request if server response exceeds 12 seconds
      const res = await fetchWithTimeout("/api/paymongo/checkout", {
        method: "POST",
        timeout: 12000,
      });

      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        const msg = data.error || "Failed to initiate payment. Please try again.";
        setErrorMsg(msg);
        alert(msg);
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      const msg = err?.message || "An unexpected error occurred. Please try again.";
      setErrorMsg(msg);
      alert(msg);
    }
  };

  const { isSubmitting: loading, handleSubmit: handleUpgrade } = useDoubleSubmitPreventer(executeUpgrade);

  const handleLogout = async () => {
    try {
      await fetchWithTimeout("/api/auth/logout", { method: "POST", timeout: 5000 });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-md space-y-6 text-center">
        {/* Header Badge & Title */}
        <div className="space-y-2">
          <span className="text-4xl block">🔒</span>
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md border border-amber-200 inline-block">
            Payment Required
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 pt-1">Upgrade to PRO</h2>
          <p className="text-xs text-slate-500">
            Payment is required before accessing the dashboard, mock exams, and study materials.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium text-left">
            ⚠️ <strong>Error:</strong> {errorMsg}
          </div>
        )}

        {/* Pricing Card */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3 text-left">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-500 uppercase">Lifetime Pass</span>
            <span className="text-2xl font-extrabold text-slate-900">₱499</span>
          </div>
          <ul className="text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-200 font-medium">
            <li className="flex items-center gap-2 text-emerald-600 font-bold">✓ Full Timed Practice Mock Exams</li>
            <li className="flex items-center gap-2 text-emerald-600 font-bold">✓ Category-Specific Speed Drills</li>
            <li className="flex items-center gap-2 text-emerald-600 font-bold">✓ Full Access to Instructor Study Notes</li>
            <li className="flex items-center gap-2 text-emerald-600 font-bold">✓ Read-Only PDF & Word Handbooks</li>
            <li className="flex items-center gap-2 text-slate-500">✓ GCash, Maya & Card Instant Support</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <LoadingButton
          type="button"
          onClick={handleUpgrade}
          isLoading={loading}
          loadingText="Redirecting to PayMongo..."
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition shadow-sm"
        >
          Pay ₱499 via PayMongo
        </LoadingButton>

        <a
          href="/redeem"
          className="block w-full text-center text-xs font-semibold text-violet-500 hover:text-violet-400 transition py-1"
        >
          🎟️ Have a school or institutional voucher? Redeem it here
        </a>

        <button
          type="button"
          onClick={handleLogout}
          className="block w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 transition cursor-pointer"
        >
          Log Out & Exit
        </button>
      </div>
    </div>
  );
}