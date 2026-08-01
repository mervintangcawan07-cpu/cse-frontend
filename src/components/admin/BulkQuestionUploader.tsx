"use client";

import { useState } from "react";
import Papa from "papaparse";
import { downloadCSVTemplate } from "@/lib/csvParser";

interface BulkUploaderProps {
  onSuccess?: () => void;
}

export default function BulkQuestionUploader({ onSuccess }: BulkUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      const text = await file.text();
      let questionsToImport: any[] = [];

      if (file.name.endsWith(".json")) {
        questionsToImport = JSON.parse(text);
      } else if (file.name.endsWith(".csv")) {
        const parsed = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
        });

        // Helper to extract field values case-insensitively
        const getVal = (item: any, possibleKeys: string[]) => {
          const keys = Object.keys(item);
          for (const target of possibleKeys) {
            const k = keys.find((key) => key.trim().toLowerCase() === target.toLowerCase());
            if (k && item[k] !== undefined && item[k] !== null) {
              const strVal = String(item[k]).trim();
              if (strVal !== "") return strVal;
            }
          }
          return "";
        };

        questionsToImport = parsed.data
          .map((item: any) => {
            const category = getVal(item, ["category", "subject"]) || "General";
            const subtopic = getVal(item, ["subtopic", "sub_topic", "subTopic", "topic"]) || "General";
            const prompt = getVal(item, ["prompt", "question"]);
            const explanation = getVal(item, ["explanation", "solution"]) || null;
            const imageUrl = getVal(item, ["imageUrl", "image_url", "image"]) || null;

            const optA = getVal(item, ["optionA", "option_a", "choiceA", "a"]);
            const optB = getVal(item, ["optionB", "option_b", "choiceB", "b"]);
            const optC = getVal(item, ["optionC", "option_c", "choiceC", "c"]);
            const optD = getVal(item, ["optionD", "option_d", "choiceD", "d"]);

            let options: string[] = [];
            if (Array.isArray(item.options) && item.options.length > 0) {
              options = item.options.map((o: any) => String(o).trim());
            } else {
              options = [optA, optB, optC, optD].filter(Boolean);
            }

            let answerIndex = 0;
            const rawAns = getVal(item, ["answerIndex", "correctAnswer", "answer_index", "correct_answer"]);
            if (rawAns !== "") {
              const parsedIdx = parseInt(rawAns, 10);
              answerIndex = isNaN(parsedIdx) ? 0 : parsedIdx;
            }

            return {
              category,
              subtopic,
              prompt,
              options,
              optionA: optA || (options[0] ?? null),
              optionB: optB || (options[1] ?? null),
              optionC: optC || (options[2] ?? null),
              optionD: optD || (options[3] ?? null),
              answerIndex,
              explanation,
              imageUrl,
            };
          })
          .filter((q: any) => q.prompt && q.category && q.options.length >= 2);
      } else {
        throw new Error("Unsupported file format. Please upload a .csv or .json file.");
      }

      if (questionsToImport.length === 0) {
        throw new Error("No valid questions found in file.");
      }

      // Submit parsed questions to API
      const res = await fetch("/api/admin/questions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: questionsToImport }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const count = data.importedCount || data.count || questionsToImport.length;
        setStatusMessage({
          type: "success",
          text: `Successfully imported ${count} question(s) into the database!`,
        });
        if (onSuccess) onSuccess();
      } else {
        setStatusMessage({
          type: "error",
          text: data.error || "Failed to import questions.",
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error reading file";
      setStatusMessage({
        type: "error",
        text: errorMessage,
      });
    } finally {
      setLoading(false);
      e.target.value = ""; // Reset file input
    }
  };

  return (
    <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
            Admin Content Tools
          </span>
          <h2 className="text-lg font-black mt-1">Bulk Question Importer</h2>
          <p className="text-xs text-slate-400">Upload multiple questions at once using CSV or JSON.</p>
        </div>

        <button
          onClick={downloadCSVTemplate}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
        >
          📥 Download CSV Template
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <label className="w-full sm:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer transition text-center shadow-md">
          <span>{loading ? "Parsing & Uploading..." : "📁 Choose .CSV or .JSON File"}</span>
          <input
            type="file"
            accept=".csv, .json"
            onChange={handleFileChange}
            disabled={loading}
            className="hidden"
          />
        </label>

        <span className="text-[11px] text-slate-500">Supported formats: .CSV, .JSON (Max 500 items per batch)</span>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "bg-red-500/10 text-red-400 border border-red-500/30"
          }`}
        >
          {statusMessage.text}
        </div>
      )}
    </div>
  );
}