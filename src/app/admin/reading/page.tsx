"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const CATEGORIES = ["Verbal Reasoning", "Numerical Reasoning", "Analytical Reasoning", "General Information"];

interface ReadingModule {
  id: string;
  title: string;
  category: string;
  content: string;
  isPremium: boolean;
  createdAt: string;
}

export default function AdminReadingPage() {
  const [modules, setModules] = useState<ReadingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [content, setContent] = useState("");
  const [isPremium, setIsPremium] = useState(false);

  const fetchModules = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/reading");
    if (res.ok) {
      const data = await res.json();
      setModules(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setCategory(CATEGORIES[0]);
    setContent("");
    setIsPremium(false);
  };

  const handleEdit = (m: ReadingModule) => {
    setEditingId(m.id);
    setTitle(m.title);
    setCategory(m.category);
    setContent(m.content);
    setIsPremium(m.isPremium);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this study note?")) return;
    const res = await fetch(`/api/admin/reading/${id}`, { method: "DELETE" });
    if (res.ok) fetchModules();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = { title, category, content, isPremium };
    const url = editingId ? `/api/admin/reading/${editingId}` : "/api/admin/reading";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      resetForm();
      fetchModules();
    } else {
      alert("Failed to save study note.");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Study Notes & Reading Manager</h1>
            <p className="text-slate-500 text-sm mt-1">
              Publish study notes and cheat sheets that stream live to examinee accounts.
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm font-semibold">
            <Link href="/admin/questions" className="text-blue-600 hover:underline">
              Questions
            </Link>
            <Link href="/admin/users" className="text-blue-600 hover:underline">
              User List
            </Link>
          </div>
        </div>

        {/* Note Form */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900">
              {editingId ? "Edit Study Note" : "Publish New Study Note"}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Verb Tense Rules & Examples"
                  required
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 placeholder:text-slate-400 bg-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 bg-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="text-slate-900 bg-white">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lesson Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write study guide material, notes, or cheat sheets..."
                rows={6}
                required
                className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 placeholder:text-slate-400 bg-white outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPrem"
                checked={isPremium}
                onChange={(e) => setIsPremium(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="isPrem" className="text-sm font-semibold text-slate-700">
                Require PRO Membership to read
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition shadow-md disabled:opacity-50"
            >
              {saving ? "Publishing..." : editingId ? "Update Study Note" : "Publish Note"}
            </button>
          </form>
        </div>

        {/* Published Notes List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Published Notes ({modules.length})</h2>
          {loading ? (
            <p className="text-slate-500 text-sm">Loading notes...</p>
          ) : modules.length === 0 ? (
            <p className="text-slate-500 text-sm">No study notes published yet.</p>
          ) : (
            <div className="space-y-3">
              {modules.map((m) => (
                <div key={m.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
                        {m.category}
                      </span>
                      {m.isPremium && (
                        <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md">
                          PRO LESSON
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(m)}
                        className="text-xs font-bold text-blue-600 hover:underline px-2 py-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-xs font-bold text-red-600 hover:underline px-2 py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-900">{m.title}</h3>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}