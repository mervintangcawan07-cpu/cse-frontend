"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Flashcard {
  id: string;
  category: string;
  topic: string;
  front: string;
  back: string;
  createdAt: string;
}

export default function AdminFlashcardsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState("Verbal Ability");
  const [topic, setTopic] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  const categories = [
    "Verbal Ability",
    "General Information",
    "Numerical Reasoning",
    "Analytical Ability",
  ];

  const loadCards = async () => {
    try {
      const res = await fetch("/api/admin/flashcards");
      const data = await res.json();
      if (res.ok && data.flashcards) {
        setCards(data.flashcards);
      } else if (res.status === 403) {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Failed to load cards:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, []);

  const handleEditClick = (card: Flashcard) => {
    setEditingId(card.id);
    setCategory(card.category);
    setTopic(card.topic);
    setFront(card.front);
    setBack(card.back);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTopic("");
    setFront("");
    setBack("");
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const method = editingId ? "PUT" : "POST";
    const bodyPayload = {
      id: editingId || undefined,
      category,
      topic,
      front,
      back,
    };

    try {
      const res = await fetch("/api/admin/flashcards", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: editingId ? "🎉 Flashcard updated!" : "🎉 Flashcard added successfully!",
        });
        handleCancelEdit();
        loadCards();
      } else {
        setMessage({ type: "error", text: data.error || "Operation failed." });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Network error saving flashcard." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this flashcard?")) return;

    try {
      const res = await fetch(`/api/admin/flashcards?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "success", text: "Flashcard deleted." });
        setCards((prev) => prev.filter((c) => c.id !== id));
      } else {
        alert("Failed to delete card.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting flashcard.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading Admin Flashcard Manager...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6 text-slate-100">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
            Admin Panel
          </span>
          <h1 className="text-2xl font-black text-white mt-2">Manage Flashcards Deck</h1>
          <p className="text-xs text-slate-400 mt-1">
            Create, update, or remove active-recall cards in the flashcard review deck.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 shrink-0"
        >
          ← Dashboard
        </Link>
      </div>

      {/* ALERT MESSAGE */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold border ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ADD / EDIT FORM CARD */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h2 className="text-base font-black text-white">
          {editingId ? "✏️ Edit Flashcard" : "➕ Add New Flashcard"}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Topic / Sub-heading</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Vocabulary, Constitution, Word Problems"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-medium text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300">Front (Prompt / Question)</label>
          <textarea
            rows={2}
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder="Type the question or concept prompt..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-medium text-white focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300">Back (Answer / Rationalization)</label>
          <textarea
            rows={3}
            value={back}
            onChange={(e) => setBack(e.target.value)}
            placeholder="Type the full answer and explanation..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-medium text-white focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-md transition disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Update Flashcard" : "Save Flashcard"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      {/* FLASHCARDS TABLE / LIST */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-black text-white">Active Flashcard Deck ({cards.length})</h2>
          <Link
            href="/flashcards"
            className="text-xs font-bold text-amber-400 hover:text-amber-300 transition"
          >
            Preview Student Deck &rarr;
          </Link>
        </div>

        {cards.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No flashcards found in database.</p>
        ) : (
          <div className="space-y-3">
            {cards.map((card) => (
              <div
                key={card.id}
                className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-700 transition"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                      {card.category}
                    </span>
                    <span className="text-xs font-bold text-slate-300">• {card.topic}</span>
                  </div>
                  <h3 className="text-xs font-bold text-white">Front: {card.front}</h3>
                  <p className="text-[11px] text-slate-400 line-clamp-2">Back: {card.back}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                  <button
                    onClick={() => handleEditClick(card)}
                    className="px-3 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 rounded-xl text-xs font-bold transition"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(card.id)}
                    className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/30 rounded-xl text-xs font-bold transition"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}