"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isEnabled: boolean;
}

interface SupportTicket {
  id: string;
  userEmail: string;
  subject: string;
  message: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  adminNotes?: string | null;
  createdAt: string;
}

interface PaginationMetadata {
  page: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

const PAGE_SIZE = 25;
const INITIAL_PAGINATION: PaginationMetadata = {
  page: 1,
  pageSize: PAGE_SIZE,
  hasPreviousPage: false,
  hasNextPage: false,
};

export default function AdminSystemControlPage() {
  const [activeTab, setActiveTab] = useState<"FLAGS" | "TICKETS">("FLAGS");
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [ticketPagination, setTicketPagination] = useState(INITIAL_PAGINATION);

  // Default system feature flags to populate if empty
  const defaultFlags = [
    { key: "DUELS_MODULE", name: "1v1 Rapid Duels Arena", description: "Allow examinees to compete in real-time quiz battles." },
    { key: "AI_TUTOR", name: "AI Explanation Assistant", description: "Enable AI-powered answer breakdowns on exam results." },
    { key: "FLASHCARDS_MODULE", name: "Spaced Repetition Flashcards", description: "Grant student access to subject flashcard decks." },
    { key: "MAINTENANCE_BANNER", name: "System Maintenance Warning Banner", description: "Display scheduled maintenance alert on student dashboards." },
  ];

  const loadData = async (page = 1) => {
    setLoading(true);
    try {
      if (activeTab === "FLAGS") {
        const res = await fetch("/api/admin/feature-flags");
        const data = await res.json();
        if (res.ok && data.flags) {
          setFlags(data.flags);
        }
      } else {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        const res = await fetch(`/api/admin/support-tickets?${params.toString()}`);
        const data = await res.json();
        if (res.ok && data.tickets) {
          setTickets(data.tickets);
          setTicketPagination(data.pagination ?? INITIAL_PAGINATION);
        }
      }
    } catch (err) {
      console.error("Failed to fetch system data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleToggleFlag = async (flagItem: { key: string; name: string; description?: string; isEnabled: boolean }) => {
    setUpdatingKey(flagItem.key);
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: flagItem.key,
          name: flagItem.name,
          description: flagItem.description,
          isEnabled: !flagItem.isEnabled,
        }),
      });

      if (res.ok) {
        loadData();
      } else {
        alert("Failed to update feature flag.");
      }
    } catch (err) {
      console.error("Feature flag toggle error:", err);
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleUpdateTicket = async (ticketId: string, status: string, adminNotes: string) => {
    try {
      const res = await fetch("/api/admin/support-tickets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticketId, status, adminNotes }),
      });

      if (res.ok) {
        alert("Support ticket updated successfully.");
        loadData(ticketPagination.page);
      } else {
        alert("Failed to update ticket.");
      }
    } catch (err) {
      console.error("Update ticket error:", err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin/dashboard" className="text-xs font-bold text-amber-400 hover:underline">
              &larr; Admin Command Center
            </Link>
          </div>
          <h1 className="text-2xl font-black mt-1">Feature Flags & Support Tickets</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Toggle platform features live without redeploying and resolve examinee support inquiries.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex gap-2">
        <button
          onClick={() => setActiveTab("FLAGS")}
          className={`px-5 py-2.5 rounded-xl font-black text-xs transition cursor-pointer ${
            activeTab === "FLAGS"
              ? "bg-slate-900 text-white shadow-md"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          🚩 Dynamic Feature Flags
        </button>
        <button
          onClick={() => setActiveTab("TICKETS")}
          className={`px-5 py-2.5 rounded-xl font-black text-xs transition cursor-pointer ${
            activeTab === "TICKETS"
              ? "bg-slate-900 text-white shadow-md"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          🎫 Examinee Support Tickets ({tickets.length})
        </button>
      </div>

      {/* Main Tab Body */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-bold animate-pulse text-xs bg-white rounded-3xl border border-slate-200">
          Loading system settings...
        </div>
      ) : activeTab === "FLAGS" ? (
        /* Feature Flags Management */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {defaultFlags.map((def) => {
            const existing = flags.find((f) => f.key === def.key);
            const isEnabled = existing ? existing.isEnabled : true;

            return (
              <div
                key={def.key}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-start gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        isEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isEnabled ? "ACTIVE" : "DISABLED"}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">{def.key}</span>
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900">{def.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{def.description}</p>
                </div>

                <button
                  onClick={() =>
                    handleToggleFlag({
                      key: def.key,
                      name: def.name,
                      description: def.description,
                      isEnabled,
                    })
                  }
                  disabled={updatingKey === def.key}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                    isEnabled
                      ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {updatingKey === def.key
                    ? "Updating..."
                    : isEnabled
                    ? "Disable Feature"
                    : "Enable Feature"}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* Support Tickets Management */
        <div className="space-y-4">
          {tickets.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium bg-white rounded-3xl border border-slate-200 text-xs">
              No support tickets submitted yet.
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4"
              >
                <div className="flex justify-between items-start gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(t.createdAt).toLocaleString()}
                    </span>
                    <h3 className="text-sm font-black text-slate-900">{t.subject}</h3>
                    <p className="text-xs text-slate-500 font-medium">From: {t.userEmail}</p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      t.status === "RESOLVED"
                        ? "bg-emerald-100 text-emerald-800"
                        : t.status === "IN_PROGRESS"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>

                <p className="text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium leading-relaxed">
                  {t.message}
                </p>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase text-[10px]">Set Status:</span>
                    <select
                      defaultValue={t.status}
                      id={`status-${t.id}`}
                      className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      const selectEl = document.getElementById(`status-${t.id}`) as HTMLSelectElement;
                      handleUpdateTicket(t.id, selectEl.value, t.adminNotes || "Handled by Admin.");
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer"
                  >
                    Update Ticket Status
                  </button>
                </div>
              </div>
            ))
          )}
          {!loading && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs">
              <span className="font-semibold text-slate-500">
                Page {ticketPagination.page} · Up to {ticketPagination.pageSize} tickets
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => loadData(ticketPagination.page - 1)}
                  disabled={!ticketPagination.hasPreviousPage || loading}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => loadData(ticketPagination.page + 1)}
                  disabled={!ticketPagination.hasNextPage || loading}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
