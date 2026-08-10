"use client";

import React, { useState } from "react";
import { CoreSubject, DifficultyLevel, StudyTogetherEvent } from "@/types/cse";
import { CORE_SUBJECTS, DIFFICULTY_LEVELS } from "./CategoryTagging";

interface StudyTogetherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateEvent: (event: Omit<StudyTogetherEvent, "id" | "participantsCount">) => void;
}

export const StudyTogetherModal: React.FC<StudyTogetherModalProps> = ({
  isOpen,
  onClose,
  onCreateEvent,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<CoreSubject[]>(["Numerical Reasoning"]);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("Intermediate Drill");
  const [itemCount, setItemCount] = useState<number>(20);
  const [quizDurationMinutes, setQuizDurationMinutes] = useState<number>(15);
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [activeDurationHours, setActiveDurationHours] = useState<number>(12);

  if (!isOpen) return null;

  const toggleCategory = (cat: CoreSubject) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length > 1) {
        setSelectedCategories(selectedCategories.filter((c) => c !== cat));
      }
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateEvent({
      title: title || "Live Study Together Session",
      description: description || "Synchronous group review with balanced question distribution.",
      categories: selectedCategories,
      difficulty,
      itemCount,
      quizDurationMinutes,
      scheduledStartTime: scheduledStartTime
        ? new Date(scheduledStartTime).toISOString()
        : new Date().toISOString(),
      activeDurationHours,
      hostName: "System Admin",
      hostUserId: "host-1",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-lg font-black text-slate-900 dark:text-white">Schedule Study Together Event</h3>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Event Title</label>
          <input
            type="text"
            required
            placeholder="e.g., Weekend Numerical & Verbal Masterclass"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Core Subjects (Multi-Select)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CORE_SUBJECTS.map((cat) => {
              const isSelected = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Difficulty Badge</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
            >
              {DIFFICULTY_LEVELS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Event Start Time</label>
            <input
              type="datetime-local"
              required
              value={scheduledStartTime}
              onChange={(e) => setScheduledStartTime(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Item Count</label>
            <select
              value={itemCount}
              onChange={(e) => setItemCount(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
            >
              <option value={10}>10 Items</option>
              <option value={20}>20 Items</option>
              <option value={30}>30 Items</option>
              <option value={50}>50 Items</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Quiz Timer</label>
            <select
              value={quizDurationMinutes}
              onChange={(e) => setQuizDurationMinutes(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
            >
              <option value={10}>10 Mins</option>
              <option value={15}>15 Mins</option>
              <option value={30}>30 Mins</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Active Window</label>
            <select
              value={activeDurationHours}
              onChange={(e) => setActiveDurationHours(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
            >
              <option value={2}>2 Hours</option>
              <option value={12}>12 Hours</option>
              <option value={24}>24 Hours</option>
            </select>
          </div>
        </div>

        {/* Calculated End Time Live Preview */}
        {scheduledStartTime && (
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-950 dark:text-blue-200 flex items-center justify-between">
            <span>?? Event Official End Time:</span>
            <span className="font-mono font-bold">
              {new Date(
                new Date(scheduledStartTime).getTime() + activeDurationHours * 3600 * 1000
              ).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 text-white hover:bg-blue-500 shadow-md"
          >
            Schedule Event
          </button>
        </div>
      </form>
    </div>
  );
};
