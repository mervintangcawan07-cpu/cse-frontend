// Relative Path: src/app/admin/health/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface LivenessResult {
  status: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  metrics: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
  };
}

interface ReadinessResult {
  status: string;
  timestamp: string;
  durationMs: number;
  checks: {
    database?: { status: string; latencyMs?: number; error?: string };
    environment?: { status: string; error?: string };
  };
}

export default function AdminHealthPage() {
  const [liveness, setLiveness] = useState<LivenessResult | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [loadingLiveness, setLoadingLiveness] = useState(false);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [isLivePolling, setIsLivePolling] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const checkLiveness = useCallback(async () => {
    setLoadingLiveness(true);
    try {
      const res = await fetch("/api/health/liveness", { cache: "no-store" });
      const data = await res.json();
      setLiveness(data);
    } catch {
      setLiveness(null);
    } finally {
      setLoadingLiveness(false);
    }
  }, []);

  const checkReadiness = useCallback(async () => {
    setLoadingReadiness(true);
    try {
      const res = await fetch("/api/health/readiness", { cache: "no-store" });
      const data = await res.json();
      setReadiness(data);
    } catch {
      setReadiness(null);
    } finally {
      setLoadingReadiness(false);
    }
  }, []);

  const fetchAllDiagnostics = useCallback(async () => {
    await Promise.all([checkLiveness(), checkReadiness()]);
    setLastUpdated(new Date());
  }, [checkLiveness, checkReadiness]);

  // Initial load + 5-second live polling loop
  useEffect(() => {
    fetchAllDiagnostics();

    if (!isLivePolling) return;

    const interval = setInterval(() => {
      fetchAllDiagnostics();
    }, 5000);

    return () => clearInterval(interval);
  }, [isLivePolling, fetchAllDiagnostics]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
              Admin Operations
            </span>

            {/* Live Indicator Pulse Badge */}
            {isLivePolling ? (
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Live (5s)
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/30">
                Paused
              </span>
            )}
          </div>

          <h1 className="text-3xl font-black mt-2">System Diagnostics & Resilience</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time server health, database probes, and memory allocation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLivePolling((prev) => !prev)}
            className={`px-4 py-2.5 font-bold text-xs rounded-xl border transition cursor-pointer ${
              isLivePolling
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
            }`}
          >
            {isLivePolling ? "⏸️ Pause Auto-Polling" : "▶️ Resume Live Polling"}
          </button>

          <button
            onClick={fetchAllDiagnostics}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer"
          >
            ⚡ Refresh Now
          </button>

          <Link
            href="/admin/questions"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs rounded-xl transition"
          >
            ← Admin Portal
          </Link>
        </div>
      </div>

      {/* Sync Status Banner */}
      {lastUpdated && (
        <div className="flex justify-between items-center px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs text-slate-400">
          <span>📡 Diagnostics synchronized in real-time</span>
          <span className="font-mono text-[11px] text-slate-500">
            Last pulse: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Action Controls & Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Live Liveness Probe */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
                💓
              </div>
              <div>
                <h3 className="text-base font-black">Liveness Probe</h3>
                <p className="text-[11px] text-slate-400">Node.js event loop & RAM allocation</p>
              </div>
            </div>

            <button
              onClick={checkLiveness}
              disabled={loadingLiveness}
              className="px-3.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-xs rounded-xl border border-cyan-500/40 transition disabled:opacity-50 cursor-pointer"
            >
              {loadingLiveness ? "Probing..." : "Ping"}
            </button>
          </div>

          {liveness ? (
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Status</span>
                <span className="font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {liveness.status}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Uptime</span>
                <span className="font-mono text-slate-200">{liveness.uptimeSeconds}s</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">RAM Allocation (RSS)</span>
                <span className="font-mono text-slate-200">{liveness.metrics.rssMb} MB</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Heap Used</span>
                <span className="font-mono text-slate-200">
                  {liveness.metrics.heapUsedMb} MB / {liveness.metrics.heapTotalMb} MB
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold">
              ⚠️ Liveness probe offline or server unreachable.
            </div>
          )}
        </div>

        {/* Card 2: Live Readiness Probe */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                🗄️
              </div>
              <div>
                <h3 className="text-base font-black">Readiness Probe</h3>
                <p className="text-[11px] text-slate-400">Neon DB latency & environment secrets</p>
              </div>
            </div>

            <button
              onClick={checkReadiness}
              disabled={loadingReadiness}
              className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/40 transition disabled:opacity-50 cursor-pointer"
            >
              {loadingReadiness ? "Probing..." : "Ping"}
            </button>
          </div>

          {readiness ? (
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Overall Status</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded border ${
                    readiness.status === "UP"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {readiness.status}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Database Connection</span>
                <span className="font-mono text-slate-200">
                  {readiness.checks.database?.status === "UP"
                    ? `UP (${readiness.checks.database.latencyMs}ms)`
                    : "DOWN"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Environment Secrets</span>
                <span className="font-mono text-slate-200">
                  {readiness.checks.environment?.status || "UP"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Check Duration</span>
                <span className="font-mono text-slate-200">{readiness.durationMs}ms</span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold">
              ⚠️ Readiness probe failed or database connection dropped.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
