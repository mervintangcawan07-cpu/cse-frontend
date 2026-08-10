"use client";

import React from "react";
import { CoreSubject, DifficultyLevel } from "@/types/cse";

interface CategoryTaggingProps {
  selectedSubject?: CoreSubject | "All";
  selectedDifficulty?: DifficultyLevel | "All";
  onSelectSubject?: (subject: CoreSubject | "All") => void;
  onSelectDifficulty?: (difficulty: DifficultyLevel | "All") => void;
}

export const CORE_SUBJECTS: CoreSubject[] = [
  "Numerical Reasoning",
  "Verbal Ability",
  "Analytical Reasoning",
  "General Information & PH Constitution",
  "Clerical Ability",
];

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  "Basic Fundamentals",
  "Intermediate Drill",
  "Hard/Speed Test",
];

export function getDifficultyBadgeStyle(difficulty: DifficultyLevel): string {
  switch (difficulty) {
    case "Basic Fundamentals":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
    case "Intermediate Drill":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800";
    case "Hard/Speed Test":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800";
    default:
      return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-300";
  }
}

export const CategoryTagging: React.FC<CategoryTaggingProps> = ({
  selectedSubject = "All",
  selectedDifficulty = "All",
  onSelectSubject,
  onSelectDifficulty,
}) => {
  return (
    <div className="space-y-4 my-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
      {/* Core Subject Filters */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Core CSE Subject
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onSelectSubject?.("All")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              selectedSubject === "All"
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            All Categories
          </button>
          {CORE_SUBJECTS.map((subj) => (
            <button
              key={subj}
              onClick={() => onSelectSubject?.(subj)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                selectedSubject === subj
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {subj}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty Filters */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Difficulty Level
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onSelectDifficulty?.("All")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              selectedDifficulty === "All"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 shadow-sm"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            All Difficulties
          </button>
          {DIFFICULTY_LEVELS.map((diff) => (
            <button
              key={diff}
              onClick={() => onSelectDifficulty?.(diff)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${getDifficultyBadgeStyle(
                diff
              )} ${selectedDifficulty === diff ? "ring-2 ring-blue-500 shadow-xs" : ""}`}
            >
              {diff === "Hard/Speed Test" ? "🔥 " : diff === "Intermediate Drill" ? "⚡ " : "🌱 "}
              {diff}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
