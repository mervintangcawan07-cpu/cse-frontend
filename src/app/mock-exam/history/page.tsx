"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DatabaseLoadingIndicator from "@/components/common/DatabaseLoadingIndicator";

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

        if (res.ok && (data.attempts || data.history)) {
          setAttempts(data.attempts || data.history);
        } else if (res.status === 401) {
          router.push("/login");
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
      <div className="w-full max-w-6xl mx-auto py-6 sm:py-12 px-2 sm:px-4 space-y-6">
        <DatabaseLoadingIndicator
          title="Loading Exam History & Diagnostics..."
          subtitle="Querying your past mock exam attempts, scores, and review keys from the database."
          skeletonCount={3}
        />
      </div>
    );
  }

  // 1. COMPUTATIONS USING 100% OF ALL HISTORICAL EXAMS
  const totalExamsTaken = attempts.length;
  const overallAverageScore =
    totalExamsTaken > 0
      ? Math.round(
          attempts.reduce((acc, curr) => acc + curr.percentage, 0) / totalExamsTaken
        )
      : 0;

  // 2. DISPLAY LIMIT: SLICE TO SHOW ONLY THE 3 MOST RECENT ATTEMPTS
  const recent3Attempts = attempts.slice(0, 3);

  return (
    <div className="w-full max-w-6xl mx-auto px-2 py-3.5 sm:px-4 sm:py-6 md:px-6 space-y-4 sm:space-y-6 text-slate-100">
      {/* HEADER BANNER WITH OVERALL STATS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
            Performance Log ({totalExamsTaken} Total Exams)
          </span>
          <h1 className="text-2xl font-black text-white mt-2">
            Past Exam Attempts & Reviews
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Displaying your 3 most recent attempts. Overall lifetime average score:{" "}
            <strong className="text-amber-400">{overallAverageScore}%</strong>.
          </p>
        </div>

        <Link
          href="/practice"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 shrink-0"
        >
          ← Return to Practice Hub
        </Link>
      </div>

      {/* ATTEMPTS LIST (SHOWING ONLY TOP 3) */}
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
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 px-1">
            <span>Recent 3 Attempts</span>
            <span>Total Completed: {totalExamsTaken}</span>
          </div>

          {recent3Attempts.map((item, index) => {
            const isPassing = item.percentage >= 80;

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-700 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white">
                      Mock Exam Attempt #{totalExamsTaken - index}
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
                    href={`/mock-exam/results?id=${item.id}`}
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