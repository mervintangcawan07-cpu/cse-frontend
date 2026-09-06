"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  adminNotes?: string | null;
  createdAt: string;
}

export default function StudentSupportPage() {
  const [activeTab, setActiveTab] = useState<"NEW" | "MY_TICKETS">("MY_TICKETS");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/support");
      const data = await res.json();
      if (res.ok && data.tickets) {
        setTickets(data.tickets);
      }
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("Support ticket submitted successfully!");
        setSubject("");
        setMessage("");
        setActiveTab("MY_TICKETS");
        fetchTickets();
      } else {
        alert(data.error || "Failed to submit ticket.");
      }
    } catch (err) {
      console.error("Error submitting support ticket:", err);
      alert("An error occurred while submitting your ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full px-0 py-2 sm:px-3 sm:py-4 lg:px-6">
      <div className="bg-white rounded-none border-x-0 sm:rounded-2xl sm:border lg:rounded-3xl border-slate-200/90 shadow-md overflow-hidden">
        {/* Header Banner - Seamlessly integrated */}
        <div className="bg-slate-900 text-white p-4 sm:p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <Link href="/dashboard" className="text-xs font-bold text-amber-400 hover:underline">
              &larr; Back to Student Dashboard
            </Link>
            <h1 className="text-2xl md:text-3xl font-black mt-2">Help & Examinee Support</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Have questions about your reviewer account, payments, or exam features? File a ticket below.
            </p>
          </div>

          <div className="flex gap-2 bg-slate-800 p-1 rounded-2xl border border-slate-700">
            <button
              onClick={() => setActiveTab("MY_TICKETS")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "MY_TICKETS" ? "bg-blue-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              My Tickets ({tickets.length})
            </button>
            <button
              onClick={() => setActiveTab("NEW")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "NEW" ? "bg-blue-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              + Submit Ticket
            </button>
          </div>
        </div>

        {/* Unified Content Body */}
        <div className="p-3.5 sm:p-6 md:p-8 bg-slate-50/60">
          {activeTab === "NEW" ? (
            <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-xs max-w-2xl mx-auto">
              <h2 className="text-lg font-black text-slate-900 mb-1">Create a Support Ticket</h2>
              <p className="text-xs text-slate-500 mb-6 font-medium">
                Our support team will review your inquiry and respond directly in your portal.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Subject / Issue Summary
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. VIP access inquiry, payment verification, question typo report"
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Detailed Message
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide as much detail as possible to help us resolve your issue promptly..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition resize-none"
                  ></textarea>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab("MY_TICKETS")}
                    className="px-5 py-3 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
                  >
                    {submitting ? "Submitting Ticket..." : "Submit Ticket 🚀"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              {loading ? (
                <div className="py-20 text-center text-slate-400 font-bold text-sm animate-pulse">
                  Loading your support tickets...
                </div>
              ) : tickets.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl sm:rounded-3xl border border-slate-200 space-y-3">
                  <p className="text-slate-400 font-medium text-xs">You have not submitted any support tickets yet.</p>
                  <button
                    onClick={() => setActiveTab("NEW")}
                    className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition cursor-pointer"
                  >
                    Create First Ticket
                  </button>
                </div>
              ) : (
                tickets.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs space-y-4"
                  >
                    <div className="flex justify-between items-start gap-4 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] font-mono text-slate-400">
                          Submitted on {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <h3 className="text-sm font-black text-slate-900 mt-0.5">{t.subject}</h3>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          t.status === "RESOLVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : t.status === "IN_PROGRESS"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {t.status === "RESOLVED" ? "✅ Resolved" : t.status === "IN_PROGRESS" ? "⏳ In Progress" : "📩 Pending Review"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase text-[10px]">Your Message:</p>
                      <p className="text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium leading-relaxed">
                        {t.message}
                      </p>
                    </div>

                    {t.adminNotes && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <p className="text-xs font-bold text-amber-600 uppercase text-[10px] flex items-center gap-1">
                          <span>💡 Support Team Response:</span>
                        </p>
                        <p className="text-xs text-slate-800 bg-amber-50/60 p-4 rounded-2xl border border-amber-200/60 font-semibold leading-relaxed">
                          {t.adminNotes}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
