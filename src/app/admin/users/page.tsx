"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  isPaid: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (res.ok && data.users) setUsers(data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleTogglePayment = async (userId: string, currentPaidStatus: boolean) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isPaid: !currentPaidStatus }),
      });

      if (res.ok) {
        setUsers(
          users.map((u) => (u.id === userId ? { ...u, isPaid: !currentPaidStatus } : u))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-3xl">
        <div>
          <h1 className="text-2xl font-black">User Accounts & Subscriptions</h1>
          <p className="text-slate-400 text-xs mt-1">Manage reviewee accounts, grant manual upgrades, or view PRO status.</p>
        </div>
        <Link href="/admin/dashboard" className="px-4 py-2 bg-slate-800 text-xs font-bold rounded-xl border border-slate-700">
          Control Center
        </Link>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-slate-400 animate-pulse">Loading user accounts...</div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">PRO Access</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition">
                  <td className="p-4 font-extrabold text-slate-800">
                    <div>{u.name || "Reviewee"}</div>
                    <div className="text-[11px] font-normal text-slate-400">{u.email}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                      u.role === "ADMIN" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                      u.isPaid ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                    }`}>
                      {u.isPaid ? "✓ Paid PRO" : "Free Tier"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleTogglePayment(u.id, u.isPaid)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                        u.isPaid
                          ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                      }`}
                    >
                      {u.isPaid ? "Revoke PRO" : "Grant PRO Access"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}