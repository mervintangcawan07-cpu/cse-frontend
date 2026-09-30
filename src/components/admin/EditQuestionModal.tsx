"use client";

import React, { useState } from "react";
import { StructuredQuestion } from "@/types/question";
import QuestionReview from "@/components/question/QuestionReview";

interface EditQuestionModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly question: StructuredQuestion | null;
  readonly onSuccess: (updated: StructuredQuestion) => void;
}

interface EditQuestionContentProps {
  readonly question: StructuredQuestion;
  readonly onClose: () => void;
  readonly onSuccess: (updated: StructuredQuestion) => void;
}

const CATEGORIES_LIST = [
  "Verbal Ability",
  "Numerical Reasoning",
  "Analytical Reasoning",
  "General Information",
  "Clerical Ability",
];

function resolveInitialOptions(question: StructuredQuestion): string[] {
  if (question.options && question.options.length >= 4) {
    return question.options;
  }
  return [
    question.options?.[0] || question.optionA || "",
    question.options?.[1] || question.optionB || "",
    question.options?.[2] || question.optionC || "",
    question.options?.[3] || question.optionD || "",
  ];
}

function resolveInitialStepByStep(stepByStep: StructuredQuestion["stepByStep"]): string {
  if (Array.isArray(stepByStep)) {
    return stepByStep.map((s) => `${s.step}: ${s.detail}`).join("\n");
  }
  return stepByStep || "";
}

function resolveInitialTags(tags: StructuredQuestion["tags"]): string {
  if (Array.isArray(tags)) {
    return tags.join(", ");
  }
  return typeof tags === "string" ? tags : "";
}

