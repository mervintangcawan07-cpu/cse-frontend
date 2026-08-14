"use client";

import { useState } from "react";
import Papa from "papaparse";
import { downloadCSVTemplate, validateParsedQuestions } from "@/lib/csvParser";
import QuestionImportPreviewModal from "./QuestionImportPreviewModal";
import { StructuredQuestion } from "@/types/question";

interface BulkUploaderProps {
  onSuccess?: () => void;
}

export default function BulkQuestionUploader({ onSuccess }: BulkUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [parsedValidQuestions, setParsedValidQuestions] = useState<StructuredQuestion[]>([]);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<any[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      const text = await file.text();
      let rawData: any[] = [];

      if (file.name.endsWith(".json")) {
        const json = JSON.parse(text);
        rawData = Array.isArray(json) ? json : json.questions || [json];
      } else if (file.name.endsWith(".csv")) {
        const parsed = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
        });
        rawData = parsed.data;
      } else {
        throw new Error("Unsupported file format. Please upload a .CSV or .JSON file.");
      }

      if (!rawData || rawData.length === 0) {
        throw new Error("The uploaded file contains no data rows.");
      }

      // Run validation engine
      const validation = validateParsedQuestions(rawData);

      setParsedValidQuestions(validation.validQuestions);
      setValidationErrors(validation.errors);
      setValidationWarnings(validation.warnings);
      setPreviewOpen(true);
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

  const handleConfirmImport = async (validQuestions: StructuredQuestion[]) => {
    try {
      const res = await fetch("/api/admin/questions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: validQuestions }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const count = data.importedCount || data.count || validQuestions.length;
        setStatusMessage({
          type: "success",
          text: `Successfully imported ${count} structured question(s) into the Question Bank!`,
        });
        if (onSuccess) onSuccess();
      } else {
        setStatusMessage({
          type: "error",
          text: data.error || "Failed to import questions to the database.",
        });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({
        type: "error",
        text: "Network error occurred while importing questions.",
      });
    }
  };

  return (
    <>
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
              Admin Content Tools
            </span>
            <h2 className="text-lg font-black mt-1">Advanced Bulk Question Importer</h2>
            <p className="text-xs text-slate-400">
              Upload standard or premium reasoning questions with Step-by-Step solutions, Option Analyses, Traps, and Tips.
            </p>
          </div>

          <button
            type="button"
            onClick={downloadCSVTemplate}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
          >
            📥 Download Full CSV Template
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <label className="w-full sm:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer transition text-center shadow-md">
            <span>{loading ? "Validating File..." : "📁 Choose .CSV or .JSON File"}</span>
            <input
              type="file"
              accept=".csv, .json"
              onChange={handleFileChange}
              disabled={loading}
              className="hidden"
            />
          </label>

          <span className="text-[11px] text-slate-500">
            Validation preview opens automatically before database writing (Max 500 items/batch).
          </span>
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

      {/* Import Preview Modal */}
      <QuestionImportPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        questions={parsedValidQuestions}
        errors={validationErrors}
        warnings={validationWarnings}
        onConfirmImport={handleConfirmImport}
      />
    </>
  );
}