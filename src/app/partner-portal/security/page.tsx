"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  Key,
} from "lucide-react";
import PartnerPortalNav from "@/components/partner/PartnerPortalNav";

interface PartnerProfile {
  id: string;
  name: string;
  email?: string;
  partnerId?: string;
  [key: string]: unknown;
}

interface PartnerAuditLog {
  id: string;
  createdAt: string;
  action: string;
  reason?: string | null;
  ipAddress: string;
}

export default function PartnerSecurityPage() {
  const router = useRouter();
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [auditLogs, setAuditLogs] = useState<PartnerAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Change Password Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSecurityData = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [authRes, secRes] = await Promise.all([
          fetch("/api/partner/auth/me", { signal }),
          fetch("/api/partner/portal/security", { signal }),
        ]);

        if (authRes.status === 401 || secRes.status === 401) {
          router.push("/partner-portal/login");
          return;
        }

        if (authRes.ok) {
          const authJson = await authRes.json();
          setPartner(authJson.partner);
        }

        if (secRes.ok) {
          const secJson = await secRes.json();
          setAuditLogs(secJson.auditLogs || []);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to load partner security audit logs:", err);
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      await fetchSecurityData(controller.signal);
    };

    void loadData();

    return () => {
      controller.abort();
    };
  }, [fetchSecurityData]);

  const handlePasswordChange = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (updating) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 8) {
      setErrorMsg("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("New passwords do not match.");
      return;
    }

    setUpdating(true);

    try {
      const res = await fetch("/api/partner/portal/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setSuccessMsg(json.message || "Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        await fetchSecurityData();
      } else {
        setErrorMsg(json.error || "Failed to update password.");
      }
    } catch (err: unknown) {
      console.error("Password update error:", err);
      setErrorMsg("Network error. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const renderAuditLogsContent = () => {
    if (loading) {
      return (
        <div className="py-8 text-center text-xs text-slate-400">
          Loading audit history...
        </div>
      );
    }

    if (!auditLogs.length) {
      return (
        <div className="py-8 text-center text-xs text-slate-400">
          No activity recorded yet.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
            <tr>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Event</th>
              <th className="py-3 px-4">Reason / Details</th>
              <th className="py-3 px-4 text-right">Origin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {auditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-800/40">
                <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-3 px-4 font-mono font-bold text-emerald-300">
                  {log.action.replace(/_/g, " ")}
                </td>
                <td className="py-3 px-4 text-slate-300">
                  {log.reason || "Standard system event"}
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-400">
                  {log.ipAddress}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PartnerPortalNav partner={partner} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-400" />
            <span>Partner Security &amp; Audit Log</span>
          </h1>
          <p className="text-xs text-slate-400">
            Manage your account password and review recent security and financial events.
          </p>
        </div>

        {/* Change Password Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              <span>Change Portal Password</span>
            </h3>
            <p className="text-xs text-slate-400">
              Ensure your account is protected with a strong, unique password.
            </p>
          </div>

          {successMsg && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4 text-xs max-w-md">
            <div>
              <label
                htmlFor="current-password"
                className="block font-bold uppercase text-slate-400 mb-1"
              >
                Current Password
              </label>
              <div className="relative">
                <input
                  id="current-password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-3 pr-10 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="new-password"
                className="block font-bold uppercase text-slate-400 mb-1"
              >
                New Password (Min. 8 characters)
              </label>
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block font-bold uppercase text-slate-400 mb-1"
              >
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={updating}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            >
              {updating ? "Updating Password..." : "Update Password"}
            </button>
          </form>
        </div>

        {/* Security Audit Activity Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Recent Account Activity &amp; Audit Log</span>
              </h3>
              <p className="text-xs text-slate-400">
                Immutable record of logins, password updates, and payout requests.
              </p>
            </div>
          </div>

          {renderAuditLogsContent()}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-600 border-t border-slate-900">
        &copy; 2026 GovStudyX Partner Portal. Protected by enterprise security.
      </footer>
    </div>
  );
}