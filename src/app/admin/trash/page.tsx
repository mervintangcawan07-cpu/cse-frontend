"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrashItem } from "@/types/recovery";

export default function AdminTrashBinPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  // Modals
  const [showPurgeSelectedModal, setShowPurgeSelectedModal] = useState(false);
  const [showPurgeAllModal, setShowPurgeAllModal] = useState(false);
  const [purgeAllInput, setPurgeAllInput] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/trash")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.items) {
          setItems(data.items);
        } else if (data.trashItems) {
          setItems(data.trashItems);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to fetch trash items:", err);
        setActionMessage({
          type: "error",
          text: "✕ Failed to fetch trash items from server.",
        });
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleRefresh = async () => {
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
      setActionMessage({ type: "error", text: "✕ Failed to fetch trash items from server." });
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter === "ALL") return true;
    if (filter === "QUESTION") return item.entityType === "question";
    if (filter === "USER") return item.entityType === "user";
    if (filter === "FLASHCARD") return item.entityType === "flashcard";
    if (filter === "SYSTEMSETTING") return item.entityType === "systemSetting";
    return true;
  });

  const questionCount = items.filter((i) => i.entityType === "question").length;

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.has(item.id));

  const handleToggleSelectAllPage = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const item of filteredItems) {
          next.delete(item.id);
        }
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const item of filteredItems) {
          next.add(item.id);
        }
        return next;
      });
    }
  };

  const getSelectedItems = () => {
    return items
      .filter((i) => selectedIds.has(i.id))
      .map((i) => ({ entityType: i.entityType, entityId: i.id }));
  };

  // Single item restore
  const handleRestoreSingle = async (item: TrashItem) => {
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
        setActionMessage({
          type: "success",
          text: `✓ Successfully restored "${item.displayName}"`,
        });
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      } else {
        setActionMessage({
          type: "error",
          text: `✕ Restore failed: ${data.error || "Unknown error"}`,
        });
      }
    } catch {
      setActionMessage({ type: "error", text: "✕ Restore failed due to a network error." });
    } finally {
      setRestoringId(null);
    }
  };

  // Restore selected
  const handleRestoreSelected = async () => {
    const selected = getSelectedItems();
    if (selected.length === 0) return;

    setProcessingAction("RESTORE_SELECTED");
    setActionMessage(null);

    try {
      const res = await fetch("/api/admin/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESTORE_SELECTED",
          items: selected,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const restoredIds = new Set<string>(
          (data.details || [])
            .filter((d: { status: string }) => d.status === "PROCESSED")
            .map((d: { id: string }) => d.id)
        );
        setItems((prev) => prev.filter((i) => !restoredIds.has(i.id)));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of restoredIds) next.delete(id);
          return next;
        });
        setActionMessage({
          type: "success",
          text: `✓ Successfully restored ${data.processedCount} item(s) (Skipped: ${data.skippedCount}, Failed: ${data.failedCount}).`,
        });
      } else {
        setActionMessage({
          type: "error",
          text: `✕ Restore failed: ${data.error || "Unknown error"}`,
        });
      }
    } catch {
      setActionMessage({ type: "error", text: "✕ Failed to restore selected items due to network error." });
    } finally {
      setProcessingAction(null);
    }
  };

  // Permanently delete selected
  const handlePurgeSelectedConfirm = async () => {
    const selected = getSelectedItems();
    if (selected.length === 0) return;

    setProcessingAction("PURGE_SELECTED");
    setActionMessage(null);

    try {
      const res = await fetch("/api/admin/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PURGE_SELECTED",
          items: selected,
        }),
      });
      const data = await res.json();
      setShowPurgeSelectedModal(false);

      if (res.ok && data.success) {
        const purgedIds = new Set<string>(
          (data.details || [])
            .filter((d: { status: string }) => d.status === "PROCESSED")
            .map((d: { id: string }) => d.id)
        );
        setItems((prev) => prev.filter((i) => !purgedIds.has(i.id)));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of purgedIds) next.delete(id);
          return next;
        });
        setActionMessage({
          type: "success",
          text: `✓ Successfully purged ${data.processedCount} item(s) (Skipped: ${data.skippedCount}, Failed: ${data.failedCount}).`,
        });
      } else {
        setActionMessage({
          type: "error",
          text: `✕ Purge failed: ${data.error || "Unknown error"}`,
        });
      }
    } catch {
      setActionMessage({ type: "error", text: "✕ Failed to purge selected items due to network error." });
    } finally {
      setProcessingAction(null);
    }
  };

  // Restore all questions
  const handleRestoreAllQuestions = async () => {
    if (!confirm("Are you sure you want to restore all Question Bank records currently in Trash back to active status?")) {
      return;
    }

    setProcessingAction("RESTORE_ALL_QUESTIONS");
    setActionMessage(null);

    try {
      const res = await fetch("/api/admin/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESTORE_ALL_QUESTIONS" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setItems((prev) => prev.filter((i) => i.entityType !== "question"));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const item of items) {
            if (item.entityType === "question") next.delete(item.id);
          }
          return next;
        });
        setActionMessage({
          type: "success",
          text: `✓ Successfully restored all ${data.restoredCount} Question(s) back to active Question Bank.`,
        });
      } else {
        setActionMessage({
          type: "error",
          text: `✕ Restore failed: ${data.error || "Unknown error"}`,
        });
      }
    } catch {
      setActionMessage({ type: "error", text: "✕ Failed to restore questions due to network error." });
    } finally {
      setProcessingAction(null);
    }
  };

  // Purge all questions
  const handlePurgeAllQuestionsConfirm = async () => {
    if (purgeAllInput.trim() !== "PURGE ALL") return;

    setProcessingAction("PURGE_ALL_QUESTIONS");
    setActionMessage(null);

    try {
      const res = await fetch("/api/admin/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PURGE_ALL_QUESTIONS",
          confirmation: "PURGE ALL",
        }),
      });
      const data = await res.json();
      setShowPurgeAllModal(false);
      setPurgeAllInput("");

      if (res.ok && data.success) {
        setItems((prev) => prev.filter((i) => i.entityType !== "question"));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const item of items) {
            if (item.entityType === "question") next.delete(item.id);
          }
          return next;
        });
        setActionMessage({
          type: "success",
          text: `✓ Permanently purged ${data.purgedCount} Question(s) from the database.`,
        });
      } else {
        setActionMessage({
          type: "error",
          text: `✕ Purge failed: ${data.error || "Unknown error"}`,
        });
      }
    } catch {
      setActionMessage({ type: "error", text: "✕ Failed to execute Purge All due to network error." });
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full border border-red-500/30">
              System Recovery & Security
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold mt-2">Admin Trash Bin</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Soft-deleted items reside here for 30 days before permanent purging.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/questions"
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition"
          >
            ← Question Bank
          </Link>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "🔄 Refresh"}
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-bold border transition ${
            actionMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
              : actionMessage.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { label: "All Items", value: "ALL" },
          { label: "Questions & Drills", value: "QUESTION" },
          { label: "Users", value: "USER" },
          { label: "Flashcards", value: "FLASHCARD" },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              filter === tab.value
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {tab.label} (
            {
              items.filter(
                (i) => tab.value === "ALL" || i.entityType === tab.value.toLowerCase()
              ).length
            }
            )
          </button>
        ))}
      </div>

      {/* Action Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={handleToggleSelectAllPage}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Select All on Page</span>
          </label>
          <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            {selectedIds.size} of {items.length} selected
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Restore Selected */}
          <button
            type="button"
            onClick={handleRestoreSelected}
            disabled={selectedIds.size === 0 || processingAction !== null}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {processingAction === "RESTORE_SELECTED"
              ? "Restoring..."
              : `Restore Selected (${selectedIds.size})`}
          </button>

          {/* Permanently Delete Selected */}
          <button
            type="button"
            onClick={() => setShowPurgeSelectedModal(true)}
            disabled={selectedIds.size === 0 || processingAction !== null}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {processingAction === "PURGE_SELECTED"
              ? "Purging..."
              : `Delete Selected (${selectedIds.size})`}
          </button>

          {/* Restore All Questions */}
          {questionCount > 0 && (
            <button
              type="button"
              onClick={handleRestoreAllQuestions}
              disabled={processingAction !== null}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
            >
              Restore All Questions ({questionCount})
            </button>
          )}

          {/* Dedicated Purge All Questions */}
          {questionCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setPurgeAllInput("");
                setShowPurgeAllModal(true);
              }}
              disabled={processingAction !== null}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-black rounded-xl transition shadow-sm border border-red-800 disabled:opacity-40 cursor-pointer"
            >
              Purge All Questions
            </button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-slate-500 animate-pulse">
          Loading soft-deleted records from database...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <span className="text-3xl">🗑️</span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Trash Bin is Empty</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No soft-deleted records currently reside in this recovery window.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredItems.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`p-4 sm:p-5 rounded-2xl border transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                  isSelected
                    ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-start gap-3 max-w-2xl">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelect(item.id)}
                    className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-md border border-amber-500/30">
                        {item.entityType}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        Deleted {new Date(item.deletedAt).toLocaleDateString()} by {item.deletedBy}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        • {item.daysRemaining} days remaining
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                      {item.displayName}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRestoreSingle(item)}
                  disabled={restoringId === item.id || processingAction !== null}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md disabled:opacity-50 cursor-pointer shrink-0 self-end sm:self-center"
                >
                  {restoringId === item.id ? "Restoring..." : "Restore Item"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: PURGE SELECTED CONFIRMATION */}
      {showPurgeSelectedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-800 inline-block">
                Permanent Deletion Warning
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Permanently Delete {selectedIds.size} Selected Item(s)?
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                This operation will physically purge the selected soft-deleted records from the database.
                <strong className="text-rose-600 dark:text-rose-400 block mt-1">This action cannot be undone.</strong>
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowPurgeSelectedModal(false)}
                disabled={processingAction !== null}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurgeSelectedConfirm}
                disabled={processingAction !== null}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl transition shadow-md cursor-pointer disabled:opacity-50"
              >
                {processingAction === "PURGE_SELECTED" ? "Purging..." : "Yes, Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PURGE ALL CONFIRMATION */}
      {showPurgeAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-rose-300 dark:border-rose-900 shadow-2xl space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2.5 py-1 rounded-full border border-red-200 dark:border-red-800 inline-block">
                Critical Administrative Action
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Permanently Purge All Question Trash?
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                This will permanently delete all <strong className="text-slate-900 dark:text-white">{questionCount}</strong> Question Bank records currently residing in the Trash Bin.
                <strong className="text-rose-600 dark:text-rose-400 block mt-1">
                  This action is irreversible and cannot be recovered.
                </strong>
              </p>
            </div>

            <div className="space-y-2 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Type <span className="font-mono text-rose-600 dark:text-rose-400 font-black">PURGE ALL</span> to confirm:
              </label>
              <input
                type="text"
                value={purgeAllInput}
                onChange={(e) => setPurgeAllInput(e.target.value)}
                placeholder="PURGE ALL"
                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500 transition"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowPurgeAllModal(false);
                  setPurgeAllInput("");
                }}
                disabled={processingAction !== null}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurgeAllQuestionsConfirm}
                disabled={purgeAllInput.trim() !== "PURGE ALL" || processingAction !== null}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl transition shadow-md cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {processingAction === "PURGE_ALL_QUESTIONS"
                  ? "Purging All..."
                  : "Purge All Questions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}