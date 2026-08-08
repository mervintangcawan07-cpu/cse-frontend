// Relative Path: src/components/admin/DatabaseStorageWidget.tsx
"use client";

import { useEffect, useState } from "react";

interface StorageMetrics {
  sizeMb: number;
  maxStorageMb: number;
  usagePercent: number;
  isNearCapacity: boolean;
}

export default function DatabaseStorageWidget() {
  const [metrics, setMetrics] = useState<StorageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/db-storage");
      if (!res.ok) throw new Error("Failed to load metrics");
      const data = await res.json();
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err: any) {
      setError(err?.message || "Error fetching storage data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl animate-pulse text-slate-400 text-xs font-bold">
        ⚡ Querying Database Storage Metrics...
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-rose-400 text-xs font-bold flex justify-between items-center">
        <span>⚠️ {error || "Unable to load storage metrics"}</span>
        <button
          type="button"
          onClick={fetchMetrics}
          className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const getStatusColor = () => {
    if (metrics.usagePercent >= 85) return "bg-rose-500 text-rose-400";
    if (metrics.usagePercent >= 70) return "bg-amber-500 text-amber-400";
    return "bg-emerald-500 text-emerald-400";
  };

  const [bgColor, textColor] = getStatusColor().split(" ");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            System Infrastructure
          </span>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2 mt-0.5">
            🗄️ Database Capacity Monitor
          </h3>
        </div>
        <button
          type="button"
          onClick={fetchMetrics}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 cursor-pointer"
        >
          🔄 Refresh Status
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-baseline text-xs font-bold">
          <span className="text-slate-300">
            {metrics.sizeMb} MB / {metrics.maxStorageMb} MB Used
          </span>
          <span className={textColor}>
            {metrics.usagePercent}% Capacity
          </span>
        </div>

        {/* Storage Usage Bar */}
        <div className="w-full h-3 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${bgColor}`}
            style={{ width: `${Math.min(metrics.usagePercent, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
        <span>Vercel Cron: <strong className="text-slate-200">Daily @ 00:00 UTC</strong></span>
        <span className="flex items-center gap-1.5 font-bold">
          <span className={`w-2 h-2 rounded-full ${bgColor}`}></span>
          <span className={textColor}>
            {metrics.isNearCapacity ? "Capacity Warning" : "Storage Healthy"}
          </span>
        </span>
      </div>
    </div>
  );
}