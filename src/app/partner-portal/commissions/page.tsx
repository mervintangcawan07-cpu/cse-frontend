// Relative Path: src/app/partner-portal/commissions/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  Info,
  Clock,
  CheckCircle,
  Award,
  ArrowRight,
  Eye,
  Calculator,
  ShieldCheck,
} from "lucide-react";
import PartnerPortalNav from "@/components/partner/PartnerPortalNav";

export default function PartnerCommissionsPage() {
  const router = useRouter();
  const [partner, setPartner] = useState<any | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCalc, setSelectedCalc] = useState<any | null>(null);

  const fetchCommissions = useCallback(async () => {
    setLoading(true);
    try {
      const [authRes, commRes] = await Promise.all([
        fetch("/api/partner/auth/me"),
        fetch("/api/partner/portal/commissions?limit=100"),
      ]);

      if (authRes.status === 401 || commRes.status === 401) {
        router.push("/partner-portal/login");
        return;
      }

      if (authRes.ok) {
        const authJson = await authRes.json();
        setPartner(authJson.partner);
      }

      if (commRes.ok) {
        const commJson = await commRes.json();
        setSummary(commJson.summary);
        setCommissions(commJson.items || []);
      }
    } catch (err) {
      console.error("Failed to load commissions:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PartnerPortalNav partner={partner} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              <span>Commissions &amp; Calculation Engine</span>
            </h1>
            <p className="text-xs text-slate-400">
              Transparent, integer-centavo accurate ledger of all commissions earned with formula drill-downs.
            </p>
          </div>

          <Link
            href="/partner-portal/statements"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold rounded-xl text-white transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>Periodic Statements</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 6 Commission Summary Cards (Section 16) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
            <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>Total Earned</span>
              <Award className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-black text-purple-400 font-mono">
              {summary?.formattedTotalEarned || "₱0.00"}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
            <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>Available</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono">
              {summary?.formattedAvailable || "₱0.00"}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
            <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>Pending Holding</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400 font-mono">
              {summary?.formattedPending || "₱0.00"}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
            <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>Paid Out</span>
              <CheckCircle className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="text-xl font-black text-teal-400 font-mono">
              {summary?.formattedPaid || "₱0.00"}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
            <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>Reversed</span>
              <Info className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-black text-rose-400 font-mono">
              {summary?.formattedReversed || "₱0.00"}
            </div>
          </div>
        </div>

        {/* Commissions Table with View Calculation */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-black text-white">Commissions Ledger</h3>
            <span className="text-xs text-slate-400 font-mono">Total: {commissions.length} entries</span>
          </div>

          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading commissions...</p>
            </div>
          ) : commissions.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="text-3xl">💰</div>
              <h3 className="text-sm font-bold text-white">No commissions accrued yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                When students purchase premium memberships using your partner link, your earned commissions will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                  <tr>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4 text-right">Qualifying Payment</th>
                    <th className="py-3.5 px-4">Rate</th>
                    <th className="py-3.5 px-4 text-right">Commission</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(c.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{c.studentName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{c.studentEmailMasked}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        {c.formattedPurchase}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-400">
                        {c.effectiveRate}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                        {c.formattedCommission}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            c.status === "PAID"
                              ? "bg-teal-500/10 text-teal-400 border-teal-500/30"
                              : c.status === "AVAILABLE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : c.status === "REVERSED"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedCalc(c)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-lg border border-slate-700 transition cursor-pointer inline-flex items-center gap-1"
                        >
                          <Calculator className="w-3 h-3 text-emerald-400" />
                          <span>View Calculation</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* View Calculation Modal (Section 16) */}
        {selectedCalc && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl text-white">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black">Commission Calculation</h3>
                    <p className="text-[11px] text-slate-400 font-mono">Txn: {selectedCalc.id.slice(0, 16)}...</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCalc(null)}
                  className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Qualifying Customer Payment:</span>
                  <span className="font-mono font-bold text-white">{selectedCalc.calculation.purchaseAmountPesos}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Partner Agreement Rate:</span>
                  <span className="font-mono font-bold text-purple-400">{selectedCalc.calculation.ratePercent}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Calculation Basis:</span>
                  <span className="font-bold text-slate-200">{selectedCalc.calculation.basis}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Applied Formula:</span>
                  <span className="font-mono font-bold text-emerald-300">{selectedCalc.calculation.formula}</span>
                </div>
                <div className="flex justify-between py-1 text-sm font-bold pt-2">
                  <span className="text-emerald-400">Partner Commission:</span>
                  <span className="font-mono text-emerald-400 font-black text-base">{selectedCalc.calculation.commissionPesos}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>Computed server-side with zero floating-point rounding errors ({selectedCalc.commissionAmountCentavos} centavos).</span>
              </div>

              <button
                onClick={() => setSelectedCalc(null)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="py-4 text-center text-xs text-slate-600 border-t border-slate-900">
        &copy; {new Date().getFullYear()} GovStudyX Partner Portal. Protected by enterprise security.
      </footer>
    </div>
  );
}
