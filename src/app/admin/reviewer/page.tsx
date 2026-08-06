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
  videoUrl?: string;
}

export default function AdminReviewerPage() {
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Form State
  const [category, setCategory] = useState("Verbal Ability");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [contentInput, setContentInput] = useState("");
  const [tips, setTips] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadNotes = async () => {
    try {
      const res = await fetch("/api/reviewer");
      if (res.ok) {
        const data = await res.json();
        if (data.notes) setNotes(data.notes);
      }
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
    setVideoUrl("");
  };

  const handleStartEdit = (note: StudyNote) => {
    setEditingNoteId(note.id);
    setCategory(note.category);
    setTitle(note.title);
    setSummary(note.summary);
    setContentInput(note.content.join("\n"));
    setTips(note.tips || "");
    setVideoUrl(note.videoUrl || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !summary || !contentInput) return alert("Please fill in all required fields.");

    setSubmitting(true);
    const contentArr = contentInput.split("\n").filter((line) => line.trim().length > 0);

    const isEdit = !!editingNoteId;
    const method = isEdit ? "PUT" : "POST";
    const payload = isEdit
      ? { id: editingNoteId, category, title, summary, content: contentArr, tips, videoUrl }
      : { category, title, summary, content: contentArr, tips, videoUrl };

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
    <div className="max-w-6xl mx-auto p-6 space-y-8 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-3xl shadow-md">
        <div>
          <h1 className="text-2xl font-black">Study Notes Manager</h1>
          <p className="text-slate-400 text-xs mt-1">Create, edit, or remove reviewer study notes.</p>
        </div>
        <div className="flex gap-2">
          {editingNoteId && (
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              + Add New Note
            </button>
          )}
          <Link
            href="/admin/dashboard"
            className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-700 hover:bg-slate-700 transition"
          >
            Control Center
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Panel */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 space-y-4 shadow-sm"
        >
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="font-extrabold text-slate-900 text-base">
              {editingNoteId ? "✏️ Edit Study Note" : "+ Add New Study Note"}
            </h2>
            {editingNoteId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-extrabold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition cursor-pointer"
            >
              <option value="Verbal Ability">Verbal Ability</option>
              <option value="Numerical Reasoning">Numerical Reasoning</option>
              <option value="General Information">General Information</option>
              <option value="Analytical Reasoning">Analytical Reasoning</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
              Title
            </label>
            <input
              type="text"
              placeholder="e.g. Subject-Verb Agreement Rules"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
              Summary
            </label>
            <input
              type="text"
              placeholder="Brief overview of topic"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
              Rules (1 bullet point per line)
            </label>
            <textarea
              rows={6}
              placeholder="1. Singular subjects take singular verbs..."
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
              Exam Pro-Tip (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Always identify the true subject..."
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              className="w-full p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-amber-800/40 focus:bg-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
              Video Explanation Link (Optional)
            </label>
            <input
              type="url"
              placeholder="e.g. https://facebook.com/watch/?v=123456789"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 text-white font-extrabold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 ${
              editingNoteId ? "bg-amber-600 hover:bg-amber-500" : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {submitting ? "Saving..." : editingNoteId ? "Update Study Note" : "Publish Study Note"}
          </button>
        </form>

        {/* Existing Notes List */}
        <div className="lg:col-span-7 space-y-4 max-h-[750px] overflow-y-auto pr-1">
          <h2 className="font-extrabold text-slate-800 text-base">Published Notes ({notes.length})</h2>

          {loading ? (
            <p className="text-xs text-slate-400 font-bold animate-pulse">Loading study notes...</p>
          ) : notes.length === 0 ? (
            <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-slate-400 text-xs">
              No study notes created yet. Use the form on the left to add one.
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className={`bg-white p-5 rounded-3xl border transition space-y-2 shadow-sm ${
                  editingNoteId === note.id ? "border-amber-500 bg-amber-50/30" : "border-slate-200"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md">
                    {note.category}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleStartEdit(note)}
                      className="text-amber-600 text-xs font-bold hover:underline cursor-pointer"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="text-rose-600 text-xs font-bold hover:underline cursor-pointer"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
                <h3 className="font-extrabold text-slate-800 text-sm">{note.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{note.summary}</p>
                {note.videoUrl && (
                  <span className="inline-block text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md mt-1">
                    🎥 Video Link Attached
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
