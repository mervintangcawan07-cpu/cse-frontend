"use client";

import { useState } from "react";
import Link from "next/link";

interface DocumentItem {
  id: string;
  title: string;
  category: string;
  description: string;
  pages: string;
  lastUpdated: string;
  pdfUrl: string;
}

const documentsList: DocumentItem[] = [
  {
    id: "doc-1",
    title: "1987 Philippine Constitution (Selected Articles)",
    category: "Constitutional Basis",
    description: "Full text of Article III (Bill of Rights), Article V (Suffrage), and Article XI (Accountability of Public Officers).",
    pages: "18 Pages",
    lastUpdated: "Official CSE Ref",
    pdfUrl: "https://www.officialgazette.gov.ph/downloads/1987/02feb/19870202-Constitution-BSA.pdf",
  },
  {
    id: "doc-2",
    title: "Republic Act No. 6713 — Code of Conduct",
    category: "Ethical Standards",
    description: "Code of Conduct and Ethical Standards for Public Officials and Employees with implementing rules and regulations.",
    pages: "12 Pages",
    lastUpdated: "Civil Service Code",
    pdfUrl: "https://www.csc.gov.ph/phocadownload/RA6713.pdf",
  },
  {
    id: "doc-3",
    title: "CSC Omnibus Rules on Appointments & Personnel Actions",
    category: "Civil Service Rules",
    description: "Revised 2018 Omnibus Rules on Appointments and other Human Resource Actions in the Civil Service.",
    pages: "45 Pages",
    lastUpdated: "CSC Memorandum",
    pdfUrl: "https://www.csc.gov.ph/phocadownload/userupload/oraohra.pdf",
  },
  {
    id: "doc-4",
    title: "General Information & Current Events Digest",
    category: "General Knowledge",
    description: "Comprehensive summary of environmental laws, ASEAN awareness, and national government structure.",
    pages: "24 Pages",
    lastUpdated: "2026 Edition",
    pdfUrl: "https://www.officialgazette.gov.ph/downloads/1987/02feb/19870202-Constitution-BSA.pdf",
  },
];

export default function ReadingMaterialsPage() {
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem>(documentsList[0]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");

  const categories = ["All", "Constitutional Basis", "Ethical Standards", "Civil Service Rules", "General Knowledge"];

  const filteredDocs = documentsList.filter((doc) => {
    const matchesCategory = selectedCategory === "All" || doc.category === selectedCategory;
    const matchesSearch =
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-6 select-none" onContextMenu={(e) => e.preventDefault()}>
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
              Read-Only Repository
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold mt-2">Official Reading Materials & Handbooks</h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Read civil service handbooks and reference documents directly in your browser.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition border border-slate-700 shrink-0"
        >
          &larr; Dashboard
        </Link>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar: Document List */}
        <div className="lg:col-span-5 space-y-4">
          {/* Search & Category Filter */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <input
              type="text"
              placeholder="Search handbooks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-500 transition"
            />

            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    selectedCategory === cat
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Document List Stack */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredDocs.map((doc) => {
              const isSelected = selectedDoc.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`p-5 rounded-2xl border text-left cursor-pointer transition space-y-2 ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/60 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {doc.category}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">{doc.pages}</span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-sm leading-snug">{doc.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{doc.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Embedded PDF Viewer */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[750px]">
          {/* Document Title Header Bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center gap-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-blue-600">{selectedDoc.category}</span>
              <h2 className="text-base font-extrabold text-slate-800 line-clamp-1">{selectedDoc.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold rounded-lg flex items-center gap-1 shrink-0">
                <span>🔒</span>
                <span>View Only</span>
              </span>
            </div>
          </div>

          {/* Secure Embedded Viewer */}
          <div className="relative flex-1 bg-slate-100">
            <iframe
              src={`${selectedDoc.pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              className="w-full h-full border-none"
              title={selectedDoc.title}
            />

            {/* Protective Overlay Banner to discourage downloading */}
            <div className="absolute top-0 right-0 left-0 p-2 bg-slate-900/90 text-slate-300 text-[11px] font-medium text-center backdrop-blur-sm pointer-events-none">
              Official Civil Service Reviewer • Protected Read-Only View Mode
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}