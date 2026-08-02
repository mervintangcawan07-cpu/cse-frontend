"use client";

import { useEffect, useState } from "react";

export default function AdminCSCSyncPage() {
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSyncData();
  }, []);

  const loadSyncData = async () => {
    try {
      const res = await fetch("/api/csc/public-info");
      const data = await res.json();
      if (res.ok) setSyncStatus(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setMessage("");
    try {
      const res = await fetch("/api/csc/sync", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage(`✅ Sync completed! Updated ${data.recordsUpdated} record(s).`);
        loadSyncData();
      } else {
        setMessage(`❌ Sync notice: ${data.error || "CSC site offline. Retaining local cached state."}`);
      }
    } catch (err: any) {
      setMessage("❌ Connection error.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
            Automated Crawler & Ingestion
          </span>
          <h1 className="text-xl font-extrabold text-white mt-1">CSC Synchronization Center</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor background synchronization processes and pull official updates directly from csc.gov.ph.
          </p>
        </div>

        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-2xl shadow-lg transition cursor-pointer shrink-0"
        >
          {syncing ? "Syncing with CSC..." : "⚡ Sync Now"}
        </button>
      </div>

      {message && (
        <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 text-xs font-bold text-white">
          {message}
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl">
          <span className="text-xs text-slate-400 font-bold block">Source Status</span>
          <span className="text-lg font-black text-emerald-400 mt-1 block">Online / Local Cache Active</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl">
          <span className="text-xs text-slate-400 font-bold block">Active Schedule</span>
          <span className="text-lg font-black text-amber-400 mt-1 block">
            {syncStatus?.nextSchedule?.title || "None Set"}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl">
          <span className="text-xs text-slate-400 font-bold block">Cached Announcements</span>
          <span className="text-lg font-black text-blue-400 mt-1 block">
            {syncStatus?.announcements?.length || 0} Records
          </span>
        </div>
      </div>
    </div>
  );
}