"use client";

import { useEffect, useState } from "react";
import { TrashItem } from "@/types/recovery";

export default function AdminTrashBinPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrashItems();
  }, []);

  const fetchTrashItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/trash");
      const data = await res.json();
      if (res.ok && data.items) {
        setItems(data.items);
      } else if (res.ok && data.trashItems) {
        setItems(data.trashItems);
      }
    } catch (err) {
      console.error("Failed to fetch trash items:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (item: TrashItem) => {
    setRestoringId(item.id);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESTORE",
          entityType: item.entityType,
          entityId: item.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMessage(`✓ Successfully restored "${item.displayName}"`);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        setActionMessage(`✕ Restore failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      setActionMessage("✕ Restore failed due to a network error.");
    } finally {
      setRestoringId(null);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter === "ALL") return true;
    if (filter === "QUESTION") return item.entityType === "question";
    if (filter === "USER") return item.entityType === "user";
    if (filter === "FLASHCARD") return item.entityType === "flashcard";
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl border border-slate-800 shadow-md flex justify-between items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
            System Recovery & Security
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold mt-2">Admin Trash Bin</h1>
          <p className="text-xs text-slate-400 mt-1">
            Soft-deleted items reside here for 30 days before permanent purging.
          </p>
        </div>
        <button
          onClick={fetchTrashItems}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
        >
          🔄 Refresh
        </button>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl text-xs font-bold bg-slate-900 text-amber-400 border border-slate-800">
          {actionMessage}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-3">
        {[
          { label: "All Items", value: "ALL" },
          { label: "Questions & Drills", value: "QUESTION" },
          { label: "Users", value: "USER" },
          { label: "Flashcards", value: "FLASHCARD" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              filter === tab.value
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            {tab.label} ({items.filter(i => tab.value === "ALL" || i.entityType === tab.value.toLowerCase()).length})
          </button>
        ))}
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-slate-500 animate-pulse">
          Loading soft-deleted records from database...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <span className="text-3xl">🗑️</span>
          <h2 className="text-lg font-bold text-white">Trash Bin is Empty</h2>
          <p className="text-xs text-slate-400">
            No soft-deleted records currently reside in this recovery window.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex justify-between items-center"
            >
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-md border border-amber-500/30">
                    {item.entityType}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Deleted {new Date(item.deletedAt).toLocaleDateString()} by {item.deletedBy}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white line-clamp-2">
                  {item.displayName}
                </h3>
              </div>

              <button
                onClick={() => handleRestore(item)}
                disabled={restoringId === item.id}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md disabled:opacity-50"
              >
                {restoringId === item.id ? "Restoring..." : "Restore Item"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}