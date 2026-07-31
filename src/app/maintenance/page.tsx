"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function MaintenancePage() {
  const router = useRouter();
  const [message, setMessage] = useState("We are currently performing system upgrades and optimizations.");
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/maintenance/status");
      const data = await res.json();

      if (!data.isMaintenance) {
        // System is back online!
        router.push("/dashboard");
      } else if (data.message) {
        setMessage(data.message);
      }
    } catch (err) {
      console.error("Failed to check maintenance status:", err);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // Auto-check every 10 seconds
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-slate-900 border border-amber-500/30 rounded-3xl p-8 md:p-10 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-inner">
          🛠️
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
            Scheduled System Upgrade
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-white pt-2">
            Platform Maintenance Break
          </h1>
          <p className="text-slate-400 text-xs md:text-sm leading-relaxed font-medium">
            {message}
          </p>
        </div>

        <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Updates in progress — Your data & progress are completely safe!</span>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={checkStatus}
            disabled={checking}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{checking ? "Checking System Status..." : "🔄 Refresh System Status"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}