"use client";

import { useState, useEffect, useCallback } from "react";

interface Announcement {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

export default function AdminBroadcastModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Management States
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch active announcements
  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoadingList(true);
      const res = await fetch("/api/admin/notifications");
      const data = await res.json();
      if (res.ok && data.notifications) {
        setAnnouncements(data.notifications);
      }
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAnnouncements();
    }
  }, [isOpen, fetchAnnouncements]);

  // Create Broadcast (Title + Message only)
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim() || submitting) return;

    setSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, type: "SYSTEM" }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatus("✓ Announcement broadcasted successfully!");
        setTitle("");
        setMessage("");
        fetchAnnouncements(); // Refresh list immediately
      } else {
        setStatus(`✕ ${data.error || "Failed to send announcement"}`);
      }
    } catch (err) {
      setStatus("✕ Error sending announcement");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Announcement
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this broadcast announcement? It will be removed for all users.")) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/notifications?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setAnnouncements((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert("Failed to delete announcement.");
      }
    } catch (err) {
      console.error("Error deleting announcement:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow-md flex items-center gap-2"
      >
        <span>📢</span> Broadcast Announcement
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Broadcast Announcement</h3>
                <p className="text-[11px] text-slate-400">Post or delete platform-wide alerts for examinees.</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {/* Broadcast Form (Category Removed) */}
            <form onSubmit={handleBroadcast} className="space-y-4">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase mb-1">
                  Announcement Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Civil Service Exam Schedule Update"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase mb-1">
                  Message Body
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter details for all students..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {status && <p className="text-xs font-bold text-center text-blue-600">{status}</p>}

              <div className="flex justify-end gap-2 pt-1 border-b border-slate-100 pb-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-50"
                >
                  {submitting ? "Sending..." : "Dispatch Alert"}
                </button>
              </div>
            </form>

            {/* Active Broadcasts List with Delete Functionality */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Active Announcements
              </h4>

              {loadingList ? (
                <p className="text-xs text-slate-400 font-medium animate-pulse">Loading list...</p>
              ) : announcements.length === 0 ? (
                <p className="text-xs text-slate-400">No active announcements.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {announcements.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-900">{item.title}</p>
                        <p className="text-slate-600 text-[11px] leading-snug">{item.message}</p>
                        <span className="text-[9px] text-slate-400 block pt-0.5">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] rounded-lg border border-rose-200 shrink-0 transition"
                      >
                        {deletingId === item.id ? "..." : "Delete 🗑️"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}