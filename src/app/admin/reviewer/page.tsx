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

  useEffect(() => { loadNotes(); }, []);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !summary || !contentInput) return alert("Fill required fields.");

    setSubmitting(true);
    const contentArr = contentInput.split("\n").filter((line) => line.trim().length > 0);

    try {
      const res = await fetch("/api/reviewer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title, summary, content: contentArr, tips }),
      });

      if (res.ok) {
        setTitle("");
        setSummary("");
        setContentInput("");
        setTips("");
        loadNotes();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this study note?")) return;
    try {
      const res = await fetch(`/api/reviewer?id=${id}`, { method: "DELETE" });
      if (res.ok) setNotes(notes.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-3xl">
        <div>
          <h1 className="text-2xl font-black">Study Notes Manager</h1>
          <p className="text-slate-400 text-xs mt-1">Add or remove reviewer notes.</p>
        </div>
        <Link href="/dashboard" className="px-4 py-2 bg-slate-800 text-xs font-bold rounded-xl border border-slate-700">
          Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form onSubmit={handleCreateNote} className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
          <h2 className="font-extrabold text-slate-800 text-base">Add New Study Note</h2>
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
              placeholder="Brief overview"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Rules (1 per line)</label>
            <textarea
              rows={5}
              placeholder="1. Rule one..."
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Exam Pro-Tip (Optional)</label>
            <input
              type="text"
              placeholder="Pro-tip details"
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            {submitting ? "Publishing..." : "Publish Study Note"}
          </button>
        </form>

        <div className="lg:col-span-7 space-y-4 max-h-[700px] overflow-y-auto">
          <h2 className="font-extrabold text-slate-800 text-base">Published Notes ({notes.length})</h2>
          {loading ? (
            <p className="text-xs text-slate-400">Loading notes...</p>
          ) : notes.length === 0 ? (
            <p className="text-xs text-slate-400">No study notes added yet.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="bg-white p-5 rounded-3xl border border-slate-200 space-y-2 shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                    {note.category}
                  </span>
                  <button onClick={() => handleDelete(note.id)} className="text-rose-600 text-xs font-bold hover:underline">
                    Delete
                  </button>
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