"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Plan {
  planType: string;
  name: string;
  price: number;
  durationDays: number;
}

export default function AdminPricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPricing() {
      try {
        const res = await fetch("/api/pricing");
        const data = await res.json();
        if (res.ok && data.plans) {
          setPlans(data.plans);
        }
      } catch (err) {
        console.error("Failed to load pricing:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPricing();
  }, []);

  const handlePriceChange = (planType: string, newPrice: string) => {
    setPlans((prev) =>
      prev.map((p) => (p.planType === planType ? { ...p, price: Number(newPrice) } : p))
    );
  };

  const handleSavePrices = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("🎉 Prices updated successfully! Student dashboards are updated.");
      } else {
        setMessage(`❌ Error: ${data.error || "Failed to save prices"}`);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Network error saving prices.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading Admin Pricing Settings...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-3xl shadow-md">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
            Admin Settings
          </span>
          <h1 className="text-2xl font-black mt-1">Manage Plan Pricing</h1>
          <p className="text-xs text-slate-400">
            Set custom prices for 1-Month, 6-Month, and 1-Year passes.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition border border-slate-700"
        >
          &larr; Return to Dashboard
        </Link>
      </div>

      {message && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 font-bold text-xs">
          {message}
        </div>
      )}

      <form onSubmit={handleSavePrices} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="space-y-4">
          {plans.map((p) => (
            <div key={p.planType} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-2xl bg-slate-50 border border-slate-200 gap-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">{p.name}</h3>
                <span className="text-xs text-slate-500 block">
                  {p.durationDays > 0 ? `Access valid for ${p.durationDays} days` : "1 year access"}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="font-black text-slate-700 text-sm">₱</span>
                <input
                  type="number"
                  min="1"
                  value={p.price}
                  onChange={(e) => handlePriceChange(p.planType, e.target.value)}
                  className="w-full sm:w-32 px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                  required
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-md transition disabled:opacity-50"
        >
          {saving ? "Saving Changes..." : "Save Prices & Sync with PayMongo"}
        </button>
      </form>
    </div>
  );
}