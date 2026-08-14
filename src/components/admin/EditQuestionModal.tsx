"use client";

import { useState, useEffect } from "react";
import { StructuredQuestion } from "@/types/question";
import QuestionReview from "@/components/question/QuestionReview";

interface EditQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: StructuredQuestion | null;
  onSuccess: (updated: StructuredQuestion) => void;
}

export default function EditQuestionModal({
  isOpen,
  onClose,
  question,
  onSuccess,
}: EditQuestionModalProps) {
  const [activeTab, setActiveTab] = useState<"EDIT" | "PREVIEW">("EDIT");

  const [category, setCategory] = useState("Verbal Ability");
  const [subtopic, setSubtopic] = useState("General");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [answerIndex, setAnswerIndex] = useState(0);
  const [explanation, setExplanation] = useState("");

  // Premium Reasoning Fields
  const [stepByStep, setStepByStep] = useState("");
  const [whyA, setWhyA] = useState("");
  const [whyB, setWhyB] = useState("");
  const [whyC, setWhyC] = useState("");
  const [whyD, setWhyD] = useState("");
  const [eliminationStrategy, setEliminationStrategy] = useState("");
  const [commonTrap, setCommonTrap] = useState("");
  const [examTip, setExamTip] = useState("");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [tagsStr, setTagsStr] = useState("");

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
              question.options?.[0] || question.optionA || "",
              question.options?.[1] || question.optionB || "",
              question.options?.[2] || question.optionC || "",
              question.options?.[3] || question.optionD || "",
            ]
      );
      setAnswerIndex(question.answerIndex ?? 0);
      setExplanation(question.explanation || "");

      // Premium fields
      if (Array.isArray(question.stepByStep)) {
        setStepByStep(question.stepByStep.map((s) => `${s.step}: ${s.detail}`).join("\n"));
      } else {
        setStepByStep(question.stepByStep || "");
      }
      setWhyA(question.whyA || "");
      setWhyB(question.whyB || "");
      setWhyC(question.whyC || "");
      setWhyD(question.whyD || "");
      setEliminationStrategy(question.eliminationStrategy || "");
      setCommonTrap(question.commonTrap || "");
      setExamTip(question.examTip || "");
      setDifficulty(question.difficulty || "MEDIUM");
      setTagsStr(
        Array.isArray(question.tags)
          ? question.tags.join(", ")
          : typeof question.tags === "string"
          ? question.tags
          : ""
      );
      setActiveTab("EDIT");
    }
  }, [question]);

  if (!isOpen || !question) return null;

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const currentPreviewQuestion: StructuredQuestion = {
    id: question.id,
    category,
    subtopic,
    prompt,
    imageUrl: imageUrl.trim() || null,
    options,
    answerIndex,
    explanation: explanation.trim() || null,
    stepByStep: stepByStep.trim() || null,
    whyA: whyA.trim() || null,
    whyB: whyB.trim() || null,
    whyC: whyC.trim() || null,
    whyD: whyD.trim() || null,
    eliminationStrategy: eliminationStrategy.trim() || null,
    commonTrap: commonTrap.trim() || null,
    examTip: examTip.trim() || null,
    difficulty,
    tags: tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
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
          explanation: explanation.trim() || null,
          stepByStep: stepByStep.trim() || null,
          whyA: whyA.trim() || null,
          whyB: whyB.trim() || null,
          whyC: whyC.trim() || null,
          whyD: whyD.trim() || null,
          eliminationStrategy: eliminationStrategy.trim() || null,
          commonTrap: commonTrap.trim() || null,
          examTip: examTip.trim() || null,
          difficulty,
          tags: tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
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
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-8 max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                Admin Editor
              </span>
              <span className="text-xs font-bold text-slate-500">ID: {question.id}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
              Edit Structured Question
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switch */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("EDIT")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  activeTab === "EDIT"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-500"
                }`}
              >
                ✏️ Edit Fields
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("PREVIEW")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  activeTab === "PREVIEW"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-500"
                }`}
              >
                👁️ Live Review
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 font-bold text-sm transition flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto pr-1">
          {activeTab === "PREVIEW" ? (
            <div className="space-y-4">
              <QuestionReview question={currentPreviewQuestion} mode="PREVIEW" />
            </div>
          ) : (
            <form id="edit-question-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Category, Subtopic & Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-blue-500"
                    required
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Subtopic
                  </label>
                  <input
                    type="text"
                    value={subtopic}
                    onChange={(e) => setSubtopic(e.target.value)}
                    placeholder="e.g. Work & Rate, Analogy"
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-blue-500"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                    <option value="VERY_HARD">Very Hard</option>
                  </select>
                </div>
              </div>

              {/* Prompt */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Question Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-blue-500 resize-y"
                  required
                />
              </div>

              {/* Chart Image URL */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Chart/Diagram Image URL (Optional)
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="/charts/sample.png or https://..."
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none"
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Option Choices (Click letter to set correct answer)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {options.map((opt, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border transition ${
                        answerIndex === idx
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setAnswerIndex(idx)}
                        className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 transition cursor-pointer ${
                          answerIndex === idx
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </button>

                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        className="w-full bg-transparent text-slate-900 dark:text-white text-xs font-medium outline-none"
                        required
                      />

                      {answerIndex === idx && (
                        <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 shrink-0">
                          ✓ Correct
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step-by-Step Solution */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📝 Step-by-Step Solution (Separate steps with newlines or |)</span>
                </label>
                <textarea
                  value={stepByStep}
                  onChange={(e) => setStepByStep(e.target.value)}
                  rows={3}
                  placeholder="Step 1: Calculate combined rate...&#10;Step 2: Solve remaining work...&#10;Step 3: Compute final hours..."
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none resize-y"
                />
              </div>

              {/* Option-by-Option Explanations */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  🎯 Why Every Option Is Right or Wrong
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    value={whyA}
                    onChange={(e) => setWhyA(e.target.value)}
                    placeholder="Why Option A is right/wrong..."
                    className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                  <input
                    type="text"
                    value={whyB}
                    onChange={(e) => setWhyB(e.target.value)}
                    placeholder="Why Option B is right/wrong..."
                    className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                  <input
                    type="text"
                    value={whyC}
                    onChange={(e) => setWhyC(e.target.value)}
                    placeholder="Why Option C is right/wrong..."
                    className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                  <input
                    type="text"
                    value={whyD}
                    onChange={(e) => setWhyD(e.target.value)}
                    placeholder="Why Option D is right/wrong..."
                    className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Strategy, Trap & Tip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    ⚡ Elimination Strategy
                  </label>
                  <textarea
                    value={eliminationStrategy}
                    onChange={(e) => setEliminationStrategy(e.target.value)}
                    rows={2}
                    placeholder="How to eliminate wrong choices..."
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    ⚠️ Common Trap
                  </label>
                  <textarea
                    value={commonTrap}
                    onChange={(e) => setCommonTrap(e.target.value)}
                    rows={2}
                    placeholder="The misconception this tests..."
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    💡 Exam Day Tip
                  </label>
                  <textarea
                    value={examTip}
                    onChange={(e) => setExamTip(e.target.value)}
                    rows={2}
                    placeholder="Test-taking advice..."
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none resize-none"
                  />
                </div>
              </div>

              {/* Standard Explanation Fallback */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Summary / Standard Explanation
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={2}
                  placeholder="Official summary explanation..."
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none resize-none"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="edit-question-form"
            disabled={submitting}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Saving Changes..." : "Save Changes 💾"}
          </button>
        </div>
      </div>
    </div>
  );
}