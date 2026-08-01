"use client";

import { useState, useEffect } from "react";

interface Question {
  id: string;
  category: string;
  subtopic?: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
  imageUrl?: string;
}

interface EditQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question | null;
  onSuccess: (updated: Question) => void;
}

export default function EditQuestionModal({
  isOpen,
  onClose,
  question,
  onSuccess,
}: EditQuestionModalProps) {
  const [category, setCategory] = useState("Verbal Ability");
  const [subtopic, setSubtopic] = useState("General");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [answerIndex, setAnswerIndex] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const categoriesList = [
    "Verbal Ability",
    "Numerical Reasoning",
    "Analytical Reasoning",
    "General Information",
    "Clerical Ability",
  ];

  useEffect(() => {
    if (question) {
      setCategory(question.category || "Verbal Ability");
      setSubtopic(question.subtopic || "General");
      setPrompt(question.prompt || "");
      setImageUrl(question.imageUrl || "");
      setOptions(
        question.options && question.options.length >= 4
          ? question.options
          : [
              question.options?.[0] || "",
              question.options?.[1] || "",
              question.options?.[2] || "",
              question.options?.[3] || "",
            ]
      );
      setAnswerIndex(question.answerIndex ?? 0);
      setExplanation(question.explanation || "");
    }
  }, [question]);

  if (!isOpen || !question) return null;

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!prompt.trim()) {
      alert("Please enter a question prompt.");
      return;
    }

    if (options.some((opt) => !opt.trim())) {
      alert("All 4 option choices must be filled out.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: question.id,
          category,
          subtopic: subtopic.trim() || "General",
          prompt,
          imageUrl: imageUrl.trim() || null,
          options,
          answerIndex,
          explanation,
        }),
      });

      const data = await res.json();

      if (res.ok && data.question) {
        onSuccess(data.question);
        onClose();
      } else {
        alert(data.error || "Failed to update question.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving question.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full border border-slate-200 shadow-2xl space-y-6 my-8">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              Admin Editing Mode
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              Edit Question Details
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-sm transition flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Category & Subtopic Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-3.5 border border-slate-200 rounded-2xl bg-slate-50 text-slate-900 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition"
                required
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Subtopic (Flexible Text Input) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Subtopic Name
              </label>
              <input
                type="text"
                value={subtopic}
                onChange={(e) => setSubtopic(e.target.value)}
                placeholder="e.g. Vocabulary, Word Problems"
                className="w-full p-3.5 border border-slate-200 rounded-2xl bg-slate-50 text-slate-900 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition"
                required
              />
            </div>
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Question Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full p-3.5 border border-slate-200 rounded-2xl bg-slate-50 text-slate-900 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition resize-none"
              required
            />
          </div>

          {/* Optional Chart Image URL */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Chart/Graph Image URL (Optional)
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="/charts/chart1.png or https://..."
              className="w-full p-3.5 border border-slate-200 rounded-2xl bg-slate-50 text-slate-900 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition"
            />
            {imageUrl && (
              <div className="mt-2 p-2 bg-slate-50 rounded-xl border border-slate-200 flex justify-center">
                <img
                  src={imageUrl}
                  alt="Chart Preview"
                  className="max-h-32 object-contain rounded-lg"
                  onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                />
              </div>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Option Choices & Correct Answer Selection
            </label>
            <div className="space-y-2.5">
              {options.map((opt, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition ${
                    answerIndex === idx
                      ? "border-emerald-500 bg-emerald-50/40"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setAnswerIndex(idx)}
                    className={`w-7 h-7 rounded-full border font-bold text-xs flex items-center justify-center shrink-0 transition cursor-pointer ${
                      answerIndex === idx
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                        : "border-slate-300 bg-white text-slate-400 hover:border-slate-400"
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </button>

                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                    className="w-full bg-transparent text-slate-900 text-sm font-medium outline-none"
                    required
                  />

                  {answerIndex === idx && (
                    <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full shrink-0">
                      Correct
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Official Solution & Explanation
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              placeholder="Provide a step-by-step solution..."
              className="w-full p-3.5 border border-slate-200 rounded-2xl bg-slate-50 text-slate-900 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Saving Changes..." : "Save Changes 💾"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}