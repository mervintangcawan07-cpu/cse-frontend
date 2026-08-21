// Relative Path: src/app/partner-portal/payouts/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Plus,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Lock,
  Smartphone,
  Building2,
  Trash2,
  Check,
  ShieldCheck,
} from "lucide-react";
import PartnerPortalNav from "@/components/partner/PartnerPortalNav";

export default function PartnerPayoutsPage() {
  const router = useRouter();
  const [partner, setPartner] = useState<any | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [savedMethods, setSavedMethods] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Request Payout Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [customMethod, setCustomMethod] = useState<"GCASH" | "MAYA" | "BANK_TRANSFER">("GCASH");
  const [customAccountName, setCustomAccountName] = useState("");
  const [customAccountNumber, setCustomAccountNumber] = useState("");
  const [customBankName, setCustomBankName] = useState("");
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);

  // Add Method Modal State
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);
  const [newMethod, setNewMethod] = useState<"GCASH" | "MAYA" | "BANK_TRANSFER">("GCASH");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [newBankName, setNewBankName] = useState("");
  const [newIsDefault, setNewIsDefault] = useState(true);
  const [addingMethod, setAddingMethod] = useState(false);
  const [methodError, setMethodError] = useState<string | null>(null);

  const fetchPayoutData = useCallback(async () => {
    setLoading(true);
    try {
      const [authRes, payoutRes] = await Promise.all([
        fetch("/api/partner/auth/me"),
        fetch("/api/partner/portal/payout"),
      ]);

      if (authRes.status === 401 || payoutRes.status === 401) {
        router.push("/partner-portal/login");
        return;
      }

      if (authRes.ok) {
        const authJson = await authRes.json();
        setPartner(authJson.partner);
      }

      if (payoutRes.ok) {
        const payoutJson = await payoutRes.json();
        setMetrics(payoutJson.metrics);
        setSavedMethods(payoutJson.savedMethods || []);
        setPayouts(payoutJson.payouts || []);

        const defaultMethod = (payoutJson.savedMethods || []).find((m: any) => m.isDefault);
        if (defaultMethod) {
          setSelectedProfileId(defaultMethod.id);
        }
      }
    } catch (err) {
      console.error("Failed to load payout data:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchPayoutData();
  }, [fetchPayoutData]);

  // Handle Payout Request Submit
  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPayout(true);
    setPayoutError(null);
    setPayoutSuccess(null);

    try {
      const payload: any = {
        amountPesos: payoutAmount,
      };

      if (selectedProfileId && selectedProfileId !== "CUSTOM") {
        payload.profileId = selectedProfileId;
      } else {
        payload.method = customMethod;
        payload.accountName = customAccountName;
        payload.accountNumber = customAccountNumber;
        if (customMethod === "BANK_TRANSFER") {
          payload.bankName = customBankName;
        }
      }

      const res = await fetch("/api/partner/portal/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setPayoutSuccess(json.message);
        setPayoutAmount("");
        await fetchPayoutData();
        setTimeout(() => {
          setShowRequestModal(false);
          setPayoutSuccess(null);
        }, 2500);
      } else {
        setPayoutError(json.error || "Failed to submit payout request.");
      }
    } catch {
      setPayoutError("Network error. Please try again.");
    } finally {
      setSubmittingPayout(false);
    }
  };

  // Handle Add Method Submit
  const handleAddMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingMethod(true);
    setMethodError(null);

    try {
      const res = await fetch("/api/partner/portal/payout-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: newMethod,
          accountHolderName: newAccountName,
          accountNumber: newAccountNumber,
          bankName: newMethod === "BANK_TRANSFER" ? newBankName : undefined,
          isDefault: newIsDefault,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setShowAddMethodModal(false);
        setNewAccountName("");
        setNewAccountNumber("");
        setNewBankName("");
        await fetchPayoutData();
      } else {
        setMethodError(json.error || "Failed to add payout method.");
      }
    } catch {
      setMethodError("Network error. Please try again.");
    } finally {
      setAddingMethod(false);
    }
  };

  // Handle Set Default Method
  const handleSetDefault = async (profileId: string) => {
    try {
      const res = await fetch("/api/partner/portal/payout-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      if (res.ok) {
        await fetchPayoutData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Delete Method
  const handleDeleteMethod = async (profileId: string) => {
    if (!confirm("Are you sure you want to remove this payout method?")) return;
    try {
      const res = await fetch(`/api/partner/portal/payout-methods?profileId=${profileId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchPayoutData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PartnerPortalNav partner={partner} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-emerald-400" />
              <span>Partner Payouts &amp; Disbursement</span>
            </h1>
            <p className="text-xs text-slate-400">
              Manage your GCash, Maya, and Bank Transfer payout methods and request atomic cash withdrawals.
            </p>
          </div>

          <button
            onClick={() => setShowRequestModal(true)}
            disabled={!metrics?.canRequestPayout}
            className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer self-start sm:self-auto ${
              metrics?.canRequestPayout
                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
                : "bg-slate-800 text-slate-500 opacity-60 cursor-not-allowed"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Request Payout</span>
          </button>
        </div>

        {/* 4 Payout Balance Metric Cards (Section 21) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>Available for Withdrawal</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {metrics?.formattedAvailableCommission || "₱0.00"}
            </div>
            <p className="text-[11px] text-slate-400">
              Min. Payout: {metrics?.formattedMinPayout}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>Reserved for Payout</span>
              <Lock className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-400 font-mono">
              {metrics?.formattedReservedForPayout || "₱0.00"}
            </div>
            <p className="text-[11px] text-slate-400">
              Atomic balance hold in review
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>Pending Holding</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono">
              {metrics?.formattedPendingCommission || "₱0.00"}
            </div>
            <p className="text-[11px] text-slate-400">
              Matures after holding period
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
              <span>Total Paid Out</span>
              <CheckCircle className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-2xl font-black text-teal-400 font-mono">
              {metrics?.formattedTotalPaid || "₱0.00"}
            </div>
            <p className="text-[11px] text-slate-400">
              Cumulative disbursements
            </p>
          </div>
        </div>

        {/* Saved Payout Methods Section (Section 22) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white">Registered Payout Methods</h3>
              <p className="text-xs text-slate-400">
                Securely registered payout accounts. Encrypted at rest and masked in UI.
              </p>
            </div>

            <button
              onClick={() => setShowAddMethodModal(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add Payout Method</span>
            </button>
          </div>

          {!savedMethods.length ? (
            <div className="py-8 text-center space-y-2">
              <div className="text-3xl">💳</div>
              <h4 className="text-sm font-bold text-white">No payout methods registered</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Add your GCash, Maya, or Philippine bank account to receive commission payouts.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {savedMethods.map((m) => (
                <div
                  key={m.id}
                  className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-3 ${
                    m.isDefault
                      ? "bg-slate-950 border-emerald-500/50 shadow-md shadow-emerald-500/10"
                      : "bg-slate-950 border-slate-800"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase font-mono text-emerald-400 flex items-center gap-1.5">
                        {m.method === "GCASH" ? <Smartphone className="w-3.5 h-3.5" /> : m.method === "MAYA" ? <Smartphone className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
                        <span>{m.method.replace("_", " ")}</span>
                      </span>
                      {m.isDefault && (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-black uppercase">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-sm text-white pt-1">{m.accountHolderName}</div>
                    <div className="font-mono text-xs text-slate-300 font-bold">{m.accountNumberMasked}</div>
                    {m.bankName && <div className="text-[11px] text-slate-400">{m.bankName}</div>}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
                    {!m.isDefault ? (
                      <button
                        onClick={() => handleSetDefault(m.id)}
                        className="text-slate-400 hover:text-emerald-400 font-bold cursor-pointer"
                      >
                        Set as Default
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Primary Method</span>
                      </span>
                    )}

                    <button
                      onClick={() => handleDeleteMethod(m.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                      title="Remove method"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payout History Table (Section 25) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-black text-white">Payout History</h3>
            <span className="text-xs text-slate-400 font-mono">Total Requests: {payouts.length}</span>
          </div>

          {!payouts.length ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No payout requests submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Account Holder</th>
                    <th className="py-3 px-4">Masked Destination</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Transaction Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(p.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-200">
                        {p.method.replace("_", " ")}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">{p.accountName}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-300">{p.accountNumberMasked}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                        {p.formattedAmount}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            p.status === "PAID"
                              ? "bg-teal-500/10 text-teal-400 border-teal-500/30"
                              : p.status === "APPROVED" || p.status === "PROCESSING"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                              : p.status === "REJECTED" || p.status === "FAILED"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {p.transactionRef || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Request Payout Modal */}
        {showRequestModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl text-white">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-black">Request Commission Payout</h3>
                  <p className="text-xs text-slate-400">
                    Available Balance: <strong className="text-emerald-400 font-mono">{metrics?.formattedAvailableCommission}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {payoutError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-300">
                  {payoutError}
                </div>
              )}

              {payoutSuccess && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-300">
                  {payoutSuccess}
                </div>
              )}

              <form onSubmit={handlePayoutSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                    Payout Amount (PHP) &bull; Min {metrics?.formattedMinPayout}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 500.00"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none focus:border-emerald-500"
                  />
                </div>

                {savedMethods.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                      Select Destination Account
                    </label>
                    <select
                      value={selectedProfileId}
                      onChange={(e) => setSelectedProfileId(e.target.value)}
                      className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                    >
                      {savedMethods.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.method.replace("_", " ")} — {m.accountHolderName} ({m.accountNumberMasked}) {m.isDefault ? "[Default]" : ""}
                        </option>
                      ))}
                      <option value="CUSTOM">Enter different account details...</option>
                    </select>
                  </div>
                )}

                {(!savedMethods.length || selectedProfileId === "CUSTOM") && (
                  <div className="space-y-4 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Disbursement Method</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["GCASH", "MAYA", "BANK_TRANSFER"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setCustomMethod(m)}
                            className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                              customMethod === m
                                ? "bg-emerald-500 border-emerald-400 text-slate-950 font-black"
                                : "bg-slate-900 border-slate-800 text-slate-400"
                            }`}
                          >
                            {m === "GCASH" ? "GCash" : m === "MAYA" ? "Maya" : "Bank"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Juan Dela Cruz"
                        value={customAccountName}
                        onChange={(e) => setCustomAccountName(e.target.value)}
                        className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        {customMethod === "BANK_TRANSFER" ? "Account Number" : "Mobile Number (09XXXXXXXXX)"}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={customMethod === "BANK_TRANSFER" ? "1234567890" : "09171234567"}
                        value={customAccountNumber}
                        onChange={(e) => setCustomAccountNumber(e.target.value)}
                        className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none focus:border-emerald-500"
                      />
                    </div>

                    {customMethod === "BANK_TRANSFER" && (
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Bank Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. BDO, BPI, UnionBank"
                          value={customBankName}
                          onChange={(e) => setCustomBankName(e.target.value)}
                          className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span>Funds are atomically reserved upon request. Disbursed within 1-2 business days.</span>
                </div>

                <button
                  type="submit"
                  disabled={submittingPayout}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-500/25 cursor-pointer disabled:opacity-50"
                >
                  {submittingPayout ? "Reserving Funds & Submitting..." : "Confirm & Submit Withdrawal"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Add Payout Method Modal */}
        {showAddMethodModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl text-white">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-base font-black">Register New Payout Method</h3>
                <button
                  onClick={() => setShowAddMethodModal(false)}
                  className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {methodError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-300">
                  {methodError}
                </div>
              )}

              <form onSubmit={handleAddMethodSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["GCASH", "MAYA", "BANK_TRANSFER"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setNewMethod(m)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                          newMethod === m
                            ? "bg-emerald-500 border-emerald-400 text-slate-950 font-black"
                            : "bg-slate-950 border-slate-800 text-slate-400"
                        }`}
                      >
                        {m === "GCASH" ? "GCash" : m === "MAYA" ? "Maya" : "Bank Transfer"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Account Holder Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Full Name as registered with account"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                    {newMethod === "BANK_TRANSFER" ? "Bank Account Number" : "Mobile Number (09XXXXXXXXX)"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={newMethod === "BANK_TRANSFER" ? "e.g. 1234567890" : "09171234567"}
                    value={newAccountNumber}
                    onChange={(e) => setNewAccountNumber(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none focus:border-emerald-500"
                  />
                </div>

                {newMethod === "BANK_TRANSFER" && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Bank Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BDO, BPI, Metrobank, UnionBank"
                      value={newBankName}
                      onChange={(e) => setNewBankName(e.target.value)}
                      className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isDef"
                    checked={newIsDefault}
                    onChange={(e) => setNewIsDefault(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0"
                  />
                  <label htmlFor="isDef" className="text-xs text-slate-300 cursor-pointer">
                    Set as default payout method
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={addingMethod}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-500/25 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {addingMethod ? "Saving Method..." : "Save Payout Method"}
                </button>
              </form>
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
