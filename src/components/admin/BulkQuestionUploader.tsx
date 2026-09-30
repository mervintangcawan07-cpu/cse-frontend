"use client";

import React, { useState } from "react";
import Papa from "papaparse";
import {
  downloadCSVTemplate,
  downloadStandardCSVTemplate,
  validateParsedQuestions,
} from "@/lib/csvParser";
import QuestionImportPreviewModal from "./QuestionImportPreviewModal";
import { StructuredQuestion } from "@/types/question";

interface BulkUploaderProps {
  readonly onSuccess?: () => void;
}

interface StatusFeedback {
  readonly type: "success" | "error";
  readonly text: string;
}

interface ImportApiResponse {
  readonly success?: boolean;
  readonly importedCount?: number;
  readonly count?: number;
  readonly error?: string;
}

type ValidationResult = ReturnType<typeof validateParsedQuestions>;
type ValidationErrorItem = ValidationResult["errors"][number];
type ValidationWarningItem = ValidationResult["warnings"][number];

const MAX_BATCH_SIZE = 500;

function parseJsonPayload(text: string): unknown[] {
  const json: unknown = JSON.parse(text);

  if (Array.isArray(json)) {
    return json;
  }

  if (json && typeof json === "object") {
    if ("questions" in json && Array.isArray((json as { questions: unknown }).questions)) {
      return (json as { questions: unknown[] }).questions;
    }
    return [json];
  }

  return [];
}

function parseCsvPayload(text: string): unknown[] {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  return parsed.data;
}

function extractRawDataFromFile(fileName: string, text: string): unknown[] {
  if (fileName.endsWith(".json")) {
    return parseJsonPayload(text);
  }

  if (fileName.endsWith(".csv")) {
    return parseCsvPayload(text);
  }

  throw new Error("Unsupported file format. Please upload a .CSV or .JSON file.");
}

export default function BulkQuestionUploader({ onSuccess }: BulkUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusFeedback | null>(null);

  // Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [parsedValidQuestions, setParsedValidQuestions] = useState<StructuredQuestion[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarningItem[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputElement = e.target;
    const file = inputElement.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      const text = await file.text();
      const rawData = extractRawDataFromFile(file.name, text);

      if (rawData.length === 0) {
        throw new Error("The uploaded file contains no data rows.");
      }

      if (rawData.length > MAX_BATCH_SIZE) {
        throw new Error(
          `Batch size exceeded. The file contains ${rawData.length} questions, but the maximum allowed is ${MAX_BATCH_SIZE}.`
        );
      }

      // Run validation engine
      const validation = validateParsedQuestions(rawData);

      setParsedValidQuestions(validation.validQuestions);
      setValidationErrors(validation.errors);
      setValidationWarnings(validation.warnings);
      setPreviewOpen(true);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Error reading or parsing the file.";
      setStatusMessage({
        type: "error",
        text: errorMessage,
      });
    } finally {
      setLoading(false);
      inputElement.value = "";
    }
  };

  const handleConfirmImport = async (validQuestions: StructuredQuestion[]) => {
    try {
      const res = await fetch("/api/admin/questions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: validQuestions }),
      });

      const data: ImportApiResponse = await res.json();

      if (res.ok && data.success) {
        const count = data.importedCount ?? data.count ?? validQuestions.length;
        setStatusMessage({
          type: "success",
          text: `Successfully imported ${count} structured question(s) into the Question Bank!`,
        });
        onSuccess?.();
      } else {
        setStatusMessage({
          type: "error",
          text: data.error || "Failed to import questions to the database.",
        });
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "Network error occurred while importing questions.",
      });
    }
  };

  return (
    <>
      <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-md">
        <div className="flex flex-col items-start justify-between gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
          <div>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2.5 py-1 text-[10px] font-black uppercase text-amber-400">
              Admin Content Tools
            </span>
            <h2 className="mt-1 text-lg font-black">Advanced Bulk Question Importer</h2>
            <p className="text-xs text-slate-400">
              Upload standard or premium reasoning questions with Step-by-Step solutions, Option Analyses, Traps, and Tips.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadStandardCSVTemplate}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-700"
            >
              <span aria-hidden="true">📄</span>
              <span>Standard CSV Template</span>
            </button>
            <button
              type="button"
              onClick={downloadCSVTemplate}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-amber-400 transition hover:bg-slate-700"
            >
              <span aria-hidden="true">⭐</span>
              <span>Full Pro CSV Template</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <label className="w-full cursor-pointer rounded-xl bg-blue-600 px-5 py-3 text-center text-xs font-bold text-white shadow-md transition hover:bg-blue-500 sm:w-auto">
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
            Validation preview opens automatically before database writing (Max {MAX_BATCH_SIZE} items/batch).
          </span>
        </div>

        {statusMessage && (
          <div
            role="alert"
            className={`rounded-xl p-3.5 text-xs font-bold ${
              statusMessage.type === "success"
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border border-red-500/30 bg-red-500/10 text-red-400"
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