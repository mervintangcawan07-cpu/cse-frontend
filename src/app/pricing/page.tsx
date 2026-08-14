"use client";

import { useState } from "react";
import Link from "next/link";

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/paymongo/checkout", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || "Failed to launch payment.");
      }
    } catch (err) {
      console.error(err);
      alert("Error starting checkout session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <Link href="/dashboard" className="text-blue-600 font-semibold hover:underline mb-6 inline-block">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-4xl font-extrabold text-slate-900">Upgrade to PRO</h1>
          <p className="text-lg text-slate-600 mt-4">Unlock all features and pass the Civil Service Exam.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col">
            <h2 className="text-2xl font-bold text-slate-800">Basic Free</h2>
            <p className="text-slate-500 mt-2">Get started with basic practice tools.</p>
            <div className="my-6">
              <span className="text-4xl font-extrabold text-slate-900">₱0</span>
              <span className="text-slate-500 font-medium"> / forever</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-slate-700">✓ Limited Study Notes</li>
              <li className="flex items-center gap-3 text-slate-700">✓ Free Preview Materials</li>
            </ul>
            <button className="w-full py-4 rounded-xl font-bold bg-slate-100 text-slate-500 cursor-not-allowed">
              Current Plan
            </button>
          </div>

          {/* PRO Tier */}
          <div className="bg-slate-900 rounded-3xl p-8 border border-emerald-500 shadow-xl flex flex-col relative">
            <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-xs font-bold px-4 py-1 rounded-bl-lg uppercase">
              Recommended
            </div>
            <h2 className="text-2xl font-bold text-white">CSE PRO Pass</h2>
            <p className="text-slate-400 mt-2">Full access to pass your exam.</p>
            <div className="my-6">
              <span className="text-4xl font-extrabold text-white">₱499</span>
              <span className="text-slate-400 font-medium"> / lifetime access</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1 text-slate-200 text-sm">
              <li>✓ Unlimited Full Mock Exams</li>
              <li>✓ Category-Specific Speed Drills</li>
              <li>✓ Full Access to PDF & Word Handbooks</li>
              <li>✓ Instructor Study Notes & Pro-Tips</li>
            </ul>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-4 rounded-xl font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-slate-950 shrink-0"
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
                  <span>Connecting to PayMongo Gateway...</span>
                </>
              ) : (
                <span>Pay ₱499 via PayMongo 💳</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}