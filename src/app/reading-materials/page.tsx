"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PassageScanner from "@/components/PassageScanner";

interface DocumentItem {
  id: string;
  title: string;
  category: string;
  description: string;
  pages: string;
  fileName: string;
}

export default function ReadingMaterialsPage() {
  const [documentsList, setDocumentsList] = useState<DocumentItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");

  const categories = ["All", "Constitutional Basis", "Ethical Standards", "Civil Service Rules", "General Knowledge"];

  useEffect(() => {
    const controller = new AbortController();

    async function fetchHandbooks() {
      try {
        const response = await fetch("/api/reading-materials", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load reading materials (${response.status})`);
        }

        const data: { handbooks?: DocumentItem[] } = await response.json();

        if (data.handbooks) {
          setDocumentsList(data.handbooks);

          if (data.handbooks.length > 0) {
            setSelectedDoc(data.handbooks[0]);
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error(error);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchHandbooks();

    return () => controller.abort();
  }, []);

  const filteredDocs = documentsList.filter((doc) => {
    const matchesCategory = selectedCategory === "All" || doc.category === selectedCategory;
    const matchesSearch =
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full px-0 py-2 sm:px-3 sm:py-4 lg:px-6 select-none" onContextMenu={(e) => e.preventDefault()}>
      <div className="bg-white rounded-none border-x-0 sm:rounded-2xl sm:border lg:rounded-3xl border-slate-200/90 shadow-md overflow-hidden">
        {/* Top Header - Seamlessly integrated */}
        <div className="bg-slate-900 text-white p-4 sm:p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
              Read-Only Repository • Fast Scanner Active
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-2">Official Reading Materials & Handbooks</h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1">
              Read civil service handbooks directly in your browser with automatic keyword scanning.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition border border-slate-700 shrink-0"
          >
            &larr; Dashboard
          </Link>
        </div>

        {/* Content Section Inside Unified Frame */}
        <div className="p-3.5 sm:p-6 md:p-8 bg-slate-50/60">
          {loading ? (
            <div className="py-20 text-center font-bold text-slate-400 animate-pulse">Loading handbooks library...</div>
          ) : documentsList.length === 0 ? (
            <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center text-slate-400 text-sm">
              No handbooks uploaded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
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
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredDocs.map((doc) => {
                    const isSelected = selectedDoc?.id === doc.id;
                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDoc(doc)}
                        className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-2.5 ${
                          isSelected
                            ? "bg-blue-50/80 border-blue-500 shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                              {doc.category}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{doc.pages}</span>
                          </div>
                          <h3 className="font-extrabold text-slate-800 text-sm mt-1">{doc.title}</h3>
                          {/* 🔍 Fast-Scanner on description */}
                          <div className="text-xs text-slate-500 leading-relaxed bg-slate-900 p-3 rounded-xl border border-slate-800 mt-2">
                            <PassageScanner text={doc.description} />
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs font-bold text-blue-600">
                          <span>{isSelected ? "📖 Now Reading" : "Read Material"}</span>
                          <span>&rarr;</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PDF VIEWER CONTAINER */}
              <div className="lg:col-span-7 bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[750px]">
                {selectedDoc ? (
                  <>
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center gap-4">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-blue-600">{selectedDoc.category}</span>
                        <h2 className="text-base font-extrabold text-slate-800 line-clamp-1">{selectedDoc.title}</h2>
                      </div>
                      <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold rounded-lg shrink-0">
                        🔒 Protected View
                      </span>
                    </div>

                    <div className="relative flex-1 bg-slate-100">
                      <iframe
                        src={`/api/reading-materials/file?id=${selectedDoc.id}#toolbar=0&navpanes=0&scrollbar=1`}
                        className="w-full h-full border-none"
                        title={selectedDoc.title}
                      />
                      <div className="absolute top-0 right-0 left-0 p-2 bg-slate-900/90 text-slate-300 text-[11px] font-medium text-center backdrop-blur-sm pointer-events-none">
                        Official Civil Service Reviewer • Protected Read-Only View Mode
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-12 text-center text-slate-400">Select a handbook to view.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
