// Relative Path: src/components/social/rooms/ChooseTopicModal.tsx
"use client";

import { useState, useEffect, useRef } from "react";

interface ChooseTopicModalProps {
  isOpen: boolean;
  roomId: string;
  onClose: () => void;
  onTopicUpdated: (newTopic: {
    activeTopicType: "QUESTION" | "IMAGE" | null;
    activeQuestionId?: string | null;
    activeTopicImage?: string | null;
    activeTopicMeta?: any;
  }) => void;
}

const CATEGORIES = [
  "All",
  "Verbal Ability",
  "Numerical Reasoning",
  "Analytical Reasoning",
  "General Information",
  "Clerical Ability",
];

export function ChooseTopicModal({
  isOpen,
  roomId,
  onClose,
  onTopicUpdated,
}: ChooseTopicModalProps) {
  const [activeTab, setActiveTab] = useState<"QUESTION_BANK" | "UPLOAD_IMAGE">("QUESTION_BANK");

  // Question Bank State
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Upload Image State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageTitle, setImageTitle] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch questions from question bank
  const fetchQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "All") {
        params.set("category", selectedCategory);
      }
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      params.set("page", String(page));
      params.set("limit", "8");

      const res = await fetch(`/api/social/rooms/${roomId}/topic?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalCount(data.pagination.totalCount || 0);
        }
      }
    } catch (err) {
      console.error("Failed to fetch questions:", err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "QUESTION_BANK") {
      fetchQuestions();
    }
  }, [isOpen, selectedCategory, page, activeTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchQuestions();
  };

  // Select Question as Topic
  const handleSelectQuestion = async () => {
    if (!selectedQuestion || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/social/rooms/${roomId}/topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicType: "QUESTION",
          questionId: selectedQuestion.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onTopicUpdated(data.topic);
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to set question as topic");
      }
    } catch (err) {
      console.error("Failed to set question topic:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Image File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.");
      return;
    }

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size exceeds 5MB limit. Please choose a smaller image.");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Upload Image as Topic
  const handleUploadImage = async () => {
    if (!imagePreview || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/social/rooms/${roomId}/topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicType: "IMAGE",
          imageUrl: imagePreview,
          title: imageTitle.trim() || "Uploaded Reviewer Material",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onTopicUpdated(data.topic);
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to upload topic image");
      }
    } catch (err) {
      console.error("Failed to upload image topic:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* MODAL HEADER */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📖</span>
              <h3 className="text-lg font-black text-white">Present Study Topic</h3>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                Host Control
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Select a question from the question bank or upload an image to discuss with room participants.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* TABS SELECTOR */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("QUESTION_BANK")}
            className={`pb-3 px-4 text-xs font-extrabold transition border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === "QUESTION_BANK"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>📚</span>
            <span>CSC Question Bank</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("UPLOAD_IMAGE")}
            className={`pb-3 px-4 text-xs font-extrabold transition border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === "UPLOAD_IMAGE"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🖼️</span>
            <span>Upload Topic Image</span>
          </button>
        </div>

        {/* TAB 1: QUESTION BANK */}
        {activeTab === "QUESTION_BANK" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* SEARCH & CATEGORY BAR */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              {/* Category Dropdown */}
              <div className="w-full sm:w-64">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === "All" ? "All Subjects" : cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Box */}
              <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-auto flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Search question keywords or subtopics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer transition"
                >
                  Search
                </button>
              </form>
            </div>

            {/* TWO-PANE VIEW: QUESTION LIST & LIVE PREVIEW */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* QUESTIONS LIST */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 space-y-2 h-[340px] overflow-y-auto pr-1">
                {loadingQuestions ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 animate-pulse">
                    Loading questions from bank...
                  </div>
                ) : questions.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 italic p-4 text-center">
                    No questions found matching your filter or search query.
                  </div>
                ) : (
                  questions.map((q) => {
                    const isSelected = selectedQuestion?.id === q.id;
                    return (
                      <div
                        key={q.id}
                        onClick={() => setSelectedQuestion(q)}
                        className={`p-3 rounded-xl border transition cursor-pointer space-y-1.5 ${
                          isSelected
                            ? "bg-blue-600/20 border-blue-500 text-white shadow-md"
                            : "bg-slate-900/80 border-slate-800/80 hover:border-slate-700 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-extrabold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 truncate max-w-[140px]">
                            {q.category}
                          </span>
                          <span className="text-slate-500 truncate max-w-[120px]">{q.subtopic || "General"}</span>
                        </div>
                        <p className="text-xs line-clamp-2 leading-relaxed font-medium">{q.prompt}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* LIVE PREVIEW PANE */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between h-[340px] overflow-y-auto">
                {selectedQuestion ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                        Question Preview
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {selectedQuestion.category} &bull; {selectedQuestion.subtopic}
                      </span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-semibold text-white leading-relaxed max-h-[140px] overflow-y-auto">
                      {selectedQuestion.prompt}
                    </div>

                    {/* OPTIONS PREVIEW */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Answer Choices
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                        {selectedQuestion.options?.map((opt: string, idx: number) => {
                          const letters = ["A", "B", "C", "D", "E"];
                          return (
                            <div
                              key={idx}
                              className="px-2.5 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-slate-300 flex items-start gap-1.5 text-[11px]"
                            >
                              <span className="font-black text-blue-400">{letters[idx] || `${idx + 1}`}.</span>
                              <span className="truncate">{opt}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                    <span className="text-3xl opacity-40">👆</span>
                    <p className="text-xs">Click on any question from the list on the left to preview it here.</p>
                  </div>
                )}

                {selectedQuestion && (
                  <div className="pt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleSelectQuestion}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span>📌</span>
                      <span>{submitting ? "Setting Topic..." : "Set as Active Room Topic"}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                <span>
                  Showing page {page} of {totalPages} ({totalCount} total items)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-white font-bold transition cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-white font-bold transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UPLOAD TOPIC IMAGE */}
        {activeTab === "UPLOAD_IMAGE" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {uploadError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <span>⚠️</span>
                <span>{uploadError}</span>
              </div>
            )}

            <div className="space-y-4 max-w-xl mx-auto">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Topic Material Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Reviewer Problem 4 - Ratio & Proportion Diagram"
                  value={imageTitle}
                  onChange={(e) => setImageTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* IMAGE DROPZONE / SELECTOR */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-950/40 hover:bg-slate-950/80 min-h-[220px]"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                />

                {imagePreview ? (
                  <div className="space-y-3 w-full">
                    <img
                      src={imagePreview}
                      alt="Uploaded preview"
                      className="max-h-48 mx-auto rounded-xl object-contain border border-slate-800 shadow-md"
                    />
                    <p className="text-[11px] text-blue-400 font-bold">
                      Click to choose a different image ({imageFile?.name})
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-4xl block">🖼️</span>
                    <p className="text-xs font-extrabold text-white">Click or drag & drop reviewer image here</p>
                    <p className="text-[10px] text-slate-400">
                      Supports PNG, JPEG, WebP, or GIF (Maximum file size: 5MB)
                    </p>
                  </div>
                )}
              </div>

              {/* ACTION BUTTON */}
              <button
                type="button"
                disabled={!imagePreview || submitting}
                onClick={handleUploadImage}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>🚀</span>
                <span>{submitting ? "Uploading Image..." : "Upload & Present Image to Room"}</span>
              </button>
            </div>
          </div>
        )}

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer border border-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
