// Relative Path: src/app/partner-portal/statements/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Download,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Layers,
  DollarSign,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import PartnerPortalNav from "@/components/partner/PartnerPortalNav";

export default function PartnerStatementsPage() {
  const router = useRouter();
  const [partner, setPartner] = useState<any | null>(null);
  const [period, setPeriod] = useState("THIS_MONTH");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [statement, setStatement] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatement = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/partner/portal/statements?period=${period}`;
      if (period === "CUSTOM" && customStart && customEnd) {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }

      const [authRes, stmtRes] = await Promise.all([
        fetch("/api/partner/auth/me"),
        fetch(url),
      ]);

      if (authRes.status === 401 || stmtRes.status === 401) {
        router.push("/partner-portal/login");
        return;
      }

      if (authRes.ok) {
        const authJson = await authRes.json();
        setPartner(authJson.partner);
      }

      if (stmtRes.ok) {
        const stmtJson = await stmtRes.json();
        setStatement(stmtJson.data);
      }
    } catch (err) {
      console.error("Failed to load statement:", err);
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd, router]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  const getExportUrl = (format: "xlsx" | "csv" | "pdf") => {
    let url = `/api/partner/portal/statements/export?format=${format}&period=${period}`;
    if (period === "CUSTOM" && customStart && customEnd) {
      url += `&startDate=${customStart}&endDate=${customEnd}`;
    }
    return url;
  };

  const { summary, reconciliation, transactions, payouts } = statement || {};

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PartnerPortalNav partner={partner} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-emerald-400" />
              <span>Partner Financial Statements</span>
            </h1>
            <p className="text-xs text-slate-400">
              Authoritative periodic financial statements reconciled with double-entry general ledger.
            </p>
          </div>

          {/* Export Action Buttons (Section 18) */}
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={getExportUrl("xlsx")}
              download
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download XLSX (6 Sheets)</span>
            </a>

            <a
              href={getExportUrl("csv")}
              download
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </a>

            <a
              href={getExportUrl("pdf")}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </a>
          </div>
        </div>

        {/* Period Selector Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Statement Period:</span>
            </span>

            {[
              { id: "THIS_MONTH", label: "This Month" },
              { id: "LAST_MONTH", label: "Last Month" },
              { id: "THIS_QUARTER", label: "This Quarter" },
              { id: "THIS_YEAR", label: "This Year" },
              { id: "CUSTOM", label: "Custom Range" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  period === p.id
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                    : "bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === "CUSTOM" && (
            <div className="flex items-center gap-2 w-full sm:w-auto text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Generating financial statement...</p>
          </div>
        ) : !statement ? (
          <div className="py-20 text-center text-xs text-slate-400">
            Failed to load statement data.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Statement Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Statement Reference</span>
                  <div className="font-mono text-lg font-black text-white">{statement.statementReference}</div>
                  <p className="text-xs text-slate-400">{statement.period?.label}</p>
                </div>

                {/* Reconciliation Badge (Section 19) */}
                <div className="flex items-center gap-2 bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-800">
                  {reconciliation?.isReconciled ? (
                    <>
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <div>
                        <div className="text-xs font-black text-emerald-400 uppercase">RECONCILED &bull; MATCHED</div>
                        <div className="text-[10px] text-slate-400">Balances balanced with General Ledger</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      <div>
                        <div className="text-xs font-black text-amber-400 uppercase">RECONCILIATION REQUIRED</div>
                        <div className="text-[10px] text-slate-400">Discrepancy: {reconciliation?.discrepancyCentavos} centavos</div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Statement Breakdown Table */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800/80 pb-2">
                    Accrued Revenue &amp; Commissions
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Qualifying Customer Payments:</span>
                      <span className="font-mono font-bold text-white">{summary?.formattedQualifyingPayments}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Gross Commission Accrued:</span>
                      <span className="font-mono font-bold text-purple-400">{summary?.formattedGrossCommission}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Refund &amp; Chargeback Reversals:</span>
                      <span className="font-mono font-bold text-rose-400">{summary?.formattedRefundReversals}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Financial Adjustments:</span>
                      <span className="font-mono font-bold text-slate-300">{summary?.formattedAdjustments}</span>
                    </div>
                    <div className="flex justify-between py-1 pt-2 font-bold text-sm">
                      <span className="text-white">Net Commission Earned:</span>
                      <span className="font-mono text-emerald-400 font-black">{summary?.formattedNetCommission}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800/80 pb-2">
                    Disbursements &amp; Settlement
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Total Paid Out to Date:</span>
                      <span className="font-mono font-bold text-teal-400">{summary?.formattedPaid}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Reserved for Pending Payouts:</span>
                      <span className="font-mono font-bold text-blue-400">{summary?.formattedReserved}</span>
                    </div>
                    <div className="flex justify-between py-1 pt-3 border-t-2 border-slate-800 text-sm font-bold">
                      <span className="text-emerald-400">Outstanding Available Balance:</span>
                      <span className="font-mono text-emerald-400 font-black text-lg">{summary?.formattedOutstanding}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Statement Transactions Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Period Transactions ({transactions?.length || 0})
                </h3>
              </div>

              {!transactions?.length ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No student transactions recorded in this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Transaction ID</th>
                        <th className="py-3 px-4">Plan Type</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4 text-right">Payment</th>
                        <th className="py-3 px-4">Rate</th>
                        <th className="py-3 px-4 text-right">Commission</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {transactions.map((t: any) => (
                        <tr key={t.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{t.date.slice(0, 10)}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-300">{t.id.slice(0, 12)}...</td>
                          <td className="py-3 px-4 font-bold text-slate-200">{t.planType.replace(/_/g, " ")}</td>
                          <td className="py-3 px-4 text-slate-300 font-mono">{t.customerMasked}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white">{t.formattedPurchase}</td>
                          <td className="py-3 px-4 font-mono font-bold text-purple-400">{t.effectiveRate}%</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">{t.formattedCommission}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-950 border border-slate-800 text-slate-300">
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
