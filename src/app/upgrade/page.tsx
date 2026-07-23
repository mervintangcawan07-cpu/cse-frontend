"use client";

import { useState } from "react";
import Link from "next/link";

export default function UpgradePage() {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/paymongo/checkout", {
        method: "POST",
      });

      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || "Failed to initiate payment. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6 text-center">
        <div className="space-y-2">
          <span className="text-4xl">🚀</span>
          <h2 className="text-2xl font-extrabold text-slate-900">Upgrade to PRO</h2>
          <p className="text-xs text-slate-500">
            Unlock lifetime access to full mock exams, category drills, and study materials.
          </p>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3 text-left">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-500 uppercase">Lifetime Pass</span>
            <span className="text-2xl font-extrabold text-slate-900">₱499</span>
          </div>
          <ul className="text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-200">
            <li className="flex items-center gap-2">✓ Unlimited Full Mock Exam Attempts</li>
            <li className="flex items-center gap-2">✓ Category-Specific Speed Drills</li>
            <li className="flex items-center gap-2">✓ Full Access to Instructor Study Notes</li>
            <li className="flex items-center gap-2">✓ GCash, Maya, GrabPay & Card Support</li>
          </ul>
        </div>

        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition shadow-sm disabled:opacity-50"
        >
          {loading ? "Redirecting to PayMongo..." : "Pay ₱499 via PayMongo"}
        </button>

        <Link
          href="/dashboard"
          className="block text-xs font-bold text-slate-400 hover:text-slate-600 transition"
        >
          &larr; Back to Dashboard
        </Link>
      </div>
    </div>
  );
}