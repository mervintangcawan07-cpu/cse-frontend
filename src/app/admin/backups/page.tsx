"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  ShieldCheck, 
  Database, 
  RefreshCw, 
  Plus, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  HardDrive 
} from "lucide-react";

interface BackupItem {
  id: string;
  backupType: string;
  status: string;
  filename: string;
  storageProvider: string;
  sizeBytes: string;
  checksum: string | null;
  verificationStatus: string;
  verificationMessage: string | null;
  verifiedAt: string | null;
  protected: boolean;
  createdAt: string;
}

interface HealthReport {
  status: "HEALTHY" | "WARNING" | "CRITICAL";
  lastBackupAt: string | null;
  lastVerifiedAt: string | null;
  totalBackups: number;
  verifiedCount: number;
  failedCount: number;
  totalStorageBytes: number;
  alerts: string[];
}

export default function AdminBackupsPage() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Restore Modal State
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedRestoreBackup, setSelectedRestoreBackup] = useState<BackupItem | null>(null);
  const [confirmInput, setConfirmInput] = useState("");

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/backups");
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load backups");

      setBackups(data.backups || []);
      setHealth(data.health || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching backups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleCreateBackup = async () => {
    try {
      setActionLoading("CREATE");
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/admin/backups", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to create backup");

      setSuccess("New database backup created successfully!");
      await fetchBackups();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating backup");
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerify = async (id: string) => {
    try {
      setActionLoading(`VERIFY_${id}`);
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/admin/backups/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Verification failed");

      setSuccess(data.verification?.message || "Backup verification complete!");
      await fetchBackups();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleProtectToggle = async (id: string) => {
    try {
      setActionLoading(`PROTECT_${id}`);
      const res = await fetch(`/api/admin/backups/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "protect" }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Protection update failed");

      await fetchBackups();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Protection error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete backup file '${filename}'?`)) return;

    try {
      setActionLoading(`DELETE_${id}`);
      setError(null);

      const res = await fetch(`/api/admin/backups/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Delete failed");

      setSuccess(`Backup '${filename}' deleted successfully.`);
      await fetchBackups();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreSubmit = async () => {
    if (!selectedRestoreBackup) return;

    try {
      setActionLoading("RESTORE");
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/admin/backups/${selectedRestoreBackup.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", confirmationText: confirmInput }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Restoration failed");

      setSuccess(data.result?.message || "Database restored successfully!");
      setRestoreModalOpen(false);
      setSelectedRestoreBackup(null);
      setConfirmInput("");
      await fetchBackups();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Restore execution failed");
    } finally {
      setActionLoading(null);
    }
  };

  const formatMB = (bytes: string | number) => {
    const num = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
    if (isNaN(num)) return "0 MB";
    return `${(num / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
            Disaster Recovery & Backup Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Automated database backups, SHA-256 integrity checks, and emergency restoration shields.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchBackups}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium flex items-center gap-2 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleCreateBackup}
            disabled={actionLoading === "CREATE"}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition shadow-lg shadow-emerald-950/40"
          >
            <Plus className="w-4 h-4" />
            {actionLoading === "CREATE" ? "Creating Backup..." : "Create Backup Now"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-950/60 border border-red-800 rounded-lg text-red-200 text-sm flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-200 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Health Overview Banner */}
      {health && (
        <div className={`p-5 rounded-xl border ${
          health.status === "HEALTHY" 
            ? "bg-emerald-950/30 border-emerald-800/80" 
            : health.status === "WARNING"
            ? "bg-amber-950/30 border-amber-800/80"
            : "bg-red-950/30 border-red-800/80"
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${
                health.status === "HEALTHY" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
              }`}>
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-white">System Health: {health.status}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Last Backup: {health.lastBackupAt ? new Date(health.lastBackupAt).toLocaleString() : "Never"} | 
                  Last Verified: {health.lastVerifiedAt ? new Date(health.lastVerifiedAt).toLocaleString() : "Never"}
                </p>
              </div>
            </div>
          </div>
          {health.alerts.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800/60 space-y-1">
              {health.alerts.map((alert, idx) => (
                <p key={idx} className="text-xs font-medium text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {alert}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Backups</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-white">{health?.totalBackups ?? 0}</span>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Vault Storage</span>
            <HardDrive className="w-4 h-4 text-sky-400" />
          </div>
          <span className="text-2xl font-bold text-white">{formatMB(health?.totalStorageBytes ?? 0)}</span>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Verified Count</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-white">{health?.verifiedCount ?? 0}</span>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Failed Attempts</span>
            <XCircle className="w-4 h-4 text-red-400" />
          </div>
          <span className="text-2xl font-bold text-white">{health?.failedCount ?? 0}</span>
        </div>
      </div>

      {/* Backups Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white text-base">Database Backup History</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading backup records...</div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No backup records found. Click &quot;Create Backup Now&quot; to generate one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Filename / Created</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-white flex items-center gap-1.5">
                        {b.protected && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        {b.filename}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(b.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        {b.backupType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">
                      {formatMB(b.sizeBytes)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md ${
                        b.status === "COMPLETED" || b.status === "RESTORED"
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                          : b.status === "RUNNING" || b.status === "RESTORING"
                          ? "bg-sky-950/80 text-sky-300 border border-sky-800 animate-pulse"
                          : "bg-red-950/80 text-red-300 border border-red-800"
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md ${
                        b.verificationStatus === "PASSED"
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                          : b.verificationStatus === "FAILED"
                          ? "bg-red-950/80 text-red-300 border border-red-800"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}>
                        {b.verificationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleVerify(b.id)}
                        disabled={actionLoading === `VERIFY_${b.id}`}
                        title="Verify Checksum & Structure"
                        className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition"
                      >
                        Verify
                      </button>
                      <button
                        onClick={() => handleProtectToggle(b.id)}
                        title={b.protected ? "Unprotect Backup" : "Protect from Deletion"}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition inline-flex items-center"
                      >
                        {b.protected ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                      {b.verificationStatus === "PASSED" && (
                        <button
                          onClick={() => {
                            setSelectedRestoreBackup(b);
                            setConfirmInput("");
                            setRestoreModalOpen(true);
                          }}
                          title="One-Click Restore"
                          className="px-2.5 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded font-medium transition inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Restore
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(b.id, b.filename)}
                        disabled={b.protected || actionLoading === `DELETE_${b.id}`}
                        title="Delete Backup"
                        className="p-1.5 bg-red-950/40 hover:bg-red-900/60 disabled:opacity-40 text-red-400 rounded border border-red-900/60 transition inline-flex items-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* One-Click Restore Modal */}
      {restoreModalOpen && selectedRestoreBackup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-white">⚠️ Restore Database Confirmation</h3>
            </div>
            
            <p className="text-sm text-slate-300 leading-relaxed">
              You are about to restore the database to the exact state saved in backup file:
            </p>
            <div className="p-3 bg-slate-950 rounded border border-slate-800 font-mono text-xs text-amber-300">
              {selectedRestoreBackup.filename} ({new Date(selectedRestoreBackup.createdAt).toLocaleString()})
            </div>

            <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 rounded text-xs text-emerald-300">
              <strong>Emergency Shield Enabled:</strong> A mandatory pre-restore emergency snapshot will automatically be generated before overwriting data.
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                To confirm restoration, type <span className="text-amber-400 font-bold">RESTORE</span> below:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="Type RESTORE"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setRestoreModalOpen(false);
                  setSelectedRestoreBackup(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreSubmit}
                disabled={confirmInput !== "RESTORE" || actionLoading === "RESTORE"}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded text-sm font-bold transition flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {actionLoading === "RESTORE" ? "Restoring..." : "Confirm & Execute Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}