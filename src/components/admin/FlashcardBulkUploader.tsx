'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import { Upload, AlertCircle, CheckCircle, Trash2, Edit2, Save, X } from 'lucide-react';

export interface FlashcardRow {
  id: string;
  category: string;
  question: string;
  answer: string;
  options?: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  isValid?: boolean;
  error?: string;
}

export interface FlashcardBulkUploaderProps {
  onAdded?: () => void;
  onSuccess?: () => void;
}

export default function FlashcardBulkUploader({ onAdded, onSuccess }: FlashcardBulkUploaderProps) {
  const [data, setData] = useState<FlashcardRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FlashcardRow | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const validateRow = (row: Omit<FlashcardRow, 'id' | 'isValid' | 'error'>): { isValid: boolean; error: string } => {
    let error = '';
    if (!row.category?.trim()) error = 'Missing category';
    else if (!row.question?.trim()) error = 'Missing question';
    else if (!row.answer?.trim()) error = 'Missing answer';
    return { isValid: !error, error };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<Omit<FlashcardRow, 'id' | 'isValid' | 'error'>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validatedRows: FlashcardRow[] = results.data.map((row, index) => {
          const validation = validateRow(row);
          return {
            ...row,
            id: `row-${Date.now()}-${index}`,
            isValid: validation.isValid,
            error: validation.error,
          };
        });
        setData(validatedRows);
      },
      error: (err) => {
        setStatusMessage({ type: 'error', text: `CSV Parse Error: ${err.message}` });
      },
    });
  };

  const handleStartEdit = (row: FlashcardRow) => {
    setEditingId(row.id);
    setEditForm({ ...row });
  };

  const handleSaveEdit = () => {
    if (!editForm) return;

    const validation = validateRow(editForm);
    const updatedRow: FlashcardRow = {
      ...editForm,
      isValid: validation.isValid,
      error: validation.error,
    };

    setData((prev) => prev.map((item) => (item.id === editingId ? updatedRow : item)));
    setEditingId(null);
    setEditForm(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleRemoveRow = (id: string) => {
    setData((prev) => prev.filter((item) => item.id !== id));
  };

  const handleBulkSubmit = async () => {
    const validRows = data.filter((row) => row.isValid);
    if (validRows.length === 0) {
      setStatusMessage({ type: 'error', text: 'No valid rows to upload.' });
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);

    const payload = validRows.map((item) => ({
      category: item.category.trim(),
      question: item.question.trim(),
      answer: item.answer.trim(),
      options: item.options ? item.options.split('|').map((o) => o.trim()) : [],
      explanation: item.explanation?.trim() || '',
      difficulty: item.difficulty?.toLowerCase() || 'medium',
    }));

    try {
      const response = await fetch('/api/admin/flashcards/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flashcards: payload }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || 'Upload failed');

      setStatusMessage({ type: 'success', text: `Successfully inserted ${result.count || validRows.length} flashcards!` });
      setData([]);

      if (onAdded) onAdded();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Server error occurred' });
    } finally {
      setIsUploading(false);
    }
  };

  const validCount = data.filter((d) => d.isValid).length;
  const invalidCount = data.length - validCount;

  return (
    <div className="p-6 max-w-7xl mx-auto bg-white rounded-xl shadow-md border">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">CSC Flashcard Bulk Uploader & Manual Editor</h2>

      <div className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg p-6 text-center bg-gray-50 mb-6 cursor-pointer relative">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <Upload className="mx-auto h-10 w-10 text-gray-400 mb-2" />
        <p className="text-sm font-medium text-gray-700">Click or drag CSV file here to load flashcards</p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-md mb-6 flex items-center gap-2 ${
            statusMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {data.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-4 text-sm font-semibold">
              <span className="text-gray-600">Total: {data.length}</span>
              <span className="text-green-600">Valid: {validCount}</span>
              {invalidCount > 0 && <span className="text-red-600">Invalid: {invalidCount} (Click edit to fix)</span>}
            </div>
            <button
              onClick={handleBulkSubmit}
              disabled={isUploading || validCount === 0}
              className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {isUploading ? 'Uploading...' : `Upload ${validCount} Valid Flashcards`}
            </button>
          </div>

          <div className="overflow-x-auto max-h-[500px] border rounded-lg">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-100 uppercase sticky top-0 font-semibold border-b z-10">
                <tr>
                  <th className="p-3 w-24">Status</th>
                  <th className="p-3 w-32">Category</th>
                  <th className="p-3">Question</th>
                  <th className="p-3">Answer</th>
                  <th className="p-3">Options (Pipe | Separated)</th>
                  <th className="p-3 w-24">Difficulty</th>
                  <th className="p-3 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map((row) => {
                  const isEditing = editingId === row.id;

                  if (isEditing && editForm) {
                    return (
                      <tr key={row.id} className="bg-yellow-50 border-2 border-yellow-300">
                        <td className="p-2 text-yellow-700 font-bold">Editing</td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                            className="w-full p-1 border rounded text-gray-900"
                            placeholder="Category"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={editForm.question}
                            onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                            className="w-full p-1 border rounded text-gray-900"
                            placeholder="Question"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={editForm.answer}
                            onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                            className="w-full p-1 border rounded text-gray-900"
                            placeholder="Answer"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={editForm.options || ''}
                            onChange={(e) => setEditForm({ ...editForm, options: e.target.value })}
                            className="w-full p-1 border rounded text-gray-900"
                            placeholder="Opt1|Opt2|Opt3"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={editForm.difficulty || 'medium'}
                            onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value as any })}
                            className="w-full p-1 border rounded text-gray-900"
                          >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </td>
                        <td className="p-2 text-right flex gap-1 justify-end">
                          <button onClick={handleSaveEdit} className="p-1 bg-green-600 text-white rounded hover:bg-green-700" title="Save Row">
                            <Save size={14} />
                          </button>
                          <button onClick={handleCancelEdit} className="p-1 bg-gray-400 text-white rounded hover:bg-gray-500" title="Cancel">
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={row.id} className={row.isValid ? 'bg-white' : 'bg-red-50'}>
                      <td className="p-3">
                        {row.isValid ? (
                          <span className="inline-flex items-center text-green-600 font-medium">
                            <CheckCircle size={14} className="mr-1" /> Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-red-600 font-medium" title={row.error}>
                            <AlertCircle size={14} className="mr-1" /> {row.error}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-medium text-gray-900">{row.category}</td>
                      <td className="p-3 truncate max-w-xs">{row.question}</td>
                      <td className="p-3 truncate max-w-xs">{row.answer}</td>
                      <td className="p-3 truncate max-w-xs">{row.options || '-'}</td>
                      <td className="p-3 capitalize">{row.difficulty || 'medium'}</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleStartEdit(row)} className="text-blue-600 hover:text-blue-800 p-1" title="Edit row">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleRemoveRow(row.id)} className="text-red-500 hover:text-red-700 p-1" title="Remove row">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}