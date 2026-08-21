// Relative Path: src/app/partner-portal/transactions/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Layers,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import PartnerPortalNav from "@/components/partner/PartnerPortalNav";

export default function PartnerTransactionsPage() {
  const router = useRouter();
  const [partner, setPartner] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const [authRes, txnRes] = await Promise.all([
        fetch("/api/partner/auth/me"),
        fetch("/api/partner/portal/transactions?limit=100"),
      ]);

      if (authRes.status === 401 || txnRes.status === 401) {
        router.push("/partner-portal/login");
        return;
      }

      if (authRes.ok) {
        const authJson = await authRes.json();
        setPartner(authJson.partner);
      }

      if (txnRes.ok) {
        const txnJson = await txnRes.json();
        setTransactions(txnJson.items || []);
      }
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      searchTerm === "" ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.planType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.campaignSource.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ||
      t.status.toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PartnerPortalNav partner={partner} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Layers className="w-6 h-6 text-emerald-400" />
              <span>Partner Transactions</span>
            </h1>
            <p className="text-xs text-slate-400">
              Chronological log of student upgrades referred through your partner link or promo code.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-slate-900 text-slate-300 border border-slate-800 rounded-xl text-xs font-mono font-bold">
              Total Records: {transactions.length}
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by transaction ID, plan, or channel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="PENDING">Holding (Pending)</option>
              <option value="PAID">Paid Out</option>
              <option value="REVERSED">Reversed</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading transactions...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="text-3xl">📊</div>
              <h3 className="text-sm font-bold text-white">No transactions found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No purchases match your selected filter criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                  <tr>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Transaction Ref</th>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Premium Plan</th>
                    <th className="py-3.5 px-4">Channel</th>
                    <th className="py-3.5 px-4 text-right">Customer Payment</th>
                    <th className="py-3.5 px-4">Rate</th>
                    <th className="py-3.5 px-4 text-right">Commission</th>
                    <th className="py-3.5 px-4">Commission Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-300 text-[11px]">
                        {t.id.slice(0, 14)}...
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{t.studentName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{t.studentEmailMasked}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-200">
                        {t.planType.replace(/_/g, " ")}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 font-bold uppercase">
                          {t.campaignSource}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        {t.formattedPurchaseAmount}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-400">
                        {t.effectiveRate}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                        {t.formattedCommissionAmount}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            t.status === "PAID"
                              ? "bg-teal-500/10 text-teal-400 border-teal-500/30"
                              : t.status === "AVAILABLE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : t.status === "REVERSED"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {t.status === "PENDING" ? "Holding" : t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-600 border-t border-slate-900">
        &copy; {new Date().getFullYear()} GovStudyX Partner Portal. Protected by enterprise security.
      </footer>
    </div>
  );
}
