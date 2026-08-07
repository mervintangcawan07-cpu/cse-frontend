// Relative Path: src/app/admin/trash/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useSudo } from "@/context/SudoContext";

interface SoftDeletedRecord {
  id: string;
  entityType: string;
  displayName: string;
  deletedAt: string;
  restorableUntil: string;
  daysRemaining: number;
  canRestore: boolean;
  metadata?: Record<string, any>;
}

export default function AdminTrashPage() {
  const { fetchWithSudo } = useSudo();
  const [records, setRecords] = useState<SoftDeletedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchTrashItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/recovery");
      const data = await res.json();
      if (res.ok && data.records) {
        setRecords(data.records);
      } else {
        setError(data.error || "Failed to load soft-deleted items.");
      }
    } catch {
      setError("Network error loading recovery bin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrashItems();
  }, []);

  const handleRestore = async (id: string, entityType: string) => {
    setActionMessage(null);
    const res = await fetchWithSudo("/api/admin/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, entityType }),
    });

    const data = await res.json();
    if (res.ok) {
      setActionMessage(`✅ Record ${id} successfully restored!`);
      fetchTrashItems();
    } else {
      alert(`Restoration failed: ${data.error || "Unknown error"}`);
    }
  };

  const handleRunPurge = async () => {
    if (!confirm("Are you sure you want to permanently purge all expired records? This action cannot be undone.")) {
      return;
    }

    setActionMessage(null);
    const res = await fetchWithSudo("/api/admin/recovery", {
      method: "DELETE",
    });

    const data = await res.json();
    if (res.ok) {
      setActionMessage("🧹 Permanent purge worker executed successfully.");
      fetchTrashItems();
    } else {
      alert(`Purge failed: ${data.error || "Unknown error"}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <span>🗑️</span> Admin Trash & Recovery Bin
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Soft-deleted records are held for 30 days before permanent automated purge. Restorations require Sudo Mode elevation.
          </p>
        </div>

        <button
          onClick={handleRunPurge}
          className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-black text-xs rounded-xl transition cursor-pointer flex items-center gap-2"
        >
          <span>🔥</span> Trigger Purge Worker
        </button>
      </div>

      {actionMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs font-bold">
          {actionMessage}
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl text-xs font-bold">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500 text-xs font-mono animate-pulse">
          Loading recovery items...
        </div>
      ) : records.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
          <div className="text-4xl">✨</div>
          <h3 className="text-base font-bold text-white">Trash Bin is Empty</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No soft-deleted records currently reside in the 30-day recovery window.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 uppercase font-black text-[10px] text-slate-400 tracking-wider">
              <tr>
                <th className="px-6 py-4">Entity / ID</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Soft Deleted At</th>
                <th className="px-6 py-4">Retention Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {records.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-6 py-4">
                    <div className="font-bold text-white">{rec.displayName}</div>
                    <div className="text-[10px] font-mono text-slate-500">{rec.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-[10px] font-extrabold uppercase border border-slate-700">
                      {rec.entityType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                    {new Date(rec.deletedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                        rec.daysRemaining > 5
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {rec.daysRemaining} days remaining
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleRestore(rec.id, rec.entityType)}
                      className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold rounded-xl transition text-xs cursor-pointer"
                    >
                      🔄 Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
