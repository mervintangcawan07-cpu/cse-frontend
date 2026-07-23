"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const CATEGORIES = ["Verbal Reasoning", "Numerical Reasoning", "Analytical Reasoning", "General Information"];

interface Question {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
  createdAt: string;
}

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [answerIndex, setAnswerIndex] = useState(0);
  const [explanation, setExplanation] = useState("");

  const fetchQuestions = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/questions");
    if (res.ok) {
      const data = await res.json();
      setQuestions(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const resetForm = () => {
    setEditingId(null);
    setCategory(CATEGORIES[0]);
    setPrompt("");
    setOptions(["", "", "", ""]);
    setAnswerIndex(0);
    setExplanation("");
  };

  const handleEdit = (q: Question) => {
    setEditingId(q.id);
    setCategory(q.category);
    setPrompt(q.prompt);
    setOptions(q.options);
    setAnswerIndex(q.answerIndex);
    setExplanation(q.explanation || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
    if (res.ok) fetchQuestions();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = { category, prompt, options, answerIndex, explanation };
    const url = editingId ? `/api/admin/questions/${editingId}` : "/api/admin/questions";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      resetForm();
      fetchQuestions();
    } else {
      alert("Failed to save question.");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Question Bank Manager</h1>
            <p className="text-slate-500 text-sm mt-1">
              Add, edit, and organize CSE exam questions reflecting directly on examinee tests.
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm font-semibold">
            <Link href="/admin/reading" className="text-blue-600 hover:underline">
              Reading Modules
            </Link>
            <Link href="/admin/users" className="text-blue-600 hover:underline">
              User List
            </Link>
          </div>
        </div>

        {/* Question Form */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900">
              {editingId ? "Edit Question" : "Add New Question"}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm bg-white outline-none focus:border-blue-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Correct Choice</label>
                <select
                  value={answerIndex}
                  onChange={(e) => setAnswerIndex(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm bg-white outline-none focus:border-blue-500"
                >
                  {options.map((_, idx) => (
                    <option key={idx} value={idx}>
                      Option {idx + 1}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Question Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter the question prompt..."
                rows={3}
                required
                className="w-full border border-slate-300 rounded-xl p-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {options.map((opt, idx) => (
                <div key={idx}>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Option {idx + 1} {answerIndex === idx && "(Correct Answer)"}
                  </label>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    required
                    className={`w-full border rounded-xl p-3 text-sm outline-none ${
                      answerIndex === idx
                        ? "border-emerald-500 bg-emerald-50/30"
                        : "border-slate-300 focus:border-blue-500"
                    }`}
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Answer Explanation</label>
              <input
                type="text"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explain why this answer is correct..."
                className="w-full border border-slate-300 rounded-xl p-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition shadow-md disabled:opacity-50"
            >
              {saving ? "Saving Question..." : editingId ? "Update Question" : "Publish Question"}
            </button>
          </form>
        </div>

        {/* Question List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Existing Questions ({questions.length})</h2>
          {loading ? (
            <p className="text-slate-500 text-sm">Loading questions...</p>
          ) : questions.length === 0 ? (
            <p className="text-slate-500 text-sm">No questions in the database yet.</p>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
                      {q.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(q)}
                        className="text-xs font-bold text-blue-600 hover:underline px-2 py-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="text-xs font-bold text-red-600 hover:underline px-2 py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <p className="font-semibold text-slate-900 text-sm">{q.prompt}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                    {q.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border ${
                          q.answerIndex === idx
                            ? "border-emerald-500 bg-emerald-50 font-bold text-emerald-900"
                            : "border-slate-200"
                        }`}
                      >
                        {idx + 1}. {opt}
                      </div>
                    ))}
                  </div>

                  {q.explanation && (
                    <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      💡 Explanation: {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}