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
    <div className="w-full max-w-6xl mx-auto px-2 py-3.5 sm:px-4 sm:py-6 md:px-6 space-y-4 sm:space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Link href="/dashboard" className="text-xs font-bold text-amber-400 hover:underline">
            &larr; Back to Student Dashboard
          </Link>
          <h1 className="text-2xl md:text-3xl font-black mt-2">Help & Examinee Support</h1>
          <p className="text-xs text-slate-400 mt-1">
            Have questions about your subscription, exams, or study notes? Submit a ticket to our support team.
          </p>
        </div>

        <button
          onClick={() => setActiveTab(activeTab === "NEW" ? "MY_TICKETS" : "NEW")}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition shrink-0 cursor-pointer"
        >
          {activeTab === "NEW" ? "📋 View My Tickets" : "💬 Submit New Ticket"}
        </button>
      </div>

      {/* Main Container */}
      {activeTab === "NEW" ? (
        /* Create New Ticket Form */
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-slate-900">Create a Support Ticket</h2>
            <p className="text-xs text-slate-500">Provide details about your issue or question.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Subject / Issue Title
              </label>
              <input
                type="text"
                placeholder="e.g., Payment issue, Quiz question typo, Account access"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-amber-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Detailed Message
              </label>
              <textarea
                placeholder="Describe your question or technical problem in detail..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-amber-500 transition"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("MY_TICKETS")}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Submitting..." : "Submit Ticket"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* My Tickets List */
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-lg font-black text-slate-900">Your Support Inquiries</h2>
            <span className="text-xs text-slate-400 font-bold">{tickets.length} Total Tickets</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 font-bold animate-pulse text-xs bg-white rounded-3xl border border-slate-200">
              Loading your support tickets...
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
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
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4"
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
  );
}