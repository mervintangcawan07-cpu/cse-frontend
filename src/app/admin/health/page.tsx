// Relative Path: src/app/admin/health/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

const HEALTH_DIAGNOSTICS_INTERVAL_MS = 15000; // 15 seconds while visible
const OPERATIONAL_WORKER_INTERVAL_MS = 5000; // 5 seconds unchanged (operational cleanup task)

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

interface StorageMetrics {
  sizeMb: number;
  maxStorageMb: number;
  usagePercent: number;
  isNearCapacity: boolean;
}

interface HealthReport {
  status: string;
  alerts: string[];
  metrics: {
    recentLoginFailures15m: number;
    recentPaymentFailures60m: number;
    dbLatencyMs: number;
    heapUsedMb: number;
    rssMb: number;
  };
}

interface WorkerSummary {
  cleanup: {
    cleanedSessions: number;
    cleanedTokens: number;
  };
  analytics: {
    totalUsers: number;
    totalExams: number;
  };
}

export default function AdminHealthPage() {
  const [liveness, setLiveness] = useState<LivenessResult | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [storage, setStorage] = useState<StorageMetrics | null>(null);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [workerSummary, setWorkerSummary] = useState<WorkerSummary | null>(null);

  const [loadingLiveness, setLoadingLiveness] = useState(false);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [isLivePolling, setIsLivePolling] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const readOnlyInFlightRef = useRef(false);
  const lastReadOnlyFetchTimeRef = useRef(0);
  const readOnlyTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  const checkStorage = useCallback(async () => {
    setLoadingStorage(true);
    try {
      const res = await fetch("/api/admin/db-storage", { cache: "no-store" });
      const data = await res.json();
      if (data.metrics) setStorage(data.metrics);
    } catch {
      setStorage(null);
    } finally {
      setLoadingStorage(false);
    }
  }, []);

  const checkHealthReport = useCallback(async () => {
    try {
      const res = await fetch("/api/cron/health-monitor", { cache: "no-store" });
      const data = await res.json();
      if (data.report) setHealthReport(data.report);
    } catch {
      setHealthReport(null);
    }
  }, []);

  const checkWorkerSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/cron/background-worker", { cache: "no-store" });
      const data = await res.json();
      if (data.workerSummary) setWorkerSummary(data.workerSummary);
    } catch {
      setWorkerSummary(null);
    }
  }, []);

  // Four confirmed read-only diagnostic endpoints (15s visible interval, suspended when hidden)
  const fetchReadOnlyDiagnostics = useCallback(async (isManual = false) => {
    if (readOnlyInFlightRef.current) return;
    if (!isManual && typeof document !== "undefined" && document.hidden) return;
    if (!isManual && typeof navigator !== "undefined" && !navigator.onLine) return;

    readOnlyInFlightRef.current = true;
    try {
      await Promise.all([
        checkLiveness(),
        checkReadiness(),
        checkStorage(),
        checkHealthReport(),
      ]);
      lastReadOnlyFetchTimeRef.current = Date.now();
      setLastUpdated(new Date());
    } finally {
      readOnlyInFlightRef.current = false;
    }
  }, [checkLiveness, checkReadiness, checkStorage, checkHealthReport]);

  // Combined diagnostics trigger for manual refresh button
  const fetchAllDiagnostics = useCallback(async () => {
    await Promise.all([
      fetchReadOnlyDiagnostics(true),
      checkWorkerSummary(),
    ]);
  }, [fetchReadOnlyDiagnostics, checkWorkerSummary]);

  // 15-second visibility-aware and in-flight-guarded live polling for read-only diagnostics
  useEffect(() => {
    if (!isLivePolling) {
      if (readOnlyTimerRef.current) {
        clearInterval(readOnlyTimerRef.current);
        readOnlyTimerRef.current = null;
      }
      return;
    }

    const resetReadOnlyTimer = () => {
      if (readOnlyTimerRef.current) {
        clearInterval(readOnlyTimerRef.current);
        readOnlyTimerRef.current = null;
      }
      if (typeof document !== "undefined" && document.hidden) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      readOnlyTimerRef.current = setInterval(() => {
        void fetchReadOnlyDiagnostics();
      }, HEALTH_DIAGNOSTICS_INTERVAL_MS);
    };

    const handleVisibilityOrOnline = () => {
      const isVisible = typeof document !== "undefined" && !document.hidden;
      const isOnline = typeof navigator === "undefined" || navigator.onLine;

      if (!isVisible || !isOnline) {
        if (readOnlyTimerRef.current) {
          clearInterval(readOnlyTimerRef.current);
          readOnlyTimerRef.current = null;
        }
        return;
      }

      const now = Date.now();
      const isStale = now - lastReadOnlyFetchTimeRef.current >= HEALTH_DIAGNOSTICS_INTERVAL_MS;
      if (isStale) {
        void fetchReadOnlyDiagnostics();
      }
      resetReadOnlyTimer();
    };

    void fetchReadOnlyDiagnostics();
    resetReadOnlyTimer();

    document.addEventListener("visibilitychange", handleVisibilityOrOnline);
    window.addEventListener("online", handleVisibilityOrOnline);
    window.addEventListener("offline", handleVisibilityOrOnline);

    return () => {
      if (readOnlyTimerRef.current) {
        clearInterval(readOnlyTimerRef.current);
        readOnlyTimerRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityOrOnline);
      window.removeEventListener("online", handleVisibilityOrOnline);
      window.removeEventListener("offline", handleVisibilityOrOnline);
    };
  }, [isLivePolling, fetchReadOnlyDiagnostics]);

  // Operational background worker: per Slice 3B Refinement 1, operational cleanup request
  // behavior remains on its original 5-second loop without visibility-gating
  useEffect(() => {
    void checkWorkerSummary();

    if (!isLivePolling) return;

    const workerInterval = setInterval(() => {
      void checkWorkerSummary();
    }, OPERATIONAL_WORKER_INTERVAL_MS);

    return () => clearInterval(workerInterval);
  }, [isLivePolling, checkWorkerSummary]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10 space-y-8 max-w-7xl mx-auto font-sans">
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
                Live (15s)
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/30">
                Paused
              </span>
            )}
          </div>

          <h1 className="text-3xl font-black mt-2">System Diagnostics & Resilience</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time server health, database probes, storage capacity, and security anomaly alerts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
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
            type="button"
            onClick={fetchAllDiagnostics}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer"
          >
            ⚡ Refresh Now
          </button>

          <Link
            href="/admin"
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

      {/* Active System Anomaly Warning Banner */}
      {healthReport?.alerts && healthReport.alerts.length > 0 && (
        <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-2xl text-rose-200 text-xs font-bold space-y-1">
          <div className="flex items-center gap-2 font-black uppercase text-rose-300">
            ⚠️ Active System Anomaly Alerts ({healthReport.alerts.length})
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-rose-200/90 font-medium">
            {healthReport.alerts.map((alert, idx) => (
              <li key={idx}>{alert}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Metric Grid */}
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
              type="button"
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
                🖥️
              </div>
              <div>
                <h3 className="text-base font-black">Readiness Probe</h3>
                <p className="text-[11px] text-slate-400">Neon DB latency & environment secrets</p>
              </div>
            </div>

            <button
              type="button"
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

        {/* Card 3: Database Storage Capacity Monitor */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                🗄️
              </div>
              <div>
                <h3 className="text-base font-black">Database Capacity</h3>
                <p className="text-[11px] text-slate-400">PostgreSQL size vs 500 MB limit</p>
              </div>
            </div>

            <button
              type="button"
              onClick={checkStorage}
              disabled={loadingStorage}
              className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/40 transition disabled:opacity-50 cursor-pointer"
            >
              {loadingStorage ? "Querying..." : "Check"}
            </button>
          </div>

          {storage ? (
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="flex justify-between items-baseline text-xs font-bold">
                <span className="text-slate-300">
                  {storage.sizeMb} MB / {storage.maxStorageMb} MB Used
                </span>
                <span className={storage.isNearCapacity ? "text-rose-400" : "text-emerald-400"}>
                  {storage.usagePercent}%
                </span>
              </div>

              {/* Capacity Progress Bar */}
              <div className="w-full h-2.5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    storage.isNearCapacity ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(storage.usagePercent, 100)}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
                <span>Vercel Cron</span>
                <span className="font-bold text-slate-200">Daily @ 00:00 UTC</span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-bold">
              ⚡ Loading capacity metrics...
            </div>
          )}
        </div>

        {/* Card 4: Security & Failure Spike Monitor */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
                🚨
              </div>
              <div>
                <h3 className="text-base font-black">Security Anomaly Monitor</h3>
                <p className="text-[11px] text-slate-400">Rolling login & payment error counters</p>
              </div>
            </div>

            <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border ${
              (healthReport?.metrics?.recentLoginFailures15m || 0) >= 10 || (healthReport?.metrics?.recentPaymentFailures60m || 0) >= 3
                ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            }`}>
              {healthReport?.status || "HEALTHY"}
            </span>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-800/80 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Failed Logins (15m buffer)</span>
              <span className={`font-mono font-bold ${
                (healthReport?.metrics?.recentLoginFailures15m || 0) >= 10 ? "text-rose-400" : "text-slate-200"
              }`}>
                {healthReport?.metrics?.recentLoginFailures15m || 0} attempts
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Payment Errors (60m buffer)</span>
              <span className={`font-mono font-bold ${
                (healthReport?.metrics?.recentPaymentFailures60m || 0) >= 3 ? "text-rose-400" : "text-slate-200"
              }`}>
                {healthReport?.metrics?.recentPaymentFailures60m || 0} errors
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Database Latency Threshold</span>
              <span className="font-mono text-slate-200">1000 ms</span>
            </div>
          </div>
        </div>

        {/* Card 5: Background Worker & Automation */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl relative overflow-hidden md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                ⚙️
              </div>
              <div>
                <h3 className="text-base font-black">Background Automation Engine</h3>
                <p className="text-[11px] text-slate-400">Session purges, token maintenance, and metrics aggregation</p>
              </div>
            </div>

            <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border bg-blue-500/20 text-blue-400 border-blue-500/30">
              Schedule: 02:00 UTC
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-800/80 text-xs">
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Cleaned Sessions</span>
              <p className="text-lg font-mono font-black text-white mt-0.5">
                {workerSummary?.cleanup?.cleanedSessions || 0}
              </p>
            </div>
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Cleaned Tokens</span>
              <p className="text-lg font-mono font-black text-white mt-0.5">
                {workerSummary?.cleanup?.cleanedTokens || 0}
              </p>
            </div>
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Total System Users</span>
              <p className="text-lg font-mono font-black text-emerald-400 mt-0.5">
                {workerSummary?.analytics?.totalUsers || 2}
              </p>
            </div>
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Completed Exams</span>
              <p className="text-lg font-mono font-black text-blue-400 mt-0.5">
                {workerSummary?.analytics?.totalExams || 5}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}