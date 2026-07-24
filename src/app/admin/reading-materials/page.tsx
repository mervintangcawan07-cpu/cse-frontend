"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Handbook {
  id: string;
  title: string;
  category: string;
  description: string;
  pages: string;
  fileName: string;
}

export default function AdminReadingMaterialsPage() {
  const [handbooks, setHandbooks] = useState<Handbook[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit State
  const [editingHandbookId, setEditingHandbookId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Constitutional Basis");
  const [description, setDescription] = useState("");
  const [pages, setPages] = useState("12 Pages");
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadHandbooks = async () => {
    try {
      const res = await fetch("/api/reading-materials");
      const data = await res.json();
      if (res.ok && data.handbooks) setHandbooks(data.handbooks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHandbooks();
  }, []);

  const resetForm = () => {
    setEditingHandbookId(null);
    setTitle("");
    setCategory("Constitutional Basis");
    setDescription("");
    setPages("12 Pages");
    setFileData(null);
    setFileName("");
  };

  const handleStartEdit = (h: Handbook) => {
    setEditingHandbookId(h.id);
    setTitle(h.title);
    setCategory(h.category);
    setDescription(h.description);
    setPages(h.pages);
    setFileName(h.fileName);
    setFileData(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        alert("File size exceeds 15MB limit.");
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFileData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!editingHandbookId;

    if (!title || !description) {
      return alert("Please fill in title and description.");
    }

    if (!isEdit && !fileData) {
      return alert("Please select a document file (.pdf, .doc, .docx).");
    }

    setSubmitting(true);
    const method = isEdit ? "PUT" : "POST";
    const payload = isEdit
      ? { id: editingHandbookId, title, category, description, pages, fileData, fileName }
      : { title, category, description, pages, fileData, fileName };

    try {
      const res = await fetch("/api/reading-materials", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        resetForm();
        loadHandbooks();
        alert(isEdit ? "Handbook updated successfully!" : "Handbook uploaded successfully!");
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
    if (!confirm("Are you sure you want to delete this handbook?")) return;
    try {
      const res = await fetch(`/api/reading-materials?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        if (editingHandbookId === id) resetForm();
        setHandbooks(handbooks.filter((h) => h.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-3xl">
        <div>
          <h1 className="text-2xl font-black">Admin Handbooks & Documents Manager</h1>
          <p className="text-slate-400 text-xs mt-1">Upload PDF or Word documents for read-only student viewing.</p>
        </div>
        <div className="flex gap-2">
          {editingHandbookId && (
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition"
            >
              + Upload New Document
            </button>
          )}
          <Link href="/admin/dashboard" className="px-4 py-2 bg-slate-800 text-xs font-bold rounded-xl border border-slate-700">
            Control Center
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form onSubmit={handleSubmit} className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h2 className="font-extrabold text-slate-800 text-base">
              {editingHandbookId ? "✏️ Edit Handbook Metadata" : "+ Upload New Document"}
            </h2>
            {editingHandbookId && (
              <button type="button" onClick={resetForm} className="text-xs font-bold text-slate-400 hover:text-slate-600">
                Cancel
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              {editingHandbookId ? "Replace File (Optional: .pdf, .doc, .docx)" : "Select File (.pdf, .doc, .docx)"}
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            {fileName && (
              <p className="text-[11px] font-semibold text-emerald-600 mt-1">
                {fileData ? "✓ Attached: " : "📄 Attached: "} {fileName}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Title</label>
            <input
              type="text"
              placeholder="e.g. R.A. 6713 Ethical Standards"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
            >
              <option value="Constitutional Basis">Constitutional Basis</option>
              <option value="Ethical Standards">Ethical Standards</option>
              <option value="Civil Service Rules">Civil Service Rules</option>
              <option value="General Knowledge">General Knowledge</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Summary of document contents..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Page Count Label</label>
            <input
              type="text"
              placeholder="e.g. 18 Pages"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50 ${
              editingHandbookId ? "bg-amber-600 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            {submitting ? "Saving..." : editingHandbookId ? "Update Handbook" : "Upload Document"}
          </button>
        </form>

        <div className="lg:col-span-7 space-y-4 max-h-[700px] overflow-y-auto">
          <h2 className="font-extrabold text-slate-800 text-base">Uploaded Handbooks ({handbooks.length})</h2>

          {loading ? (
            <p className="text-xs text-slate-400">Loading handbooks...</p>
          ) : handbooks.length === 0 ? (
            <p className="text-xs text-slate-400">No handbooks uploaded yet.</p>
          ) : (
            handbooks.map((h) => (
              <div
                key={h.id}
                className={`bg-white p-5 rounded-3xl border transition space-y-2 shadow-sm ${
                  editingHandbookId === h.id ? "border-amber-400 bg-amber-50/20" : "border-slate-200"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md">
                    {h.category} • {h.pages}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleStartEdit(h)}
                      className="text-amber-600 text-xs font-bold hover:underline"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(h.id)}
                      className="text-rose-600 text-xs font-bold hover:underline"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
                <h3 className="font-extrabold text-slate-800 text-sm">{h.title}</h3>
                <p className="text-xs text-slate-500">{h.description}</p>
                <p className="text-[11px] font-mono text-slate-400 mt-1">📄 {h.fileName}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}