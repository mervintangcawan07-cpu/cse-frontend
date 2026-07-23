"use client";

interface ExamResult {
  id: string;
  score: number;
  correct: number;
  incorrect: number;
  totalItems: number;
  createdAt: string;
}

interface AnalyticsProps {
  totalExams: number;
  avgScore: number;
  highestScore: number;
  readinessIndex: number;
  results: ExamResult[];
}

export default function AnalyticsOverview({
  totalExams,
  avgScore,
  highestScore,
  readinessIndex,
  results,
}: AnalyticsProps) {
  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-2 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tests Attempted</p>
            <span className="p-2 bg-slate-100 text-slate-600 rounded-xl text-xs">📊</span>
          </div>
          <p className="text-3xl font-extrabold text-slate-900">{totalExams}</p>
          <p className="text-xs text-slate-500">Completed mock exams</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-2 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Score</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl text-xs">🎯</span>
          </div>
          <p className="text-3xl font-extrabold text-blue-600">{avgScore}%</p>
          <p className="text-xs text-slate-500">Across all taken topics</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-2 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Personal Best</p>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs">🏆</span>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600">{highestScore}%</p>
          <p className="text-xs text-slate-500">Highest score achieved</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-2 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">CSE Readiness</p>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs">🚀</span>
          </div>
          <p className="text-3xl font-extrabold text-indigo-600">{readinessIndex}%</p>
          <p className="text-xs text-slate-500">Based on 80% passing benchmark</p>
        </div>
      </div>

      {/* Performance History Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent Test Performance</h2>
            <p className="text-xs text-slate-400 mt-0.5">Stored securely in Neon DB</p>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-12 space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-500 text-sm font-medium">No practice exams completed yet.</p>
            <p className="text-xs text-slate-400">Take your first practice test from the Review Center above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase rounded-2xl">
                <tr>
                  <th className="p-3.5 rounded-l-xl">Date</th>
                  <th className="p-3.5">Score</th>
                  <th className="p-3.5">Correct</th>
                  <th className="p-3.5">Incorrect</th>
                  <th className="p-3.5 rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-semibold text-slate-800">
                      {new Date(r.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">{r.score}%</td>
                    <td className="p-3.5 text-emerald-600 font-semibold">
                      {r.correct} / {r.totalItems}
                    </td>
                    <td className="p-3.5 text-red-500 font-medium">{r.incorrect}</td>
                    <td className="p-3.5">
                      {r.score >= 80 ? (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg">
                          PASSED
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-lg">
                          NEEDS REVIEW
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}