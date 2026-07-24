"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface StudyNote {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: string[];
  tips?: string;
}

export default function AdminReviewerPage() {
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit/Add Mode state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Form State
  const [category, setCategory] = useState("Verbal Ability");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [contentInput, setContentInput] = useState("");
  const [tips, setTips] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadNotes = async () => {
    try {
      const res = await fetch("/api/reviewer");
      const data = await res.json();
      if (res.ok && data.notes) setNotes(data.notes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const resetForm = () => {
    setEditingNoteId(null);
    setCategory("Verbal Ability");
    setTitle("");
    setSummary("");
    setContentInput("");
    setTips("");
  };

  const handleStartEdit = (note: StudyNote) => {
    setEditingNoteId(note.id);
    setCategory(note.category);
    setTitle(note.title);
    setSummary(note.summary);
    setContentInput(note.content.join("\n"));
    setTips(note.tips || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !summary || !contentInput) return alert("Please fill all required fields.");

    setSubmitting(true);
    const contentArr = contentInput.split("\n").filter((line) => line.trim().length > 0);

    const isEdit = !!editingNoteId;
    const method = isEdit ? "PUT" : "POST";
    const payload = isEdit
      ? { id: editingNoteId, category, title, summary, content: contentArr, tips }
      : { category, title, summary, content: contentArr, tips };

    try {
      const res = await fetch("/api/reviewer", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        resetForm();
        loadNotes();
        alert(isEdit ? "Note updated successfully!" : "Note published successfully!");
      } else {
        alert("Operation failed.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this study note?")) return;
    try {
      const res = await fetch(`/api/reviewer?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        if (editingNoteId === id) resetForm();
        setNotes(notes.filter((n) => n.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-3xl">
        <div>
          <h1 className="text-2xl font-black">Study Notes Manager</h1>
          <p className="text-slate-400 text-xs mt-1">Create, update, or remove reviewer study notes.</p>
        </div>
        <div className="flex gap-2">
          {editingNoteId && (
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition"
            >
              + Add New Note
            </button>
          )}
          <Link href="/dashboard" className="px-4 py-2 bg-slate-800 text-xs font-bold rounded-xl border border-slate-700">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Panel */}
        <form onSubmit={handleSubmit} className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h2 className="font-extrabold text-slate-800 text-base">
              {editingNoteId ? "✏️ Edit Study Note" : "+ Add New Study Note"}
            </h2>
            {editingNoteId && (
              <button type="button" onClick={resetForm} className="text-xs font-bold text-slate-400 hover:text-slate-600">
                Cancel Edit
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
            >
              <option value="Verbal Ability">Verbal Ability</option>
              <option value="Numerical Reasoning">Numerical Reasoning</option>
              <option value="General Information">General Information</option>
              <option value="Analytical Reasoning">Analytical Reasoning</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Title</label>
            <input
              type="text"
              placeholder="e.g. Subject-Verb Agreement Rules"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Summary</label>
            <input
              type="text"
              placeholder="Brief overview of topic"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Rules (1 bullet point per line)</label>
            <textarea
              rows={5}
              placeholder="1. Singular subjects take singular verbs..."
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Exam Pro-Tip (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Always identify the true subject..."
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 text-white font-bold text-xs rounded-xl shadow-sm transition ${
              editingNoteId ? "bg-amber-600 hover:bg-amber-500" : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {submitting ? "Saving..." : editingNoteId ? "Update Study Note" : "Publish Study Note"}
          </button>
        </form>

        {/* Existing Notes List */}
        <div className="lg:col-span-7 space-y-4 max-h-[700px] overflow-y-auto">
          <div className="flex justify-between items-center">
            <h2 className="font-extrabold text-slate-800 text-base">Published Notes ({notes.length})</h2>
          </div>

          {loading ? (
            <p className="text-xs text-slate-400">Loading study notes...</p>
          ) : notes.length === 0 ? (
            <p className="text-xs text-slate-400">No study notes created yet.</p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className={`bg-white p-5 rounded-3xl border transition space-y-2 shadow-sm ${
                  editingNoteId === note.id ? "border-amber-400 bg-amber-50/20" : "border-slate-200"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                    {note.category}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleStartEdit(note)}
                      className="text-amber-600 text-xs font-bold hover:underline"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="text-rose-600 text-xs font-bold hover:underline"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
                <h3 className="font-extrabold text-slate-800 text-sm">{note.title}</h3>
                <p className="text-xs text-slate-500">{note.summary}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}