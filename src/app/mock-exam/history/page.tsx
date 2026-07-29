"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ExamAttemptItem {
  id: string;
  score: number;
  totalItems: number;
  percentage: number;
  createdAt: string;
}

export default function ExamHistoryPage() {
  const router = useRouter();
  const [attempts, setAttempts] = useState<ExamAttemptItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/mock-exam/history");
        const data = await res.json();

        if (res.ok && data.attempts) {
          setAttempts(data.attempts);
        } else {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Failed to load attempt history:", err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [router]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading past exam attempts...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6 text-slate-100">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
            Performance Log
          </span>
          <h1 className="text-2xl font-black text-white mt-2">
            Past Exam Attempts & Reviews
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review detailed question explanations for all your completed practice mock exams.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 shrink-0"
        >
          ← Return to Dashboard
        </Link>
      </div>

      {/* ATTEMPTS LIST */}
      {attempts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
          <span className="text-4xl block">📝</span>
          <h3 className="text-sm font-bold text-white">No Mock Exam History Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Take your first practice mock exam to generate diagnostic analytics and review item explanations.
          </p>
          <Link
            href="/mock-exam/take"
            className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-md transition"
          >
            ⚡ Take Practice Exam
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((item, index) => {
            const isPassing = item.percentage >= 80;

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-700 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white">
                      Mock Exam Attempt #{attempts.length - index}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                        isPassing
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-red-500/10 text-red-400 border-red-500/30"
                      }`}
                    >
                      {isPassing ? "PASSED (80%+)" : "NEEDS REVIEW"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(item.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                  <div className="text-left sm:text-right">
                    <span className="text-lg font-black text-amber-400 block">
                      {item.percentage}%
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 block">
                      {item.score} / {item.totalItems} Correct
                    </span>
                  </div>

                  <Link
                    href={`/mock-exam/review/${item.id}`}
                    className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 font-bold text-xs rounded-xl transition shrink-0"
                  >
                    🔍 Review Answers
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}