function EditQuestionContent({
  question,
  onClose,
  onSuccess,
}: Readonly<EditQuestionContentProps>) {
  const [activeTab, setActiveTab] = useState<"EDIT" | "PREVIEW">("EDIT");

  const [category, setCategory] = useState(question.category || "Verbal Ability");
  const [subtopic, setSubtopic] = useState(question.subtopic || "General");
  const [prompt, setPrompt] = useState(question.prompt || "");
  const [imageUrl, setImageUrl] = useState(question.imageUrl || "");
  const [options, setOptions] = useState<string[]>(() => resolveInitialOptions(question));
  const [answerIndex, setAnswerIndex] = useState(question.answerIndex ?? 0);
  const [explanation, setExplanation] = useState(question.explanation || "");

  // Premium Reasoning Fields
  const [stepByStep, setStepByStep] = useState(() => resolveInitialStepByStep(question.stepByStep));
  const [whyA, setWhyA] = useState(question.whyA || "");
  const [whyB, setWhyB] = useState(question.whyB || "");
  const [whyC, setWhyC] = useState(question.whyC || "");
  const [whyD, setWhyD] = useState(question.whyD || "");
  const [eliminationStrategy, setEliminationStrategy] = useState(question.eliminationStrategy || "");
  const [commonTrap, setCommonTrap] = useState(question.commonTrap || "");
  const [examTip, setExamTip] = useState(question.examTip || "");
  const [difficulty, setDifficulty] = useState(question.difficulty || "MEDIUM");
  const [tagsStr, setTagsStr] = useState(() => resolveInitialTags(question.tags));

  const [submitting, setSubmitting] = useState(false);

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
    tags: tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
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
          tags: tagsStr
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
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
      console.error("Failed to update question:", err);
      alert("An error occurred while saving question.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/80 p-3 backdrop-blur-sm sm:p-4">
      <div className="my-6 flex max-h-[92vh] w-full max-w-4xl flex-col space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-600 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
                Admin Editor
              </span>
              <span className="text-xs font-bold text-slate-500">ID: {question.id}</span>
            </div>
            <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
              Edit Structured Question
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switch */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("EDIT")}
                className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-bold transition ${
                  activeTab === "EDIT"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-500"
                }`}
              >
                ✏️ Edit Fields
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("PREVIEW")}
                className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-bold transition ${
                  activeTab === "PREVIEW"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-500"
                }`}
              >
                👁️ Live Review
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label
                    htmlFor="edit-category"
                    className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Category
                  </label>
                  <select
                    id="edit-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    required
                  >
                    {CATEGORIES_LIST.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="edit-subtopic"
                    className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Subtopic
                  </label>
                  <input
                    id="edit-subtopic"
                    type="text"
                    value={subtopic}
                    onChange={(e) => setSubtopic(e.target.value)}
                    placeholder="e.g. Work & Rate, Analogy"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="edit-difficulty"
                    className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Difficulty
                  </label>
                  <select
                    id="edit-difficulty"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                <label
                  htmlFor="edit-prompt"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Question Prompt
                </label>
                <textarea
                  id="edit-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>

              {/* Chart Image URL */}
              <div className="space-y-1">
                <label
                  htmlFor="edit-image-url"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Chart/Diagram Image URL (Optional)
                </label>
                <input
                  id="edit-image-url"
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="/charts/sample.png or https://..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Option Choices (Click letter to set correct answer)
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {options.map((opt, idx) => {
                    const optionLetter = String.fromCodePoint(65 + idx);
                    const optionInputId = `edit-option-${optionLetter.toLowerCase()}`;

                    return (
                      <div
                        key={optionLetter}
                        className={`flex items-center gap-2.5 rounded-xl border p-2 transition ${
                          answerIndex === idx
                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30"
                            : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setAnswerIndex(idx)}
                          className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg text-xs font-black transition ${
                            answerIndex === idx
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {optionLetter}
                        </button>

                        <input
                          id={optionInputId}
                          type="text"
                          value={opt}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          placeholder={`Option ${optionLetter}`}
                          aria-label={`Option ${optionLetter}`}
                          className="w-full bg-transparent text-xs font-medium text-slate-900 outline-none dark:text-white"
                          required
                        />

                        {answerIndex === idx && (
                          <span className="shrink-0 text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                            ✓ Correct
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step-by-Step Solution */}
              <div className="space-y-1">
                <label
                  htmlFor="edit-step-by-step"
                  className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  <span>📝 Step-by-Step Solution (Separate steps with newlines or |)</span>
                </label>
                <textarea
                  id="edit-step-by-step"
                  value={stepByStep}
                  onChange={(e) => setStepByStep(e.target.value)}
                  rows={3}
                  placeholder="Step 1: Calculate combined rate...&#10;Step 2: Solve remaining work...&#10;Step 3: Compute final hours..."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Option-by-Option Explanations */}
              <div className="space-y-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  🎯 Why Every Option Is Right or Wrong
                </span>
                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <input
                    type="text"
                    value={whyA}
                    onChange={(e) => setWhyA(e.target.value)}
                    placeholder="Why Option A is right/wrong..."
                    aria-label="Reasoning for Option A"
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="text"
                    value={whyB}
                    onChange={(e) => setWhyB(e.target.value)}
                    placeholder="Why Option B is right/wrong..."
                    aria-label="Reasoning for Option B"
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="text"
                    value={whyC}
                    onChange={(e) => setWhyC(e.target.value)}
                    placeholder="Why Option C is right/wrong..."
                    aria-label="Reasoning for Option C"
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="text"
                    value={whyD}
                    onChange={(e) => setWhyD(e.target.value)}
                    placeholder="Why Option D is right/wrong..."
                    aria-label="Reasoning for Option D"
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Strategy, Trap & Tip */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <label
                    htmlFor="edit-elimination"
                    className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    ⚡ Elimination Strategy
                  </label>
                  <textarea
                    id="edit-elimination"
                    value={eliminationStrategy}
                    onChange={(e) => setEliminationStrategy(e.target.value)}
                    rows={2}
                    placeholder="How to eliminate wrong choices..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="edit-trap"
                    className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    ⚠️ Common Trap
                  </label>
                  <textarea
                    id="edit-trap"
                    value={commonTrap}
                    onChange={(e) => setCommonTrap(e.target.value)}
                    rows={2}
                    placeholder="The misconception this tests..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="edit-tip"
                    className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    💡 Exam Day Tip
                  </label>
                  <textarea
                    id="edit-tip"
                    value={examTip}
                    onChange={(e) => setExamTip(e.target.value)}
                    rows={2}
                    placeholder="Test-taking advice..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Standard Explanation Fallback */}
              <div className="space-y-1">
                <label
                  htmlFor="edit-explanation"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Summary / Standard Explanation
                </label>
                <textarea
                  id="edit-explanation"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={2}
                  placeholder="Official summary explanation..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="cursor-pointer rounded-xl bg-slate-100 px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="edit-question-form"
            disabled={submitting}
            className="cursor-pointer rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
          >
            {submitting ? "Saving Changes..." : "Save Changes 💾"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditQuestionModal({
  isOpen,
  onClose,
  question,
  onSuccess,
}: Readonly<EditQuestionModalProps>) {
  if (!isOpen || !question) return null;

  return (
    <EditQuestionContent
      key={question.id}
      question={question}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}