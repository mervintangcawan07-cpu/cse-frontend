"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface UserItem {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isPaid: boolean;
  planType: string | null;
  paidUntil: string | null;
  createdAt: string;
  _count?: { results: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(searchQuery);
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

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin/dashboard" className="text-xs font-bold text-amber-400 hover:underline">
              &larr; Control Center
            </Link>
          </div>
          <h1 className="text-2xl font-black mt-1">User Accounts & Subscriptions</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Search reviewees, view subscription expiration dates, and grant manual access.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search email or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="p-2.5 px-4 bg-slate-800 border border-slate-700 text-white rounded-xl text-xs outline-none focus:border-amber-400 font-medium w-full sm:w-64 placeholder-slate-400"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-sm shrink-0"
          >
            Search
          </button>
        </form>
      </div>

      {/* Roster Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold uppercase">
                <th className="p-3.5 rounded-l-xl">User</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">PRO Access</th>
                <th className="p-3.5">Plan Type</th>
                <th className="p-3.5">Expires On</th>
                <th className="p-3.5 text-right rounded-r-xl">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium animate-pulse">
                    Loading reviewee accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No users matched your search query.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isExpired = u.paidUntil && new Date(u.paidUntil) < new Date();
                  const isActive = u.isPaid && !isExpired;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5">
                        <p className="font-extrabold text-slate-800">{u.name || "Reviewee"}</p>
                        <p className="text-slate-400 text-[11px] font-normal">{u.email}</p>
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

                      <td className="p-3.5 font-bold text-slate-700">
                        {u.planType === "1_YEAR" ? "1 Year" : u.planType || "None"}
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
                        <button
                          onClick={() => handleUpdateAccess(u.id, "EXTEND_30")}
                          disabled={updatingId === u.id}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] rounded-lg border border-blue-200 transition disabled:opacity-50"
                        >
                          +30 Days
                        </button>
                        <button
                          onClick={() => handleUpdateAccess(u.id, "EXTEND_180")}
                          disabled={updatingId === u.id}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] rounded-lg border border-emerald-200 transition disabled:opacity-50"
                        >
                          +180 Days
                        </button>
                        <button
                          onClick={() => handleUpdateAccess(u.id, "EXTEND_365")}
                          disabled={updatingId === u.id}
                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[10px] rounded-lg border border-purple-200 transition disabled:opacity-50"
                        >
                          +1 Year
                        </button>
                        {u.isPaid && (
                          <button
                            onClick={() => handleUpdateAccess(u.id, "REVOKE")}
                            disabled={updatingId === u.id}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] rounded-lg border border-rose-200 transition disabled:opacity-50"
                          >
                            Revoke PRO
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
      </div>
    </div>
  );
}