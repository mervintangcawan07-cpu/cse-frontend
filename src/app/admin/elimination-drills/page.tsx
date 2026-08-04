"use client";

import { useState, useEffect, ChangeEvent } from "react";
import Link from "next/link";

interface DrillItem {
  id: string;
  category: string;
  subtopic: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
  createdAt: string;
}

const SAMPLE_CSV = `Question,Option A,Option B,Option C,Option D,Correct Answer,Explanation,Elimination A,Elimination B,Elimination C,Elimination D,Category,Tags
"What is 15% of 300?",45,"3,000",-15,90,A,"15% of 300 = 0.15 * 300 = 45.","Correct choice; 0.15 * 300 = 45.","3000 is larger than 300.",-15 is negative.,90 is 30% of 300.,Numerical Ability,Percentages
"Which word is an antonym for 'BENEVOLENT'?",Kind,Malevolent,Generous,Helpful,B,"Benevolent means kind; malevolent means wishing evil.",Kind is a synonym.,Correct choice; malevolent means wishing evil.,Generous is a positive synonym.,Helpful is a positive synonym.,Verbal Ability,Antonyms`;

export default function AdminEliminationDrillsPage() {
  const [uploadMode, setUploadMode] = useState<"CSV_FILE" | "CSV_PASTE" | "JSON">("CSV_FILE");
  const [inputText, setInputText] = useState("");
  const [existingDrills, setExistingDrills] = useState<DrillItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchDrills();
  }, []);

  const fetchDrills = async () => {
    try {
      const res = await fetch("/api/admin/elimination-drills");
      const data = await res.json();
      if (res.ok && data.drills) {
        setExistingDrills(data.drills);
        setSelectedIds([]);
      }
    } catch (e) {
      console.error("Failed to load existing drills:", e);
    } finally {
      setLoading(false);
    }
  };

  // CSV Parsing Utility supporting flexible headers (Question, Option A-D, Correct Answer, Elimination A-D, Category, Tags)
  const parseCSV = (csvText: string) => {
    const lines = csvText.split(/\r?\n/).filter((line: string) => line.trim() !== "");
    if (lines.length < 2) throw new Error("CSV must contain a header row and at least 1 question row.");

    const parseRow = (row: string): string[] => {
      const result: string[] = [];
      let insideQuotes = false;
      let currentVal = "";

      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === "," && !insideQuotes) {
          result.push(currentVal.trim());
          currentVal = "";
        } else {
          currentVal += char;
        }
      }
      result.push(currentVal.trim());
      return result;
    };

    const headers: string[] = parseRow(lines[0]).map((h: string) => h.toLowerCase());
    const questions: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols: string[] = parseRow(lines[i]);
      if (cols.length < 4) continue;

      const getCol = (...keyNames: string[]): string => {
        for (const key of keyNames) {
          const idx = headers.findIndex((h: string) => h.trim().toLowerCase() === key.toLowerCase() || h.includes(key.toLowerCase()));
          if (idx !== -1 && cols[idx]) return cols[idx];
        }
        return "";
      };

      const category = getCol("category") || "Elimination Drill";
      const subtopic = getCol("tags", "subtopic") || "General";
      const prompt = getCol("question", "prompt");
      const optA = getCol("option a", "choice a") || cols[1] || "";
      const optB = getCol("option b", "choice b") || cols[2] || "";
      const optC = getCol("option c", "choice c") || cols[3] || "";
      const optD = getCol("option d", "choice d") || cols[4] || "";
      const correctRaw = getCol("correct answer", "answer index", "answer") || "A";
      const explanation = getCol("explanation") || "";

      const eliminationA = getCol("elimination a");
      const eliminationB = getCol("elimination b");
      const eliminationC = getCol("elimination c");
      const eliminationD = getCol("elimination d");

      if (!prompt) continue;

      // Resolve Answer Index (Letter A/B/C/D or numeric 0/1/2/3)
      let answerIndex = 0;
      const ansClean = correctRaw.trim().toUpperCase();
      if (ansClean === "A" || ansClean === "0") answerIndex = 0;
      else if (ansClean === "B" || ansClean === "1") answerIndex = 1;
      else if (ansClean === "C" || ansClean === "2") answerIndex = 2;
      else if (ansClean === "D" || ansClean === "3") answerIndex = 3;

      const options = [optA, optB, optC, optD].filter(Boolean);

      questions.push({
        category,
        subtopic,
        prompt,
        options,
        answerIndex,
        explanation,
        eliminationA,
        eliminationB,
        eliminationC,
        eliminationD,
      });
    }

    return questions;
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const text = event.target?.result as string;
      setInputText(text);
    };
    reader.readAsText(file);
  };

  const handleUploadSubmit = async () => {
    setMessage(null);
    if (!inputText.trim()) {
      setMessage({ type: "error", text: "Please select a file or paste data before submitting." });
      return;
    }

    let questionsToSubmit: any[] = [];

    try {
      if (uploadMode === "JSON") {
        questionsToSubmit = JSON.parse(inputText);
        if (!Array.isArray(questionsToSubmit)) {
          throw new Error("JSON payload must be an array of objects `[...]`");
        }
      } else {
        questionsToSubmit = parseCSV(inputText);
      }

      if (questionsToSubmit.length === 0) {
        throw new Error("No valid questions were extracted. Please check formatting.");
      }
    } catch (err: any) {
      setMessage({ type: "error", text: `Parsing Error: ${err.message}` });
      return;
    }

    setUploading(true);
    try {
      const res = await fetch("/api/admin/elimination-drills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: questionsToSubmit }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({
          type: "success",
          text: `🎉 Imported ${data.insertedCount} Elimination Drill questions directly into your database!`,
        });
        setInputText("");
        fetchDrills();
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to batch upload questions.",
        });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Network error submitting drill payload." });
    } finally {
      setUploading(false);
    }
  };

  // 🗑 DELETE SINGLE QUESTION
  const handleDeleteSingle = async (id: string) => {
    if (!confirm("Are you sure you want to delete this drill question?")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/elimination-drills?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: "success", text: "✓ Question deleted successfully." });
        fetchDrills();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to delete question." });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Error deleting question." });
    } finally {
      setDeleting(false);
    }
  };

  // 🗑 BULK DELETE SELECTED QUESTIONS
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected question(s)?`)) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/admin/elimination-drills", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: "success", text: `✓ Successfully deleted ${data.deletedCount} question(s).` });
        fetchDrills();
      } else {
        setMessage({ type: "error", text: data.error || "Bulk delete failed." });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Error performing bulk delete." });
    } finally {
      setDeleting(false);
    }
  };

  // 🗑 DELETE ALL DRILLS
  const handleDeleteAll = async () => {
    if (!confirm("⚠️ WARNING: This will permanently delete ALL Elimination Drill questions from the database. Proceed?")) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/admin/elimination-drills?all=true", {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: "success", text: `✓ Deleted all ${data.deletedCount} drill questions.` });
        fetchDrills();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to clear drills." });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Error clearing drills." });
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === existingDrills.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(existingDrills.map((d) => d.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDownloadSampleCSV = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "elimination_drills_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8 text-slate-100">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
            Admin Management Console
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-white mt-2">
            Elimination Drill Bulk Uploader
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Upload CSV spreadsheets directly with Question, Options A–D, Correct Answer (A/B/C/D), and Distractor Eliminations A–D.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadSampleCSV}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl transition border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <span>📥 Download Sample CSV</span>
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 shrink-0"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* UPLOAD CONTAINER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
        {/* MODE TABS */}
        <div className="flex border-b border-slate-800 gap-2">
          <button
            onClick={() => setUploadMode("CSV_FILE")}
            className={`pb-3 px-4 font-bold text-xs transition border-b-2 cursor-pointer ${
              uploadMode === "CSV_FILE"
                ? "border-emerald-500 text-emerald-400 font-black"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📁 Upload .CSV File
          </button>
          <button
            onClick={() => setUploadMode("CSV_PASTE")}
            className={`pb-3 px-4 font-bold text-xs transition border-b-2 cursor-pointer ${
              uploadMode === "CSV_PASTE"
                ? "border-emerald-500 text-emerald-400 font-black"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📋 Paste CSV Text
          </button>
          <button
            onClick={() => setUploadMode("JSON")}
            className={`pb-3 px-4 font-bold text-xs transition border-b-2 cursor-pointer ${
              uploadMode === "JSON"
                ? "border-blue-500 text-blue-400 font-black"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {`{ }`} Paste JSON Array
          </button>
        </div>

        {/* CSV FILE MODE */}
        {uploadMode === "CSV_FILE" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-3xl p-8 text-center bg-slate-950/50 transition">
              <span className="text-4xl block mb-2">📊</span>
              <p className="text-sm font-bold text-white">Select a .CSV File from your Computer</p>
              <p className="text-xs text-slate-400 mt-1">Exported from Google Sheets or Excel</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="mt-4 block mx-auto text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 file:cursor-pointer cursor-pointer"
              />
            </div>
            {inputText && (
              <p className="text-xs text-emerald-400 font-bold">
                ✓ File loaded into memory. Click submit to process.
              </p>
            )}
          </div>
        )}

        {/* TEXTAREA MODE */}
        {(uploadMode === "CSV_PASTE" || uploadMode === "JSON") && (
          <textarea
            value={inputText}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInputText(e.target.value)}
            placeholder={
              uploadMode === "CSV_PASTE"
                ? 'Question,Option A,Option B,Option C,Option D,Correct Answer,Explanation,Elimination A,Elimination B,Elimination C,Elimination D,Category,Tags\n"What is 15% of 300?",45,"3,000",-15,90,A,"15% of 300 = 45.","Correct choice.",3000 is larger.,-15 is negative.,90 is 30%.,Numerical Ability,Percentages'
                : '[\n  {\n    "question": "What is 15% of 300?",\n    "optionA": "45",\n    "optionB": "3,000",\n    "optionC": "-15",\n    "optionD": "90",\n    "correctAnswer": "A",\n    "explanation": "15% of 300 = 45."\n  }\n]'
            }
            rows={10}
            className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 transition"
          />
        )}

        {message && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold ${
              message.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          onClick={handleUploadSubmit}
          disabled={uploading || !inputText.trim()}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-sm rounded-2xl transition shadow-lg cursor-pointer"
        >
          {uploading ? "Uploading Questions to Database..." : "⚡ Save & Add to Live Drill Pool"}
        </button>
      </div>

      {/* LIVE POOL TABLE WITH BULK DELETE */}
      <div className="space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <span>📚</span>
            <span>Live Elimination Drill Question Bank ({existingDrills.length})</span>
          </h2>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl transition cursor-pointer shadow-md"
              >
                🗑 Delete Selected ({selectedIds.length})
              </button>
            )}

            {existingDrills.length > 0 && (
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/50 text-xs font-bold text-rose-300 rounded-xl transition border border-rose-500/30 cursor-pointer"
              >
                ⚠️ Delete All Drills
              </button>
            )}

            <button
              onClick={fetchDrills}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl transition cursor-pointer"
            >
              🔄 Refresh List
            </button>
          </div>
        </div>

        {/* SELECT ALL HEADER CONTROL */}
        {existingDrills.length > 0 && (
          <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.length === existingDrills.length && existingDrills.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
              />
              <span>Select All ({existingDrills.length})</span>
            </label>
            <span>{selectedIds.length} selected</span>
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400 font-bold animate-pulse">
            Loading current question bank...
          </div>
        ) : existingDrills.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
            No elimination drill items found in database. Upload a CSV file above to populate!
          </div>
        ) : (
          <div className="space-y-3">
            {existingDrills.map((drill: DrillItem, idx: number) => (
              <div
                key={drill.id || idx}
                className={`bg-slate-900 border rounded-2xl p-5 space-y-3 transition ${
                  selectedIds.includes(drill.id) ? "border-emerald-500/60 bg-emerald-950/10" : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(drill.id)}
                      onChange={() => toggleSelect(drill.id)}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer mt-0.5"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black px-2.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-md border border-blue-500/30">
                        {drill.category}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {drill.subtopic}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteSingle(drill.id)}
                    disabled={deleting}
                    className="p-1.5 bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-300 rounded-lg transition text-xs cursor-pointer shrink-0"
                    title="Delete Question"
                  >
                    🗑
                  </button>
                </div>

                <p className="text-sm font-bold text-white pl-7">{drill.prompt}</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-7 pt-1">
                  {drill.options.map((opt: string, oIdx: number) => (
                    <div
                      key={oIdx}
                      className={`p-2 rounded-xl border text-[11px] font-medium ${
                        oIdx === drill.answerIndex
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      <span>{String.fromCharCode(65 + oIdx)}. {opt}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}