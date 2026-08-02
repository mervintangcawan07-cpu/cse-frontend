"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ExamAttempt {
  id: string;
  score: number;
  totalItems: number;
  percentage: number;
  correct: number;
  incorrect: number;
  skipped: number;
  createdAt: string;
}

export default function ExamHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeTab, setActiveTab] = useState<"NEW" | "HISTORY">("NEW");
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 1. Authenticate user & verify PRO access
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            const isPaid = data.user.isPaid || data.user.role === "ADMIN";
            if (!isPaid) {
              router.push("/dashboard");
              return;
            }
            setUser(data.user);
          } else {
            router.push("/login");
          }
        } else {
          router.push("/login");
        }
      } catch (err) {
        console.error("Auth error in exam hub:", err);
        router.push("/login");
      } finally {
        setLoadingUser(false);
      }
    }
    checkAuth();
  }, [router]);

  // 2. Fetch history when user clicks on History tab
  useEffect(() => {
    if (activeTab === "HISTORY" && user) {
      loadHistory();
    }
  }, [activeTab, user]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/mock-exam/history");
      const data = await res.json();
      if (res.ok && (data.attempts || data.history)) {
        const rawHistory = data.attempts || data.history;
        setAttempts(rawHistory.slice(0, 3)); // Strict cap to top 3 items
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Loading Mock Exam Hub...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6 text-slate-100">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
            Civil Service Review Hub
          </span>
          <h1 className="text-2xl font-black text-white mt-2">
            Practice Mock Examination Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Simulate 170-item exams or review item explanations from your 3 most recent attempts.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 shrink-0"
        >
          ← Return to Dashboard
        </Link>
      </div>

      {/* SUB-NAVIGATION TABS */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab("NEW")}
          className={`pb-3 px-4 font-bold text-xs transition border-b-2 cursor-pointer ${
            activeTab === "NEW"
              ? "border-blue-500 text-blue-400 font-black"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          ⚡ Start Practice Exam
        </button>
        <button
          onClick={() => setActiveTab("HISTORY")}
          className={`pb-3 px-4 font-bold text-xs transition border-b-2 cursor-pointer ${
            activeTab === "HISTORY"
              ? "border-blue-500 text-blue-400 font-black"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          📜 Exam History (Top 3)
        </button>
      </div>

      {/* TAB 1: START NEW MOCK EXAM */}
      {activeTab === "NEW" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <span className="text-5xl block">⏱️</span>
            <h2 className="text-xl font-extrabold text-white">
              Full 170-Item Practice Exam
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Covers Verbal Ability (50), Numerical Reasoning (45), Analytical Reasoning (45), and General Information (30) with a 3-hour timer.
            </p>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => router.push("/mock-exam/take")}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition cursor-pointer"
            >
              Start Timed Exam Now 🚀
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: RECENT 3 EXAM HISTORY ATTEMPTS */}
      {activeTab === "HISTORY" && (
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="p-12 text-center text-slate-400 font-bold animate-pulse">
              Loading recent exam records...
            </div>
          ) : attempts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <span className="text-4xl block">📝</span>
              <h3 className="text-sm font-bold text-white">No Exam History Yet</h3>
              <p className="text-xs text-slate-400">
                Complete your first mock exam attempt to record diagnostic review keys.
              </p>
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
                          Recent Attempt #{index + 1}
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
                          {item.correct} / {item.totalItems} Correct
                        </span>
                      </div>

                      <Link
                        href={`/mock-exam/results?id=${item.id}`}
                        className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 font-bold text-xs rounded-xl transition shrink-0"
                      >
                        🔍 Review Full Questions
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}