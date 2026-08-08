// Relative Path: src/app/admin/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import UserActionModal from "@/components/admin/UserActionModal";
import DatabaseStorageWidget from "@/components/admin/DatabaseStorageWidget";

interface UserItem {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isPaid: boolean;
  planType: string | null;
  paidUntil: string | null;
  isBanned?: boolean;
  banReason?: string | null;
  createdAt: string;
}

interface LoginLog {
  id: string;
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  status: string;
  reason?: string | null;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<"USERS" | "LOGIN_LOGS">("USERS");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Moderation Modal State
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [modalMode, setModalMode] = useState<"BAN" | "UNBAN" | "RESET_PASSWORD" | null>(null);

  const fetchUsers = useCallback(async (query = "") => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (query = "", filter = "ALL") => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/login-history?q=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}`
      );
      const data = await res.json();
      if (res.ok && data.history) {
        setLogs(data.history);
      }
    } catch (err) {
      console.error("Failed to load login logs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "USERS") {
      fetchUsers(searchQuery);
    } else {
      fetchLogs(searchQuery, statusFilter);
    }
  }, [activeTab, fetchUsers, fetchLogs, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "USERS") {
      fetchUsers(searchQuery);
    } else {
      fetchLogs(searchQuery, statusFilter);
    }
  };

  const handleUpdateAccess = async (userId: string, action: string) => {
    if (
      action === "REVOKE" &&
      !confirm("Are you sure you want to revoke PRO access for this reviewee?")
    ) {
      return;
    }

    setUpdatingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });

      if (res.ok) {
        fetchUsers(searchQuery);
      } else {
        alert("Failed to update user access.");
      }
    } catch (err) {
      console.error("Update access error:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (statusFilter === "BANNED") return u.isBanned;
    if (statusFilter === "PRO") return u.isPaid;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-xs font-bold text-amber-400 hover:underline">
              &larr; Return to Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-black mt-1">User Accounts, Access & Security</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage subscription extensions, enforce account bans, reset passwords, and audit login attempts.
          </p>
        </div>

        {/* Global Search */}
        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder={activeTab === "USERS" ? "Search email or name..." : "Search IP, email, or reason..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="p-2.5 px-4 bg-slate-800 border border-slate-700 text-white rounded-xl text-xs outline-none focus:border-amber-400 font-medium w-full sm:w-64 placeholder-slate-400"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-sm shrink-0 cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {/* Real-time Database Infrastructure & Capacity Monitor */}
      <DatabaseStorageWidget />

      {/* Navigation Tabs & Filter Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 text-xs font-bold w-full sm:w-auto">
          <button
            type="button"
            onClick={() => { setActiveTab("USERS"); setSearchQuery(""); setStatusFilter("ALL"); }}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === "USERS" ? "bg-white text-slate-900 shadow-sm font-black" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            👥 User Accounts ({users.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("LOGIN_LOGS"); setSearchQuery(""); setStatusFilter("ALL"); }}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === "LOGIN_LOGS" ? "bg-white text-slate-900 shadow-sm font-black" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            🔐 Login Audit & Failed Attempts
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="text-slate-400 uppercase text-[10px]">Filter Status:</span>
          {activeTab === "USERS" ? (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="ALL">All Reviewees</option>
              <option value="PRO">PRO Subscribers Only</option>
              <option value="BANNED">🚨 Banned Users Only</option>
            </select>
          ) : (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="ALL">All Login Logs</option>
              <option value="FAILED">🚨 Failed Login Attempts Only</option>
              <option value="SUCCESS">✅ Successful Logins Only</option>
            </select>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6">
        {activeTab === "USERS" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold uppercase">
                  <th className="p-3.5 rounded-l-xl">User Details</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">PRO Access</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Plan Expiration</th>
                  <th className="p-3.5 text-right rounded-r-xl">Access & Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-medium animate-pulse">
                      Loading reviewee accounts...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No reviewees matched your filter or search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isExpired = u.paidUntil && new Date(u.paidUntil) < new Date();
                    const isActive = u.isPaid && !isExpired;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5">
                          <p className="font-extrabold text-slate-800">{u.name || "Reviewee"}</p>
                          <p className="text-slate-400 text-[11px] font-mono">{u.email}</p>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              u.role === "ADMIN" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              isActive
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {isActive ? "✓ Paid PRO" : "Free Tier"}
                          </span>
                        </td>

                        <td className="p-3.5">
                          {u.isBanned ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-800" title={u.banReason || ""}>
                              🚨 Banned
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                              Active
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-slate-600 font-medium">
                          {u.paidUntil
                            ? new Date(u.paidUntil).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "N/A"}
                        </td>

                        <td className="p-3.5 text-right space-x-1 shrink-0">
                          {/* PRO Duration Extension Buttons */}
                          <button
                            type="button"
                            onClick={() => handleUpdateAccess(u.id, "EXTEND_30")}
                            disabled={updatingId === u.id}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] rounded-lg border border-blue-200 transition disabled:opacity-50 cursor-pointer"
                          >
                            +30 Days
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateAccess(u.id, "EXTEND_180")}
                            disabled={updatingId === u.id}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] rounded-lg border border-emerald-200 transition disabled:opacity-50 cursor-pointer"
                          >
                            +180 Days
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateAccess(u.id, "EXTEND_365")}
                            disabled={updatingId === u.id}
                            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[10px] rounded-lg border border-purple-200 transition disabled:opacity-50 cursor-pointer"
                          >
                            +1 Year
                          </button>
                          {u.isPaid && (
                            <button
                              type="button"
                              onClick={() => handleUpdateAccess(u.id, "REVOKE")}
                              disabled={updatingId === u.id}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] rounded-lg border border-rose-200 transition disabled:opacity-50 cursor-pointer"
                            >
                              Revoke PRO
                            </button>
                          )}

                          {/* Moderation Controls */}
                          <button
                            type="button"
                            onClick={() => { setSelectedUser(u); setModalMode("RESET_PASSWORD"); }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg border border-slate-200 transition cursor-pointer"
                          >
                            🔑 Password
                          </button>
                          {u.isBanned ? (
                            <button
                              type="button"
                              onClick={() => { setSelectedUser(u); setModalMode("UNBAN"); }}
                              className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[10px] rounded-lg transition cursor-pointer"
                            >
                              Unban
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setSelectedUser(u); setModalMode("BAN"); }}
                              className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 font-bold text-[10px] rounded-lg transition cursor-pointer"
                            >
                              Ban
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Login Audit Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold uppercase">
                  <th className="p-3.5 rounded-l-xl">Timestamp</th>
                  <th className="p-3.5">Email Attempted</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">IP Address</th>
                  <th className="p-3.5 rounded-r-xl">Failure Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium animate-pulse">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No login records match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">{log.email}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            log.status === "FAILED" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-600">{log.ipAddress || "127.0.0.1"}</td>
                      <td className="p-3.5 text-slate-500">{log.reason || "Authentication successful"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Moderation Action Modal */}
      <UserActionModal
        isOpen={modalMode !== null}
        onClose={() => { setModalMode(null); setSelectedUser(null); }}
        user={selectedUser}
        mode={modalMode}
        onSuccess={() => fetchUsers(searchQuery)}
      />
    </div>
  );
}