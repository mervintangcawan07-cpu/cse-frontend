"use client";

import { useState } from "react";
import Link from "next/link";

interface StudyNote {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: string[];
  tips?: string;
}

const studyNotes: StudyNote[] = [
  {
    id: "verbal-1",
    category: "Verbal Ability",
    title: "Subject-Verb Agreement Rules",
    summary: "Essential grammar rules frequently tested in CSE Verbal Ability.",
    content: [
      "1. Singular subjects take singular verbs (e.g., 'The list of items is on the desk').",
      "2. Words connected by 'and' usually take a plural verb unless they form a single idea (e.g., 'Bread and butter is my favorite breakfast').",
      "3. Expressions like 'along with', 'as well as', and 'in addition to' do not change the number of the subject (e.g., 'The teacher, along with the students, was present').",
      "4. 'Either/Or' and 'Neither/Nor': The verb agrees with the subject closest to it (e.g., 'Neither the manager nor the employees were informed').",
      "5. Collective nouns (team, committee, audience) take singular verbs when acting as a unit.",
    ],
    tips: "Always identify the true subject of the sentence by ignoring prepositional phrases in between.",
  },
  {
    id: "numerical-1",
    category: "Numerical Reasoning",
    title: "Percentage, Rate, and Base Formulas",
    summary: "Quick reference formulas for word problems involving ratios and percentages.",
    content: [
      "• Percentage (P) = Rate (R) × Base (B)",
      "• Percentage Increase = [(New Value - Old Value) / Old Value] × 100%",
      "• Work Formula: Rate × Time = Work Done (W = R × T)",
      "• Combined Work Rate: (1 / A) + (1 / B) = 1 / Total Time",
      "• Simple Interest: I = P × R × T (Principal × Rate × Time)",
    ],
    tips: "Convert percentages to fractions or decimals immediately to speed up calculations without a calculator.",
  },
  {
    id: "general-1",
    category: "General Information",
    title: "Philippine Constitution & R.A. 6713 Highlights",
    summary: "Key concepts on civil service ethical standards and constitutional rights.",
    content: [
      "1. R.A. 6713: Code of Conduct and Ethical Standards for Public Officials and Employees.",
      "2. 8 Norms of Conduct: Commitment to public interest, Professionalism, Justness and sincerity, Political neutrality, Responsiveness to the public, Nationalism and patriotism, Commitment to democracy, Simple living.",
      "3. Article III (Bill of Rights): Due process, equal protection, protection against illegal searches.",
      "4. Article XI (Accountability of Public Officers): Public office is a public trust.",
    ],
    tips: "R.A. 6713 questions often focus on prohibited transactions and mandatory submission of SALN (Statement of Assets, Liabilities, and Net Worth).",
  },
  {
    id: "analytical-1",
    category: "Analytical Reasoning",
    title: "Logical Fallacies & Syllogism Cheat Sheet",
    summary: "How to break down logical statements and spot deduction errors.",
    content: [
      "• All A are B, All B are C ➔ All A are C (Valid Syllogism).",
      "• Ad Hominem: Attacking the person's character instead of addressing their argument.",
      "• Straw Man: Misrepresenting someone's argument to make it easier to attack.",
      "• Post Hoc Ergo Propter Hoc: Assuming that because B came after A, A caused B.",
    ],
    tips: "Use simple Venn diagrams on scratch paper to solve complex logical grouping problems.",
  },
];

export default function ReviewerPage() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "Verbal Ability", "Numerical Reasoning", "General Information", "Analytical Reasoning"];

  const filteredNotes =
    selectedCategory === "All"
      ? studyNotes
      : studyNotes.filter((note) => note.category === selectedCategory);

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-8 rounded-3xl shadow-md">
        <div>
          <h1 className="text-3xl font-extrabold">Study Notes & Reviewer</h1>
          <p className="text-slate-400 text-sm mt-1">
            Read core principles, formulas, and cheat sheets before taking your practice exams.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition border border-slate-700"
        >
          &larr; Dashboard
        </Link>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-2 pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              selectedCategory === cat
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Notes Cards */}
      <div className="space-y-6">
        {filteredNotes.map((note) => (
          <div
            key={note.id}
            className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4"
          >
            <div className="flex justify-between items-start gap-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md">
                  {note.category}
                </span>
                <h2 className="text-xl font-extrabold text-slate-800 mt-3">{note.title}</h2>
                <p className="text-slate-500 text-xs mt-0.5">{note.summary}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-2 text-sm text-slate-700">
              {note.content.map((line, idx) => (
                <p key={idx} className="leading-relaxed font-medium">
                  {line}
                </p>
              ))}
            </div>

            {note.tips && (
              <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-xs text-indigo-900 flex items-start gap-2.5">
                <span className="text-base">💡</span>
                <div>
                  <span className="font-extrabold">Exam Pro-Tip: </span>
                  {note.tips}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}