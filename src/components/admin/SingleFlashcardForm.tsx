'use client';

import React, { useState } from 'react';

export default function SingleFlashcardForm({ onAdded }: { onAdded?: () => void }) {
  const [form, setForm] = useState({
    category: '',
    question: '',
    answer: '',
    options: '',
    explanation: '',
    difficulty: 'medium',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/admin/flashcards/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flashcards: [
            {
              ...form,
              options: form.options ? form.options.split('|').map((o) => o.trim()) : [],
            },
          ],
        }),
      });

      if (res.ok) {
        setForm({ category: '', question: '', answer: '', options: '', explanation: '', difficulty: 'medium' });
        if (onAdded) onAdded();
        alert('Flashcard saved successfully!');
      }
    } catch (err) {
      alert('Error saving flashcard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-xl shadow-md border mb-6 space-y-4">
      <h3 className="text-lg font-bold text-gray-800">Add Single Flashcard</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          required
          placeholder="Category (e.g. Philippine Constitution)"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="p-2 border rounded text-sm"
        />
        <select
          value={form.difficulty}
          onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
          className="p-2 border rounded text-sm"
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <textarea
          required
          placeholder="Question"
          value={form.question}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          className="p-2 border rounded text-sm md:col-span-2"
          rows={2}
        />
        <input
          required
          placeholder="Correct Answer"
          value={form.answer}
          onChange={(e) => setForm({ ...form, answer: e.target.value })}
          className="p-2 border rounded text-sm"
        />
        <input
          placeholder="Options (Pipe separated: Option A|Option B|Option C)"
          value={form.options}
          onChange={(e) => setForm({ ...form, options: e.target.value })}
          className="p-2 border rounded text-sm"
        />
        <textarea
          placeholder="Explanation / Solution (Optional)"
          value={form.explanation}
          onChange={(e) => setForm({ ...form, explanation: e.target.value })}
          className="p-2 border rounded text-sm md:col-span-2"
          rows={2}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Add Flashcard'}
      </button>
    </form>
  );
}