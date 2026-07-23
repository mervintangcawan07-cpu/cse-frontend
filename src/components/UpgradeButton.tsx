"use client";

import { useState } from "react";

interface UpgradeButtonProps {
  userId?: string;
  email?: string;
}

export default function UpgradeButton({ userId, email }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheckout = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to initialize checkout.");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL returned.");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An error occurred during checkout.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full sm:w-auto">
      {error && (
        <p className="text-xs text-red-400 mb-2 font-medium text-center">{error}</p>
      )}
      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-8 py-3.5 rounded-2xl transition shadow-lg hover:shadow-emerald-500/20 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Connecting to PayMongo...</span>
          </>
        ) : (
          <span>Upgrade Account Now — ₱499</span>
        )}
      </button>
    </div>
  );
}