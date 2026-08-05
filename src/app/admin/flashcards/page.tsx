"use client";

import { useEffect, useState, useCallback } from "react";
import FlashcardBulkUploader from "@/components/admin/FlashcardBulkUploader";
import SingleFlashcardForm from "@/components/admin/SingleFlashcardForm";

type Flashcard = {
  id: string;
  category?: string;
  topic?: string;
  difficulty?: string;
  question?: string;
  answer?: string;
  front?: string;
  back?: string;
  options?: string[] | string;
  explanation?: string;
  createdAt?: string;
};

export default function AdminFlashcardsPage() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch flashcards list
  const fetchFlashcards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/flashcards");
      const data = await res.json();
      if (res.ok && data.success) {
        setFlashcards(data.flashcards || []);
      }
    } catch (error) {
      console.error("Failed to fetch flashcards:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlashcards();
  }, [fetchFlashcards]);

  // Delete Single Flashcard
  const handleDeleteSingle = async (id: string) => {
    if (!confirm("Are you sure you want to delete this flashcard?")) return;

    setDeletingId(id);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/admin/flashcards?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setFlashcards((prev) => prev.filter((card) => card.id !== id));
        setStatusMessage({ type: "success", text: "Flashcard deleted successfully!" });
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to delete flashcard." });
      }
    } catch (error) {
      setStatusMessage({ type: "error", text: "Network error while deleting flashcard." });
    } finally {
      setDeletingId(null);
    }
  };

  // Delete All Flashcards
  const handleDeleteAll = async () => {
    const confirmation = prompt(
      `⚠️ WARNING: You are about to PERMANENTLY DELETE ALL ${flashcards.length} FLASHCARDS!\n\nType "DELETE ALL" to confirm:`
    );

    if (confirmation !== "DELETE ALL") {
      alert("Action cancelled. You must type 'DELETE ALL' exactly to confirm.");
      return;
    }

    setDeletingAll(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/flashcards?all=true", {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setFlashcards([]);
        setStatusMessage({ type: "success", text: data.message || "All flashcards deleted successfully!" });
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to delete all flashcards." });
      }
    } catch (error) {
      setStatusMessage({ type: "error", text: "Network error while deleting all flashcards." });
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 bg-gray-50 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">CSC Flashcard Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create single flashcards, bulk import CSV files, or manage existing cards in your database.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={fetchFlashcards}
            className="px-4 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 rounded-lg border border-gray-300 shadow-sm transition"
          >
            🔄 Refresh List
          </button>

          {flashcards.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg shadow-sm transition"
            >
              {deletingAll ? "Deleting All..." : `🗑️ Delete All (${flashcards.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Alert Notification */}
      {statusMessage && (
        <div
          className={`p-4 rounded-lg text-sm font-medium border ${
            statusMessage.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Creation Tools */}
      <div className="space-y-6">
        <SingleFlashcardForm onSuccess={fetchFlashcards} />
        <FlashcardBulkUploader onSuccess={fetchFlashcards} />
      </div>

      {/* Existing Flashcards Table / List */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Existing Flashcards ({flashcards.length})
          </h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading flashcards from database...</div>
        ) : flashcards.length === 0 ? (
          <div className="py-12 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            No flashcards found in database. Upload or add some using the forms above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {flashcards.map((card) => {
              const displayCategory = card.category || card.topic || "General";
              const displayQuestion = card.question || card.front || "No Question Provided";
              const displayAnswer = card.answer || card.back || "No Answer Provided";

              return (
                <div
                  key={card.id}
                  className="bg-gray-50 border border-gray-200 hover:border-gray-300 p-4 rounded-lg flex flex-col justify-between space-y-4 shadow-2xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {displayCategory}
                      </span>
                      {card.difficulty && (
                        <span className="text-xs font-mono text-gray-500 uppercase">
                          {card.difficulty}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-gray-900 line-clamp-3">
                      {displayQuestion}
                    </p>

                    <div className="text-xs text-green-800 bg-green-50 border border-green-200 p-2 rounded">
                      <strong className="block text-green-900">Answer:</strong>
                      {displayAnswer}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200 flex justify-end">
                    <button
                      onClick={() => handleDeleteSingle(card.id)}
                      disabled={deletingId === card.id}
                      className="px-3 py-1 text-xs font-semibold text-red-600 hover:text-white hover:bg-red-600 rounded transition border border-red-200"
                    >
                      {deletingId === card.id ? "Deleting..." : "🗑️ Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}