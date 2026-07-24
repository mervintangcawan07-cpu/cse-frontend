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
  const [search, setSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formCategory, setFormCategory] = useState("Verbal Ability");
  const [formPrompt, setFormPrompt] = useState("");
  const [formOptions, setFormOptions] = useState(["", "", "", ""]);
  const [formAnswerIndex, setFormAnswerIndex] = useState(0);
  const [formExplanation, setFormExplanation] = useState("");

  const categoriesList = [
    "Verbal Ability",
    "Numerical Reasoning",
    "Analytical Reasoning",
    "General Information",
    "Clerical Ability",
  ];

  // Fetch all questions
  const loadQuestions = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/questions");
      const data = await res.json();
      if (res.ok && data.questions) {
        setQuestions(data.questions);
      }
    } catch (err) {
      console.error("Failed to load admin questions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  // Option input change handler
  const handleOptionChange = (index: number, value: string) => {
    const updated = [...formOptions];
    updated[index] = value;
    setFormOptions(updated);
  };

  // Submit new question
  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Basic validation
    if (!formPrompt.trim() || formOptions.some((opt) => !opt.trim())) {
      alert("Please fill in the prompt and all 4 options.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formCategory,
          prompt: formPrompt,
          options: formOptions,
          answerIndex: formAnswerIndex,
          explanation: formExplanation,
        }),
      });

      if (res.ok) {
        // Reset Form & Close Modal
        setFormPrompt("");
        setFormOptions(["", "", "", ""]);
        setFormAnswerIndex(0);
        setFormExplanation("");
        setIsModalOpen(false);
        loadQuestions();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to create question.");
      }
    } catch (err) {
      console.error("Error creating question:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete question
  const handleDeleteQuestion = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      const res = await fetch(`/api/admin/questions?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
      } else {
        alert("Failed to delete question.");
      }
    } catch (err) {
      console.error("Error deleting question:", err);
    }
  };

  // Filter questions by category and search
  const filteredQuestions = questions.filter((q) => {
    const matchesCategory =
      selectedCategoryFilter === "All" || q.category === selectedCategoryFilter;
    const matchesSearch =
      q.prompt.toLowerCase().includes(search.toLowerCase()) ||
      q.category.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Question Bank Manager</h1>
          <p className="text-slate-500 text-sm mt-1">
            Add, review, and delete practice questions in your Neon DB database.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
          >
            Dashboard
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition shadow-sm"
          >
            + Add New Question
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between">
        <input
          type="text"
          placeholder="Search question prompts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-80 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-500 transition"
        />

        <select
          value={selectedCategoryFilter}
          onChange={(e) => setSelectedCategoryFilter(e.target.value)}
          className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition"
        >
          <option value="All">All Categories ({questions.length})</option>
          {categoriesList.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Questions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium animate-pulse">
            Loading questions from database...
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No questions found matching your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                  <th className="p-4">Category</th>
                  <th className="p-4">Prompt</th>
                  <th className="p-4">Correct Answer</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                {filteredQuestions.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4">
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md">
                        {q.category}
                      </span>
                    </td>
                    <td className="p-4 max-w-md">
                      <p className="font-bold text-slate-800 line-clamp-2">{q.prompt}</p>
                      {q.explanation && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                          💡 {q.explanation}
                        </p>
                      )}
                    </td>
                    <td className="p-4 font-semibold text-emerald-700">
                      ✓ {q.options[q.answerIndex] || `Option ${q.answerIndex + 1}`}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Question Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full border border-slate-200 shadow-2xl space-y-6 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h2 className="text-xl font-extrabold text-slate-900">Add New CSE Question</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-5">
              {/* Category */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition"
                >
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Question Prompt */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Question Prompt
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Type the question prompt here..."
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              {/* 4 Choices */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Multiple Choice Options
                </label>
                {formOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="correctAnswer"
                      checked={formAnswerIndex === idx}
                      onChange={() => setFormAnswerIndex(idx)}
                      className="w-4 h-4 text-blue-600 accent-blue-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      required
                      placeholder={`Option ${idx + 1}`}
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      className={`w-full p-3 border rounded-xl text-sm outline-none transition ${
                        formAnswerIndex === idx
                          ? "border-emerald-500 bg-emerald-50/30 text-slate-900 font-semibold"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    />
                  </div>
                ))}
                <p className="text-[11px] text-slate-400">
                  💡 Select the radio button next to the correct answer.
                </p>
              </div>

              {/* Explanation */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Answer Explanation (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide an explanation for the correct answer..."
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}