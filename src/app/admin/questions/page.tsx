"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Question {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
}

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Input States
  const [category, setCategory] = useState("Numerical Reasoning");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answerIndex, setAnswerIndex] = useState(0);
  const [explanation, setExplanation] = useState("");

  useEffect(() => {
    fetchQuestions();
  }, []);

  async function fetchQuestions() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/questions");
      const data = await res.json();
      if (data.questions) setQuestions(data.questions);
    } catch (err) {
      console.error("Failed to load questions", err);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenNewForm() {
    setEditingId(null);
    setCategory("Numerical Reasoning");
    setPrompt("");
    setOptions(["", "", "", ""]);
    setAnswerIndex(0);
    setExplanation("");
    setShowForm(true);
  }

  function handleOpenEditForm(q: Question) {
    setEditingId(q.id);
    setCategory(q.category);
    setPrompt(q.prompt);
    setOptions([...q.options]);
    setAnswerIndex(q.answerIndex);
    setExplanation(q.explanation || "");
    setShowForm(true);
  }

  function handleOptionChange(index: number, value: string) {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  }

  async function handleSaveQuestion(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    
    const payload = { category, prompt, options, answerIndex, explanation };
    
    try {
      const url = editingId ? `/api/admin/questions/${editingId}` : "/api/admin/questions";
      const method = editingId ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        setShowForm(false);
        fetchQuestions();
      }
    } catch (err) {
      console.error("Failed to save question", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this question?")) return;
    
    try {
      await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
      fetchQuestions();
    } catch (err) {
      console.error("Failed to delete", err);
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Question Bank Admin</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your Civil Service Exam practice questions.</p>
        </div>
        <button 
          onClick={handleOpenNewForm}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition shadow-sm"
        >
          + Add Question
        </button>
      </div>

      {/* Form Modal / Dropdown */}
      {showForm && (
        <div className="bg-white p-8 rounded-3xl border border-blue-200 shadow-lg mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6">
            {editingId ? "Edit Question" : "Create New Question"}
          </h2>
          <form onSubmit={handleSaveQuestion} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 uppercase">Category</label>
                <input 
                  type="text" required value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 uppercase">Prompt / Question</label>
                <textarea 
                  required value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
                  className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-600 uppercase">Multiple Choice Options</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <input 
                      type="radio" name="correctAnswer" checked={answerIndex === idx} 
                      onChange={() => setAnswerIndex(idx)}
                      className="w-5 h-5 text-blue-600 cursor-pointer"
                    />
                    <input 
                      type="text" required value={opt} onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      className={`w-full border rounded-xl p-3 outline-none transition ${answerIndex === idx ? 'border-blue-500 bg-blue-50' : 'border-slate-300'}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 font-medium">Select the radio button next to the correct answer.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600 uppercase">Explanation (Optional)</label>
              <textarea 
                value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2}
                className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:border-blue-500"
                placeholder="Explain why the correct answer is right..."
              />
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-100">
              <button type="submit" disabled={saving} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition disabled:opacity-50">
                {saving ? "Saving..." : "Save Question"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Questions List */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        {loading ? (
          <p className="text-slate-400 font-medium animate-pulse text-center py-10">Loading questions...</p>
        ) : questions.length === 0 ? (
          <p className="text-slate-400 text-center py-10">No questions found. Click 'Add Question' above to get started.</p>
        ) : (
          questions.map((q) => (
            <div key={q.id} className="flex justify-between items-start p-5 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition">
              <div className="space-y-2 pr-6">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  {q.category}
                </span>
                <p className="font-bold text-slate-800">{q.prompt}</p>
                <div className="text-xs text-slate-500 font-medium space-x-3">
                  <span>Options: {q.options.length}</span>
                  <span className="text-emerald-600">Correct: {q.options[q.answerIndex]}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button onClick={() => handleOpenEditForm(q)} className="px-4 py-2 bg-white border border-slate-200 hover:border-blue-500 text-blue-600 font-bold text-xs rounded-lg transition shadow-sm">
                  Edit
                </button>
                <button onClick={() => handleDelete(q.id)} className="px-4 py-2 bg-white border border-slate-200 hover:border-rose-500 text-rose-600 font-bold text-xs rounded-lg transition shadow-sm">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}