// Relative Path: src/app/admin/accounting/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  DollarSign,
  FileText,
  TrendingUp,
  TrendingDown,
  Users,
  ShieldCheck,
  Scale,
  Clock,
  ArrowRight,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Plus,
  Building2,
  Smartphone,
  Eye,
  Sliders,
  RefreshCw,
  Info,
  Layers,
  Calendar,
  Lock,
  ExternalLink,
} from "lucide-react";
import {
  WaterfallSummary,
  CalculationExplanation,
  DrillDownItem,
  FinancialSettingsConfig,
} from "@/lib/accounting/types";
import { formatCentavosToPesos } from "@/lib/accounting/money";

export default function AdminAccountingPage() {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "ledger"
    | "transactions"
    | "partners"
    | "applications"
    | "taxes_deductions"
    | "payouts"
    | "reconciliation"
    | "reports"
    | "periods"
    | "settings"
  >("overview");

  // Overview State
  const [dateRange, setDateRange] = useState("all");
  const [waterfall, setWaterfall] = useState<WaterfallSummary | null>(null);
  const [ledgerBalance, setLedgerBalance] = useState<any | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Drilldown Modal State
  const [showDrilldownModal, setShowDrilldownModal] = useState(false);
  const [drilldownType, setDrilldownType] = useState<string>("gross_sales");
  const [drilldownExplanation, setDrilldownExplanation] = useState<CalculationExplanation | null>(null);
  const [drilldownItems, setDrilldownItems] = useState<any[]>([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // Ledger Journal State
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState("ALL");
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Partners State
  const [partners, setPartners] = useState<any[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [showCreatePartnerModal, setShowCreatePartnerModal] = useState(false);
  const [selectedPartnerStatement, setSelectedPartnerStatement] = useState<any | null>(null);

  // Payouts State
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutModalItem, setPayoutModalItem] = useState<any | null>(null);
  const [payoutAction, setPayoutAction] = useState<"APPROVE" | "REJECT" | "MARK_PAID">("MARK_PAID");
  const [payoutTxnRef, setPayoutTxnRef] = useState("");
  const [payoutAdminNote, setPayoutAdminNote] = useState("");
  const [processingPayout, setProcessingPayout] = useState(false);

  // Taxes & Deductions State
  const [taxConfigs, setTaxConfigs] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [showCreateTaxModal, setShowCreateTaxModal] = useState(false);
  const [showCreateDeductionModal, setShowCreateDeductionModal] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<FinancialSettingsConfig | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  // Partner Applications State
  const [applications, setApplications] = useState<any[]>([]);
  const [pendingAppsCount, setPendingAppsCount] = useState(0);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [appStatusFilter, setAppStatusFilter] = useState("ALL");
  const [selectedAppForAction, setSelectedAppForAction] = useState<any | null>(null);
  const [appActionType, setAppActionType] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [appRateInput, setAppRateInput] = useState("10.0");
  const [appSlugInput, setAppSlugInput] = useState("");
  const [appPasswordInput, setAppPasswordInput] = useState("");
  const [appAdminNotes, setAppAdminNotes] = useState("");
  const [processingAppAction, setProcessingAppAction] = useState(false);

  // Fetch Applications
  const fetchApplications = useCallback(async () => {
    setApplicationsLoading(true);
    try {
      const res = await fetch(`/api/admin/accounting/applications?status=${appStatusFilter}`);
      if (res.ok) {
        const json = await res.json();
        setApplications(json.applications || []);
        setPendingAppsCount(json.pendingCount || 0);
      }
    } catch (err) {
      console.error("Failed to load applications:", err);
    } finally {
      setApplicationsLoading(false);
    }
  }, [appStatusFilter]);

  // Fetch Overview Waterfall
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch(`/api/admin/accounting/overview?range=${dateRange}`);
      if (res.ok) {
        const json = await res.json();
        setWaterfall(json.waterfall);
        setLedgerBalance(json.ledgerBalance);
      }
    } catch (err) {
      console.error("Failed to load accounting overview:", err);
    } finally {
      setOverviewLoading(false);
    }
  }, [dateRange]);

  // Fetch Drilldown
  const handleOpenDrilldown = async (metricType: string) => {
    setDrilldownType(metricType);
    setShowDrilldownModal(true);
    setDrilldownLoading(true);
    try {
      const res = await fetch(`/api/admin/accounting/drilldown?type=${metricType}`);
      if (res.ok) {
        const json = await res.json();
        setDrilldownExplanation(json.explanation);
        setDrilldownItems(json.items || []);
      }
    } catch (err) {
      console.error("Failed to load drilldown data:", err);
    } finally {
      setDrilldownLoading(false);
    }
  };

  // Fetch Ledger Journal
  const fetchLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/admin/accounting/ledger?category=${ledgerCategoryFilter}`);
      if (res.ok) {
        const json = await res.json();
        setLedgerEntries(json.items || []);
      }
    } catch (err) {
      console.error("Failed to load ledger:", err);
    } finally {
      setLedgerLoading(false);
    }
  }, [ledgerCategoryFilter]);

  // Fetch Partners
  const fetchPartners = useCallback(async () => {
    setPartnersLoading(true);
    try {
      const res = await fetch("/api/admin/accounting/partners");
      if (res.ok) {
        const json = await res.json();
        setPartners(json.partners || []);
      }
    } catch (err) {
      console.error("Failed to load partners:", err);
    } finally {
      setPartnersLoading(false);
    }
  }, []);

  // Fetch Payouts
  const fetchPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const res = await fetch("/api/admin/accounting/payouts");
      if (res.ok) {
        const json = await res.json();
        setPayouts(json.payouts || []);
      }
    } catch (err) {
      console.error("Failed to load payouts:", err);
    } finally {
      setPayoutsLoading(false);
    }
  }, []);

  // Fetch Taxes & Deductions
  const fetchTaxesAndDeductions = useCallback(async () => {
    try {
      const [taxRes, dedRes] = await Promise.all([
        fetch("/api/admin/accounting/taxes"),
        fetch("/api/admin/accounting/deductions"),
      ]);
      if (taxRes.ok) {
        const json = await taxRes.json();
        setTaxConfigs(json.taxConfigs || []);
      }
      if (dedRes.ok) {
        const json = await dedRes.json();
        setDeductions(json.deductions || []);
      }
    } catch (err) {
      console.error("Failed to load taxes and deductions:", err);
    }
  }, []);

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/accounting/settings");
      if (res.ok) {
        const json = await res.json();
        setSettings(json.config);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    fetchLedger();
    fetchPartners();
    fetchPayouts();
    fetchTaxesAndDeductions();
    fetchSettings();
    fetchApplications();
  }, [
    fetchOverview,
    fetchLedger,
    fetchPartners,
    fetchPayouts,
    fetchTaxesAndDeductions,
    fetchSettings,
    fetchApplications,
  ]);

  // Handle Partner Application Action (Approve / Reject)
  const handleProcessApplicationAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppForAction) return;
    setProcessingAppAction(true);
    try {
      const res = await fetch(
        `/api/admin/accounting/applications/${selectedAppForAction.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: appActionType,
            commissionRate: appRateInput,
            customSlug: appSlugInput || undefined,
            initialPassword: appPasswordInput,
            adminNotes: appAdminNotes,
          }),
        }
      );
      const json = await res.json();
      if (res.ok && json.success) {
        alert(json.message);
        setSelectedAppForAction(null);
        setAppAdminNotes("");
        await fetchApplications();
        await fetchPartners();
      } else {
        alert(json.error || "Failed to process application.");
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setProcessingAppAction(false);
    }
  };

  // Handle Payout Fulfillment Submit
  const handleProcessPayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutModalItem) return;
    setProcessingPayout(true);
    try {
      const res = await fetch("/api/admin/accounting/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutId: payoutModalItem.id,
          payoutType: payoutModalItem.payoutType,
          action: payoutAction,
          adminNotes: payoutAdminNote,
          transactionRef: payoutTxnRef,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPayoutModalItem(null);
        setPayoutTxnRef("");
        setPayoutAdminNote("");
        await fetchPayouts();
        await fetchOverview();
      } else {
        alert(json.error || "Failed to process payout.");
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setProcessingPayout(false);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await fetch("/api/admin/accounting/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSettingsMsg("✅ Financial configuration saved!");
        await fetchSettings();
      } else {
        setSettingsMsg(json.error || "Failed to save settings.");
      }
    } catch (err) {
      setSettingsMsg("Network error.");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 text-slate-100">
      {/* Top Header Banner */}
      <div className="border-b border-slate-800 pb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase tracking-wide">
              FINANCIAL COMMAND CENTER
            </span>
            <span
              className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                ledgerBalance?.isBalanced
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/30"
              }`}
            >
              LEDGER: {ledgerBalance?.isBalanced ? "BALANCED (0 DISCREPANCY)" : "OUT OF BALANCE"}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-2">Accounting &amp; Financial Management</h1>
          <p className="text-slate-400 text-sm mt-1">
            Immutable general journal, transparent calculation waterfall, partner commissions, and cash reconciliation.
          </p>
        </div>

        {/* Global Date Filter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl text-xs font-bold">
            <Calendar className="w-4 h-4 text-emerald-400 ml-2" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent text-white outline-none px-2 py-1 cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Time</option>
              <option value="today" className="bg-slate-900">Today</option>
              <option value="7d" className="bg-slate-900">Last 7 Days</option>
              <option value="30d" className="bg-slate-900">Last 30 Days</option>
              <option value="this_month" className="bg-slate-900">This Month</option>
            </select>
          </div>

          <a
            href="/api/admin/accounting/reports?format=csv&type=ledger"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Categorized Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 border border-slate-800 p-1.5 rounded-2xl text-xs font-bold">
        {[
          { id: "overview", label: "Waterfall Overview" },
          { id: "ledger", label: "General Ledger" },
          { id: "partners", label: `Partners (${partners.length})` },
          {
            id: "applications",
            label: `Applications (${pendingAppsCount} Pending)`,
          },
          { id: "taxes_deductions", label: "Taxes & Deductions" },
          { id: "payouts", label: `Payouts Queue (${payouts.length})` },
          { id: "reconciliation", label: "Reconciliation" },
          { id: "settings", label: "Settings & Flags" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === tab.id
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {tab.id === "applications" && pendingAppsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: WATERFALL OVERVIEW & 1-CLICK DRILL-DOWN */}
      {/* ========================================================================= */}
      {activeTab === "overview" && waterfall && (
        <div className="space-y-8">
          {/* Top Cash & Liability Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                <span>Net Accounting Result</span>
                <Scale className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400">
                {formatCentavosToPesos(waterfall.netAccountingResultCentavos)}
              </div>
              <p className="text-[11px] text-slate-400">Derived server-side balance</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                <span>Available Cash Balance</span>
                <DollarSign className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-black text-white">
                {formatCentavosToPesos(waterfall.availableBalanceCentavos)}
              </div>
              <p className="text-[11px] text-slate-400">Net of fees, paid rewards &amp; expenses</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                <span>Pending Liabilities</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400">
                {formatCentavosToPesos(waterfall.pendingLiabilitiesCentavos)}
              </div>
              <p className="text-[11px] text-slate-400">Unpaid referral, partner &amp; tax reserves</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <div className="text-xs font-bold uppercase text-slate-400 flex items-center justify-between">
                <span>Pending Payout Requests</span>
                <AlertTriangle className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-white">
                {formatCentavosToPesos(waterfall.pendingPayoutsCentavos)}
              </div>
              <p className="text-[11px] text-slate-400">Awaiting admin fulfillment</p>
            </div>
          </div>

          {/* Interactive Calculation Waterfall Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  <span>Authoritative Financial Waterfall</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any financial amount below to inspect underlying records and mathematical formulas.
                </p>
              </div>
              <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-bold font-mono">
                100% INTEGER CENTAVO ARITHMETIC
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                  <tr>
                    <th className="py-3.5 px-4">Financial Waterfall Item</th>
                    <th className="py-3.5 px-4">Accounting Treatment</th>
                    <th className="py-3.5 px-4">Records Count</th>
                    <th className="py-3.5 px-4 text-right">Amount (PHP)</th>
                    <th className="py-3.5 px-4 text-right">Drill-Down Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {/* 1. Gross Sales */}
                  <tr className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-4 font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Gross Premium Sales</span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">Total list price volume</td>
                    <td className="py-4 px-4 font-mono text-xs">{waterfall.grossSalesCount} sales</td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-white">
                      {formatCentavosToPesos(waterfall.grossPremiumSalesCentavos)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleOpenDrilldown("gross_sales")}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs font-bold cursor-pointer transition"
                      >
                        Drill Down ➔
                      </button>
                    </td>
                  </tr>

                  {/* 2. Discounts */}
                  <tr className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-4 font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>LESS: Discounts &amp; Coupons</span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">Direct reduction to customer base</td>
                    <td className="py-4 px-4 font-mono text-xs">{waterfall.discountCount} discounted</td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-amber-400">
                      -{formatCentavosToPesos(waterfall.discountsCentavos)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleOpenDrilldown("discounts")}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-xs font-bold cursor-pointer transition"
                      >
                        Drill Down ➔
                      </button>
                    </td>
                  </tr>

                  {/* 3. Customer Payments (Collected) */}
                  <tr className="bg-slate-950/40 font-bold">
                    <td className="py-4 px-4 text-emerald-400 flex items-center gap-2">
                      <span>EQUALS: Customer Payments (Collected)</span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-300">Authoritative qualifying reward base</td>
                    <td className="py-4 px-4 font-mono text-xs text-slate-300">{waterfall.customerPaymentCount} payments</td>
                    <td className="py-4 px-4 text-right font-mono text-base text-emerald-400">
                      {formatCentavosToPesos(waterfall.customerPaymentsCentavos)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleOpenDrilldown("customer_payments")}
                        className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-xs font-bold cursor-pointer transition"
                      >
                        Drill Down ➔
                      </button>
                    </td>
                  </tr>

                  {/* 4. PayMongo Fees */}
                  <tr className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-4 font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      <span>LESS: PayMongo Gateway Fees</span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">Excluded from reducing referral base</td>
                    <td className="py-4 px-4 font-mono text-xs">{waterfall.paymongoFeeCount} fees</td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-rose-400">
                      -{formatCentavosToPesos(waterfall.paymongoFeesCentavos)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleOpenDrilldown("paymongo_fees")}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg text-xs font-bold cursor-pointer transition"
                      >
                        Drill Down ➔
                      </button>
                    </td>
                  </tr>

                  {/* 5. Referral Rewards */}
                  <tr className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-4 font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      <span>LESS: Student Referral Rewards (20%)</span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">7-day hold liability</td>
                    <td className="py-4 px-4 font-mono text-xs">{waterfall.referralRewardCount} rewards</td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-sky-400">
                      -{formatCentavosToPesos(waterfall.referralRewardsCentavos)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleOpenDrilldown("referral_rewards")}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-xs font-bold cursor-pointer transition"
                      >
                        Drill Down ➔
                      </button>
                    </td>
                  </tr>

                  {/* 6. Partner Commissions */}
                  <tr className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-4 font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      <span>LESS: Partner Commissions</span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">FB pages, schools, creators</td>
                    <td className="py-4 px-4 font-mono text-xs">{waterfall.partnerCommissionCount} commissions</td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-purple-400">
                      -{formatCentavosToPesos(waterfall.partnerCommissionsCentavos)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleOpenDrilldown("partner_commissions")}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-400 rounded-lg text-xs font-bold cursor-pointer transition"
                      >
                        Drill Down ➔
                      </button>
                    </td>
                  </tr>

                  {/* 7. Tax Provisions */}
                  <tr className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-4 font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-400" />
                      <span>LESS: Tax Provisions &amp; Reserves</span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">Configurable policy estimate</td>
                    <td className="py-4 px-4 font-mono text-xs">{waterfall.taxRecordCount} records</td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-indigo-400">
                      -{formatCentavosToPesos(waterfall.taxProvisionsCentavos)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleOpenDrilldown("taxes")}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-lg text-xs font-bold cursor-pointer transition"
                      >
                        Drill Down ➔
                      </button>
                    </td>
                  </tr>

                  {/* 8. Other Deductions */}
                  <tr className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-4 font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      <span>LESS: Operational Deductions</span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">Hosting, marketing, platform</td>
                    <td className="py-4 px-4 font-mono text-xs">{waterfall.otherDeductionCount} expenses</td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-slate-300">
                      -{formatCentavosToPesos(waterfall.otherDeductionsCentavos)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleOpenDrilldown("deductions")}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold cursor-pointer transition"
                      >
                        Drill Down ➔
                      </button>
                    </td>
                  </tr>

                  {/* FINAL: Net Accounting Result */}
                  <tr className="bg-slate-950 font-black border-t-2 border-emerald-500">
                    <td className="py-5 px-4 text-base text-white">
                      NET ACCOUNTING RESULT
                    </td>
                    <td className="py-5 px-4 text-xs text-slate-400">
                      Authoritative server-side management balance
                    </td>
                    <td className="py-5 px-4 font-mono text-xs text-emerald-400">
                      Reconciled to Centavo
                    </td>
                    <td className="py-5 px-4 text-right font-mono text-xl text-emerald-400">
                      {formatCentavosToPesos(waterfall.netAccountingResultCentavos)}
                    </td>
                    <td className="py-5 px-4 text-right">
                      <button
                        onClick={() => handleOpenDrilldown("net_result")}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition shadow-lg shadow-emerald-500/20"
                      >
                        Formula Breakdown ➔
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GENERAL JOURNAL (DOUBLE-ENTRY LEDGER) */}
      {/* ========================================================================= */}
      {activeTab === "ledger" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-white">General Journal Double-Entry Ledger</h3>
              <p className="text-xs text-slate-400">
                Immutable chronological record of all debits and credits across the application.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={ledgerCategoryFilter}
                onChange={(e) => setLedgerCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300 outline-none"
              >
                <option value="ALL">All Account Categories</option>
                <option value="CASH_PAYMONGO">CASH_PAYMONGO</option>
                <option value="REVENUE_PREMIUM">REVENUE_PREMIUM</option>
                <option value="EXPENSE_PAYMENT_FEE">EXPENSE_PAYMENT_FEE</option>
                <option value="EXPENSE_REFERRAL">EXPENSE_REFERRAL</option>
                <option value="LIABILITY_REFERRAL_PAYABLE">LIABILITY_REFERRAL_PAYABLE</option>
                <option value="EXPENSE_PARTNER">EXPENSE_PARTNER</option>
                <option value="LIABILITY_PARTNER_PAYABLE">LIABILITY_PARTNER_PAYABLE</option>
                <option value="EXPENSE_TAX">EXPENSE_TAX</option>
                <option value="LIABILITY_TAX_PAYABLE">LIABILITY_TAX_PAYABLE</option>
                <option value="EXPENSE_OPERATIONAL">EXPENSE_OPERATIONAL</option>
              </select>
            </div>
          </div>

          {ledgerLoading ? (
            <div className="py-20 text-center text-xs text-slate-400">Loading ledger entries...</div>
          ) : !ledgerEntries.length ? (
            <div className="py-20 text-center text-xs text-slate-400">No ledger entries found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                  <tr>
                    <th className="py-3 px-4">Entry #</th>
                    <th className="py-3 px-4">Effective Date</th>
                    <th className="py-3 px-4">Transaction Type</th>
                    <th className="py-3 px-4">Account Category</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Debit (PHP)</th>
                    <th className="py-3 px-4 text-right">Credit (PHP)</th>
                    <th className="py-3 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {ledgerEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">{e.entryNumber}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(e.effectiveDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{e.transactionType}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-200">{e.accountCategory}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            e.entryType === "DEBIT"
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          }`}
                        >
                          {e.entryType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {e.entryType === "DEBIT" ? e.formattedAmount : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {e.entryType === "CREDIT" ? e.formattedAmount : "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate">{e.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PARTNERS & STATEMENTS */}
      {/* ========================================================================= */}
      {activeTab === "partners" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white">Registered Partners &amp; Collaborators</h3>
              <p className="text-xs text-slate-400">Facebook pages, content creators, host collaborators, and institutions.</p>
            </div>
            <button
              onClick={() => setShowCreatePartnerModal(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Partner</span>
            </button>
          </div>

          {partnersLoading ? (
            <div className="py-20 text-center text-xs text-slate-400">Loading partners...</div>
          ) : !partners.length ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <div className="text-3xl">🤝</div>
              <h4 className="text-base font-black text-white">No partners registered yet</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Register your first collaborator (e.g. FB Page admin or review center) to assign custom tracking links and commission models.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {partners.map((p) => (
                <div
                  key={p.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {p.type.replace("_", " ")}
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {p.partnerId || p.code}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-black text-white">{p.name}</h4>
                      <p className="text-xs text-slate-400">{p.contactEmail || p.contactName || "No contact info"}</p>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1.5 font-mono">
                      <div className="flex justify-between text-slate-400">
                        <span>Commission:</span>
                        <span className="font-bold text-purple-400">{p.commissionRate}%</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Referred Sales:</span>
                        <span className="font-bold text-white">{p.totalConversionsCount}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Generated Revenue:</span>
                        <span className="font-bold text-emerald-400">{p.formattedRevenue}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Outstanding Balance:</span>
                        <span className="font-bold text-amber-400">{p.formattedAvailable}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/admin/accounting/partners/${p.id}/statement`);
                      if (res.ok) {
                        const json = await res.json();
                        setSelectedPartnerStatement(json.data);
                      }
                    }}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Financial Statement ➔</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: PARTNER APPLICATIONS QUEUE */}
      {/* ========================================================================= */}
      {activeTab === "applications" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white">Partner &amp; Creator Applications</h3>
              <p className="text-xs text-slate-400">
                Incoming public applications from content creators, review centers, and educational page admins.
              </p>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setAppStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    appStatusFilter === st
                      ? "bg-emerald-600 text-white shadow-lg"
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {applicationsLoading ? (
            <div className="py-20 text-center text-xs text-slate-400">Loading applications...</div>
          ) : !applications.length ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <div className="text-3xl">📝</div>
              <h4 className="text-base font-black text-white">No applications found</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Applications submitted via <code>/partner/apply</code> will appear here for instant review and 1-click onboarding.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/10 text-purple-300 border border-purple-500/30">
                        {app.type.replace("_", " ")}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          app.status === "APPROVED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : app.status === "PENDING"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-black text-white">{app.organizationName}</h4>
                      <p className="text-xs text-slate-400">
                        Applicant: <strong className="text-slate-200">{app.applicantName}</strong> ({app.email})
                      </p>
                      {app.phone && (
                        <p className="text-[11px] text-slate-400 font-mono">Phone: {app.phone}</p>
                      )}
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-2 font-mono">
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Social Channel:</span>
                        <a
                          href={app.socialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1 max-w-[180px] truncate"
                        >
                          <span className="truncate">{app.socialUrl}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Audience Size:</span>
                        <span className="font-bold text-white">{app.audienceSize || "Not specified"}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Desired Slug:</span>
                        <span className="font-bold text-emerald-400">
                          {app.proposedSlug ? `/p/${app.proposedSlug}` : "Auto-generated"}
                        </span>
                      </div>
                    </div>

                    {app.pitchReason && (
                      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-300">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                          Promotion Plan / Pitch:
                        </span>
                        <p className="text-slate-400 leading-relaxed italic">&quot;{app.pitchReason}&quot;</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500 font-mono">
                      Applied {new Date(app.createdAt).toLocaleDateString()}
                    </span>

                    {app.status === "PENDING" ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedAppForAction(app);
                            setAppActionType("REJECT");
                            setAppAdminNotes("");
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAppForAction(app);
                            setAppActionType("APPROVE");
                            setAppSlugInput(app.proposedSlug || "");
                            setAppRateInput("10.0");
                            setAppPasswordInput("");
                            setAppAdminNotes("");
                          }}
                          className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-lg shadow-emerald-500/20"
                        >
                          1-Click Approve
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">
                        {app.status === "APPROVED" ? "✓ Partner Active" : "✕ Application Closed"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TAXES & DEDUCTIONS */}
      {/* ========================================================================= */}
      {activeTab === "taxes_deductions" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Tax Configurations */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-white">Configured Tax Policies</h3>
                <p className="text-xs text-slate-400">Accounting provisions and reserve rules.</p>
              </div>
              <button
                onClick={() => setShowCreateTaxModal(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                + Add Tax Rule
              </button>
            </div>

            {!taxConfigs.length ? (
              <div className="py-12 text-center text-xs text-slate-400">No active tax policies configured.</div>
            ) : (
              <div className="space-y-3">
                {taxConfigs.map((tc) => (
                  <div key={tc.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{tc.name}</span>
                      <span className="font-mono font-black text-indigo-400">{tc.rate}%</span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex justify-between">
                      <span>Basis: {tc.calculationBasis}</span>
                      <span>Type: {tc.taxType}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Operational Deductions */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-white">Operational Deductions &amp; Expenses</h3>
                <p className="text-xs text-slate-400">Recorded platform costs, hosting, and marketing.</p>
              </div>
              <button
                onClick={() => setShowCreateDeductionModal(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                + Record Expense
              </button>
            </div>

            {!deductions.length ? (
              <div className="py-12 text-center text-xs text-slate-400">No operational expenses recorded.</div>
            ) : (
              <div className="space-y-3">
                {deductions.map((d) => (
                  <div key={d.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{d.description}</span>
                      <span className="font-mono font-black text-rose-400">{d.formattedAmount}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex justify-between">
                      <span>Category: {d.category}</span>
                      <span>{new Date(d.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: UNIFIED PAYOUTS QUEUE */}
      {/* ========================================================================= */}
      {activeTab === "payouts" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-base font-black text-white">Unified Payout Fulfillment Queue</h3>
            <p className="text-xs text-slate-400">
              Disburse cash to referrers and partners with double-entry ledger settlement recording.
            </p>
          </div>

          {!payouts.length ? (
            <div className="py-20 text-center text-xs text-slate-400">No pending payout requests.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Account Holder</th>
                    <th className="py-3 px-4">Account Number</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(p.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.payoutType === "REFERRAL"
                              ? "bg-sky-500/20 text-sky-300"
                              : "bg-purple-500/20 text-purple-300"
                          }`}
                        >
                          {p.payoutType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{p.recipientName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.recipientEmailMasked}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-sm">
                        {p.formattedAmount}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">{p.method}</td>
                      <td className="py-3.5 px-4 text-slate-200">{p.accountName}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300 font-bold bg-slate-950/50 px-2 py-1 rounded">
                        {p.accountNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            p.status === "PAID"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : p.status === "REQUESTED"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => {
                            setPayoutModalItem(p);
                            setPayoutAction(p.status === "REQUESTED" ? "MARK_PAID" : "APPROVE");
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[11px] cursor-pointer transition shadow"
                        >
                          Fulfill
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: SETTINGS & FEATURE FLAGS */}
      {/* ========================================================================= */}
      {activeTab === "settings" && settings && (
        <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <span>Accounting Feature Flags &amp; Live Controls</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Safeguards ensuring live financial operations remain paused until officially authorized.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            {/* Live Accounting Switch */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-black text-sm text-white">Accounting Live Mode</div>
                <div className="text-xs text-slate-400">
                  Activates production ledger auditing and automated balance reservation.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.accountingLiveMode}
                  onChange={(e) => setSettings({ ...settings, accountingLiveMode: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>

            {/* Partner Program Switch */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-black text-sm text-white">Partner Program Master Switch</div>
                <div className="text-xs text-slate-400">
                  Allows external collaborator commission accruals from verified payments.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.partnerProgramEnabled}
                  onChange={(e) => setSettings({ ...settings, partnerProgramEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>

            {settingsMsg && (
              <div className="p-3.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold">
                {settingsMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-lg disabled:opacity-50"
            >
              {savingSettings ? "Saving Settings..." : "Save Financial Settings"}
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1-CLICK DRILL-DOWN & FORMULA MODAL */}
      {/* ========================================================================= */}
      {showDrilldownModal && drilldownExplanation && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[85vh] flex flex-col space-y-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-black">{drilldownExplanation.itemName}</h3>
                <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                  {drilldownExplanation.formattedAmount}
                </div>
              </div>
              <button
                onClick={() => setShowDrilldownModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Formula & Rule Box */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase">
                <Info className="w-4 h-4" />
                <span>How This Was Calculated (Authoritative Server Formula)</span>
              </div>
              <div className="font-mono bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-slate-200">
                {drilldownExplanation.formula}
              </div>
              <p className="text-slate-400 leading-relaxed">{drilldownExplanation.ruleExplanation}</p>
            </div>

            {/* Underlying Records Table */}
            <div className="flex-1 overflow-y-auto space-y-3">
              <div className="text-xs font-bold uppercase text-slate-400">
                Underlying Transaction Records ({drilldownItems.length})
              </div>

              {drilldownLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading underlying records...</div>
              ) : !drilldownItems.length ? (
                <div className="py-12 text-center text-xs text-slate-400">No records found for this metric.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Reference / ID</th>
                        <th className="py-2.5 px-3">Customer / Recipient</th>
                        <th className="py-2.5 px-3 text-right">Amount (PHP)</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {drilldownItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 text-slate-400">
                            {item.date ? new Date(item.date).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-300 truncate max-w-[140px]">
                            {item.reference || item.id}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-white">
                              {item.customerName || item.inviterName || item.partnerName || item.taxName || "Record"}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {item.customerEmailMasked || item.inviterEmailMasked || item.partnerCode || ""}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                            {item.formattedAmount}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowDrilldownModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Drilldown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PARTNER STATEMENT MODAL */}
      {/* ========================================================================= */}
      {selectedPartnerStatement && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[85vh] flex flex-col space-y-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-black">{selectedPartnerStatement.partner?.name}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Partner ID: <strong className="text-emerald-400">{selectedPartnerStatement.partner?.partnerId || selectedPartnerStatement.partner?.code}</strong> &bull; {selectedPartnerStatement.statementReference}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/admin/accounting/partners/${selectedPartnerStatement.partner?.id}/statement?format=xlsx`}
                  download
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>XLSX</span>
                </a>
                <a
                  href={`/api/admin/accounting/partners/${selectedPartnerStatement.partner?.id}/statement?format=csv`}
                  download
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 border border-slate-700 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </a>
                <button
                  onClick={() => setSelectedPartnerStatement(null)}
                  className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Statement Stats */}
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div className="text-[10px] font-bold uppercase text-slate-400">Qualifying Revenue</div>
                <div className="text-base font-black text-white font-mono mt-1">
                  {selectedPartnerStatement.summary?.formattedQualifyingPayments || selectedPartnerStatement.statement?.formattedRevenue || "₱0.00"}
                </div>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div className="text-[10px] font-bold uppercase text-slate-400">Gross Commission</div>
                <div className="text-base font-black text-purple-400 font-mono mt-1">
                  {selectedPartnerStatement.summary?.formattedGrossCommission || selectedPartnerStatement.statement?.formattedCommissions || "₱0.00"}
                </div>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div className="text-[10px] font-bold uppercase text-slate-400">Paid Out</div>
                <div className="text-base font-black text-teal-400 font-mono mt-1">
                  {selectedPartnerStatement.summary?.formattedPaid || "₱0.00"}
                </div>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div className="text-[10px] font-bold uppercase text-slate-400">Outstanding Available</div>
                <div className="text-base font-black text-emerald-400 font-mono mt-1">
                  {selectedPartnerStatement.summary?.formattedOutstanding || selectedPartnerStatement.statement?.formattedOutstanding || "₱0.00"}
                </div>
              </div>
            </div>

            {/* Commission Transactions Table */}
            <div className="flex-1 overflow-y-auto space-y-3">
              <div className="text-xs font-bold uppercase text-slate-400">
                Transactions Ledger ({selectedPartnerStatement.transactions?.length || selectedPartnerStatement.commissions?.length || 0})
              </div>

              {!(selectedPartnerStatement.transactions?.length || selectedPartnerStatement.commissions?.length) ? (
                <div className="py-10 text-center text-xs text-slate-400">No transactions recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/40">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Plan</th>
                        <th className="py-2.5 px-3 text-right">Payment</th>
                        <th className="py-2.5 px-3">Rate</th>
                        <th className="py-2.5 px-3 text-right">Commission</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {(selectedPartnerStatement.transactions || selectedPartnerStatement.commissions || []).map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{new Date(c.date).toLocaleDateString()}</td>
                          <td className="py-2.5 px-3 font-medium text-white">{c.customerMasked || c.customerName || "Student"}</td>
                          <td className="py-2.5 px-3 text-slate-300">{c.planType || "PREMIUM"}</td>
                          <td className="py-2.5 px-3 font-mono text-right">{c.formattedPurchase || formatCentavosToPesos(c.purchaseAmountCentavos)}</td>
                          <td className="py-2.5 px-3 font-mono text-purple-400">{c.effectiveRate}%</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-400 text-right">
                            {c.formattedCommission || formatCentavosToPesos(c.commissionAmountCentavos)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedPartnerStatement(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE PARTNER MODAL */}
      {/* ========================================================================= */}
      {showCreatePartnerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black">Register New Partner / Collaborator</h3>
                <p className="text-xs text-slate-400">
                  Assign custom tracking links, portal credentials, and commission rates.
                </p>
              </div>
              <button
                onClick={() => setShowCreatePartnerModal(false)}
                className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const payload = {
                  name: formData.get("name"),
                  code: formData.get("code") || undefined,
                  slug: formData.get("slug") || undefined,
                  password: formData.get("password") || undefined,
                  tagline: formData.get("tagline") || undefined,
                  badgeText: formData.get("badgeText") || undefined,
                  type: formData.get("type"),
                  contactName: formData.get("contactName") || undefined,
                  contactEmail: formData.get("contactEmail") || undefined,
                  commissionRate: parseFloat(formData.get("commissionRate") as string) || 10.0,
                  holdingPeriodDays: parseInt(formData.get("holdingPeriodDays") as string, 10) || 7,
                  minPayoutCentavos: (parseFloat(formData.get("minPayoutPesos") as string) || 150) * 100,
                  notes: formData.get("notes") || undefined,
                };

                const res = await fetch("/api/admin/accounting/partners", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (res.ok && json.success) {
                  alert(json.message);
                  setShowCreatePartnerModal(false);
                  await fetchPartners();
                } else {
                  alert(json.error || "Failed to create partner");
                }
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">Partner / Page Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. CSE Reviewers PH"
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">Partner Type</label>
                  <select
                    name="type"
                    defaultValue="FACEBOOK_PAGE"
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none"
                  >
                    <option value="FACEBOOK_PAGE">Facebook Page / Community</option>
                    <option value="CONTENT_CREATOR">Content Creator / Influencer</option>
                    <option value="HOST">Host / Event Collaborator</option>
                    <option value="SCHOOL">School / University Partner</option>
                    <option value="AFFILIATE">Individual Affiliate</option>
                    <option value="OTHER">Other Organization</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">
                    Custom Slug (Creates /p/your-slug)
                  </label>
                  <input
                    type="text"
                    name="slug"
                    placeholder="e.g. cse-review-ph"
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl font-mono text-emerald-300 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">
                    Initial Portal Password
                  </label>
                  <input
                    type="text"
                    name="password"
                    placeholder="Leave blank to auto-generate activation link"
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">Commission Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    name="commissionRate"
                    defaultValue="10.0"
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">Min. Payout (PHP)</label>
                  <input
                    type="number"
                    name="minPayoutPesos"
                    defaultValue="150"
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">Contact Email</label>
                  <input
                    type="email"
                    name="contactEmail"
                    placeholder="partner@gmail.com"
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-400 mb-1">Badge Text</label>
                  <input
                    type="text"
                    name="badgeText"
                    defaultValue="Official Partner"
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">Tagline on Landing Page</label>
                <input
                  type="text"
                  name="tagline"
                  placeholder="e.g. Official Civil Service Review Partner for 2026 Aspirants"
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreatePartnerModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-wider rounded-xl shadow-lg cursor-pointer transition"
                >
                  Create Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAYOUT PROCESSING MODAL */}
      {/* ========================================================================= */}
      {payoutModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black">Fulfill Cash Payout</h3>
                <p className="text-xs text-slate-400">
                  Amount: <strong className="text-emerald-400 font-mono">{payoutModalItem.formattedAmount}</strong>
                </p>
              </div>
              <button
                onClick={() => setPayoutModalItem(null)}
                className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessPayoutSubmit} className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Recipient:</span>
                  <span className="font-bold text-white">{payoutModalItem.recipientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Method:</span>
                  <span className="font-bold text-white">{payoutModalItem.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Account / Mobile Number:</span>
                  <span className="font-mono font-bold text-emerald-400">{payoutModalItem.accountNumber}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Action</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["APPROVE", "MARK_PAID", "REJECT"] as const).map((act) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => setPayoutAction(act)}
                      className={`p-2.5 rounded-xl border text-xs font-black transition cursor-pointer text-center ${
                        payoutAction === act
                          ? "bg-blue-600 border-blue-500 text-white shadow-lg"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      {act.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {payoutAction === "MARK_PAID" && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                    GCash / Bank Reference Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GCASH-REF-98129841"
                    value={payoutTxnRef}
                    onChange={(e) => setPayoutTxnRef(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Admin Notes / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Optional remarks..."
                  value={payoutAdminNote}
                  onChange={(e) => setPayoutAdminNote(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayoutModalItem(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingPayout}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {processingPayout ? "Processing..." : "Confirm & Post to Ledger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PARTNER APPLICATION ACTION MODAL (APPROVE / REJECT) */}
      {/* ========================================================================= */}
      {selectedAppForAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black">
                  {appActionType === "APPROVE" ? "1-Click Approve Partner" : "Reject Application"}
                </h3>
                <p className="text-xs text-slate-400">
                  Applicant: <strong className="text-white">{selectedAppForAction.organizationName}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedAppForAction(null)}
                className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessApplicationAction} className="space-y-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Applicant:</span>
                  <span className="text-white font-bold">{selectedAppForAction.applicantName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-white">{selectedAppForAction.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Audience:</span>
                  <span className="text-emerald-400 font-bold">{selectedAppForAction.audienceSize || "N/A"}</span>
                </div>
              </div>

              {appActionType === "APPROVE" ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold uppercase text-slate-400 mb-1">
                        Commission Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={appRateInput}
                        onChange={(e) => setAppRateInput(e.target.value)}
                        className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-slate-400 mb-1">
                        Custom URL Slug
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. prof-juan"
                        value={appSlugInput}
                        onChange={(e) => setAppSlugInput(e.target.value)}
                        className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl font-mono text-emerald-300 outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-slate-400 mb-1">
                      Initial Portal Password
                    </label>
                    <input
                      type="text"
                      required
                      value={appPasswordInput}
                      onChange={(e) => setAppPasswordInput(e.target.value)}
                      className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Provide this password to the creator so they can log in at <code>/partner/login</code>.
                    </p>
                  </div>
                </>
              ) : (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                  Are you sure you want to reject this application? You can provide rejection notes below.
                </div>
              )}

              <div>
                <label className="block font-bold uppercase text-slate-400 mb-1">
                  Internal Admin Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional review notes..."
                  value={appAdminNotes}
                  onChange={(e) => setAppAdminNotes(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedAppForAction(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingAppAction}
                  className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-wider transition cursor-pointer shadow-lg disabled:opacity-50 ${
                    appActionType === "APPROVE"
                      ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                      : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20"
                  }`}
                >
                  {processingAppAction
                    ? "Processing..."
                    : appActionType === "APPROVE"
                    ? "Confirm & Create Partner Account"
                    : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
