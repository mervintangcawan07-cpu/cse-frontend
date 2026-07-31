"use client";

import { useEffect, useState } from "react";

export default function MaintenanceToggleCard() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch("/api/admin/maintenance");
        if (res.ok) {
          const data = await res.json();
          setEnabled(data.enabled);
          setMessage(data.message);
        }
      } catch (err) {
        console.error("Failed to load admin maintenance setting:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, []);

  const handleToggle = async (newStatus: boolean) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newStatus, message }),
      });

      if (res.ok) {
        setEnabled(newStatus);
      } else {
        alert("Failed to update maintenance state.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving maintenance state.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 text-white p-6 rounded-3xl shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                enabled
                  ? "bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse"
                  : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              }`}
            >
              {enabled ? "🚨 Site Disabled (Maintenance Active)" : "✅ Live & Available"}
            </span>
          </div>
          <h2 className="text-lg font-black text-white">System Maintenance Mode</h2>
          <p className="text-xs text-slate-400">
            Temporarily redirect examinees to an update break screen while you push code updates.
          </p>
        </div>

        <button
          onClick={() => handleToggle(!enabled)}
          disabled={saving}
          className={`px-5 py-2.5 rounded-xl font-black text-xs transition shadow-md shrink-0 cursor-pointer ${
            enabled
              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
              : "bg-rose-600 hover:bg-rose-500 text-white"
          }`}
        >
          {saving ? "Updating..." : enabled ? "⚡ Turn Maintenance OFF (Go Live)" : "🛠️ Enable Maintenance Mode"}
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
          Examinee Break Message
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Custom message for examinees during maintenance..."
            className="flex-1 p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-amber-500 transition"
          />
          <button
            onClick={() => handleToggle(enabled)}
            disabled={saving}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition"
          >
            Save Message
          </button>
        </div>
      </div>
    </div>
  );
}