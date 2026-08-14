// Relative Path: src/app/admin/questions/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BulkQuestionUploader from "@/components/admin/BulkQuestionUploader";
import NotificationBell from "@/components/NotificationBell";
import AdminBroadcastModal from "@/components/admin/AdminBroadcastModal";
import EditQuestionModal from "@/components/admin/EditQuestionModal";
import GeminiQuestionGeneratorModal from "@/components/admin/GeminiQuestionGeneratorModal";
import QuestionReview from "@/components/question/QuestionReview";
import { useSudo } from "@/context/SudoContext";
import { StructuredQuestion } from "@/types/question";

export default function AdminQuestionsPage() {
  const { fetchWithSudo } = useSudo();
  const [questions, setQuestions] = useState<StructuredQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");
  const [selectedSubtopicFilter, setSelectedSubtopicFilter] = useState("All");

  // Selection & Bulk Actions State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  // Edit & Generator Modal States
  const [editingQuestion, setEditingQuestion] = useState<StructuredQuestion | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<StructuredQuestion | null>(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  // Create Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formCategory, setFormCategory] = useState("Verbal Ability");
  const [formSubtopic, setFormSubtopic] = useState("General");
  const [formPrompt, setFormPrompt] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
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

  // Update question in state after successful edit
  const handleQuestionUpdated = (updatedQuestion: StructuredQuestion) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q))
    );
  };

  // ⚡ EXTRACT SUBTOPICS 100% DYNAMICALLY FROM DATABASE QUESTIONS
  const availableFilterSubtopics = Array.from(
    new Set(
      questions
        .filter(
          (q) =>
            selectedCategoryFilter === "All" || q.category === selectedCategoryFilter
        )
        .map((q) => q.subtopic?.trim() || "General")
        .filter(Boolean)
    )
  );

  // Filter questions by category, subtopic, and search prompt
  const filteredQuestions = questions.filter((q) => {
    const matchesCategory =
      selectedCategoryFilter === "All" || q.category === selectedCategoryFilter;
    const matchesSubtopic =
      selectedSubtopicFilter === "All" ||
      (q.subtopic?.trim() || "General") === selectedSubtopicFilter;
    const matchesSearch =
      q.prompt.toLowerCase().includes(search.toLowerCase()) ||
      q.category.toLowerCase().includes(search.toLowerCase()) ||
      (q.subtopic && q.subtopic.toLowerCase().includes(search.toLowerCase()));

    return matchesCategory && matchesSubtopic && matchesSearch;
  });

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (
      filteredQuestions.length > 0 &&
      filteredQuestions.every((q) => selectedIds.includes(q.id || ""))
    ) {
      const filteredIdSet = new Set(filteredQuestions.map((q) => q.id || ""));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const allFilteredIds = filteredQuestions.map((q) => q.id || "");
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  // Handle individual checkbox selection
  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Bulk soft-delete selected questions
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    if (
      !confirm(
        `Are you sure you want to move ${selectedIds.length} question(s) to the Trash Bin?`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetchWithSudo("/api/admin/questions/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      const data = await res.json();

      if (res.ok) {
        setQuestions((prev) => prev.filter((q) => !selectedIds.includes(q.id || "")));
        setSelectedIds([]);
      } else {
        alert(data.error || "Failed to delete selected questions.");
      }
    } catch (err) {
      console.error("Error bulk deleting questions:", err);
      alert("An error occurred during bulk deletion.");
    } finally {
      setDeleting(false);
    }
  };

  // Option input change handler for creation form
  const handleOptionChange = (index: number, value: string) => {
    const updated = [...formOptions];
    updated[index] = value;
    setFormOptions(updated);
  };

  // Submit new single question
  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

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
          subtopic: formSubtopic.trim() || "General",
          prompt: formPrompt,
          imageUrl: formImageUrl.trim() || null,
          options: formOptions,
          answerIndex: formAnswerIndex,
          explanation: formExplanation,
        }),
      });

      if (res.ok) {
        setFormPrompt("");
        setFormImageUrl("");
        setFormSubtopic("General");
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

  // Delete single question
  const handleDeleteQuestion = async (id: string) => {
    if (!confirm("Are you sure you want to move this question to the Trash Bin?")) return;

    try {
      const res = await fetchWithSudo(`/api/admin/questions?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
        setSelectedIds((prev) => prev.filter((item) => item !== id));
      } else {
        alert("Failed to delete question.");
      }
    } catch (err) {
      console.error("Error deleting question:", err);
    }
  };

  const handleExportCSV = () => {
    const url = `/api/admin/questions/export?category=${encodeURIComponent(
      selectedCategoryFilter
    )}&subtopic=${encodeURIComponent(selectedSubtopicFilter)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            Question Bank Manager
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage structured questions, review step-by-step reasoning, export CSVs, and generate content with Gemini AI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <NotificationBell />
          <AdminBroadcastModal />

          <button
            type="button"
            onClick={() => setIsGeneratorOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
          >
            <span>🤖</span>
            <span>Gemini AI Generator</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <span>📤</span>
            <span>Export CSV</span>
          </button>

          <Link
            href="/dashboard"
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition"
          >
            Dashboard
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition shadow-sm cursor-pointer"
          >
            + Add Single Question
          </button>
        </div>
      </div>

      {/* ⚡ BULK QUESTION IMPORTER SECTION */}
      <BulkQuestionUploader onSuccess={loadQuestions} />

      {/* Filter, Search & Bulk Delete Action Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
          {/* Search Bar */}
          <input
            type="text"
            placeholder="Search prompt, category, subtopic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-blue-500 transition"
          />

          {/* Category Filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => {
              setSelectedCategoryFilter(e.target.value);
              setSelectedSubtopicFilter("All");
            }}
            className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition cursor-pointer"
          >
            <option value="All">All Categories ({questions.length})</option>
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* ⚡ Dynamic Subtopic Filter */}
          <select
            value={selectedSubtopicFilter}
            onChange={(e) => setSelectedSubtopicFilter(e.target.value)}
            className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition cursor-pointer"
          >
            <option value="All">All Subtopics ({availableFilterSubtopics.length})</option>
            {availableFilterSubtopics.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>

        {/* Bulk Delete Button */}
        {selectedIds.length > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={deleting}
            className="w-full md:w-auto px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <span>🗑️</span>
            <span>
              {deleting
                ? "Deleting..."
                : `Delete Selected (${selectedIds.length})`}
            </span>
          </button>
        )}
      </div>

      {/* Questions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
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
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                  <th className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredQuestions.length > 0 &&
                        filteredQuestions.every((q) =>
                          selectedIds.includes(q.id || "")
                        )
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-4">Category / Subtopic</th>
                  <th className="p-4">Prompt & Reasoning Details</th>
                  <th className="p-4">Correct Answer</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                {filteredQuestions.map((q) => {
                  const isSelected = selectedIds.includes(q.id || "");
                  return (
                    <tr
                      key={q.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                        isSelected ? "bg-amber-50/40 dark:bg-amber-950/20" : ""
                      }`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(q.id || "")}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800 inline-block">
                            {q.category}
                          </span>
                          <p className="text-[11px] font-semibold text-slate-500">
                            {q.subtopic || "General"}
                          </p>
                        </div>
                      </td>
                      <td className="p-4 max-w-md">
                        <p className="font-bold text-slate-900 dark:text-white line-clamp-2">
                          {q.prompt}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {q.imageUrl && (
                            <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                              🖼️ Chart
                            </span>
                          )}
                          {q.stepByStep && (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              ✓ Steps
                            </span>
                          )}
                          {(q.whyA || q.whyB || q.whyC || q.whyD) && (
                            <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                              ✓ Options Analysis
                            </span>
                          )}
                          {q.eliminationStrategy && (
                            <span className="text-[9px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                              ⚡ Strategy
                            </span>
                          )}
                          {q.commonTrap && (
                            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                              ⚠️ Trap
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ✓ {q.options[q.answerIndex] || `Option ${q.answerIndex + 1}`}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPreviewQuestion(q)}
                            className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-lg transition border border-blue-200 dark:border-blue-800 cursor-pointer"
                          >
                            👁️ Preview
                          </button>
                          <button
                            onClick={() => setEditingQuestion(q)}
                            className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-lg transition border border-amber-200 dark:border-amber-800 cursor-pointer"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => q.id && handleDeleteQuestion(q.id)}
                            className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-lg transition border border-rose-200 dark:border-rose-800 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Preview Modal */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-xs font-black uppercase text-blue-600 dark:text-blue-400">
                Live Reviewer Preview Mode
              </span>
              <button
                onClick={() => setPreviewQuestion(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>
            <QuestionReview question={previewQuestion} mode="PREVIEW" />
          </div>
        </div>
      )}

      {/* Gemini AI Generator Modal */}
      <GeminiQuestionGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onQuestionsImported={loadQuestions}
      />

      {/* Edit Question Modal */}
      <EditQuestionModal
        isOpen={editingQuestion !== null}
        onClose={() => setEditingQuestion(null)}
        question={editingQuestion}
        onSuccess={handleQuestionUpdated}
      />

      {/* Add Single Question Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Add New CSE Question
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-5">
              {/* Category & Subtopic Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:border-blue-500 transition"
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subtopic (Flexible Input) */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Subtopic Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vocabulary, Work & Rate"
                    value={formSubtopic}
                    onChange={(e) => setFormSubtopic(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Question Prompt
                </label>
                <textarea
                  placeholder="Enter the question text..."
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  rows={3}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:border-blue-500 transition resize-none"
                  required
                />
              </div>

              {/* Optional Image URL */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Chart/Graph Image URL (Optional)
                </label>
                <input
                  type="text"
                  placeholder="/charts/chart1.png or https://..."
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:border-blue-500 transition"
                />
              </div>

              {/* Options */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Options (Click circle to select the correct answer)
                </label>
                <div className="space-y-2">
                  {formOptions.map((opt, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                        formAnswerIndex === idx
                          ? "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/30"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setFormAnswerIndex(idx)}
                        className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-xs transition cursor-pointer ${
                          formAnswerIndex === idx
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-slate-300 dark:border-slate-600 text-slate-400"
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </button>
                      <input
                        type="text"
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none"
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Explanation */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Official Explanation
                </label>
                <textarea
                  placeholder="Explain why the correct answer is right..."
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                  rows={3}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:border-blue-500 transition resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Saving Question..." : "Create Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}