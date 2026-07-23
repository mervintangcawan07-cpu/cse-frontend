"use client";

import { useEffect, useState } from "react";

interface CategoryStat {
  category: string;
  accuracy: number;
  targetBenchmark: number;
  status: "MASTERY" | "DEVELOPING" | "NEEDS PRACTICE";
}

export default function CategoryBreakdown() {
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetailedAnalytics() {
      try {
        const res = await fetch("/api/user/analytics/detailed");
        if (res.ok) {
          const data = await res.json();
          setStats(data.categoryStats || []);
        }
      } catch (err) {
        console.error("Failed to load category breakdown:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetailedAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-3xl border border-slate-200 animate-pulse space-y-4">
        <div className="h-4 bg-slate-200 rounded w-1/4"></div>
        <div className="h-20 bg-slate-100 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Subject Proficiency Breakdown</h2>
        <p className="text-xs text-slate-500 mt-0.5">Target accuracy benchmark for civil service eligibility</p>
      </div>

      <div className="space-y-5">
        {stats.map((item, idx) => {
          const getBadgeColor = (status: string) => {
            if (status === "MASTERY") return "bg-emerald-100 text-emerald-800 border-emerald-200";
            if (status === "DEVELOPING") return "bg-blue-100 text-blue-800 border-blue-200";
            return "bg-amber-100 text-amber-800 border-amber-200";
          };

          const getBarColor = (status: string) => {
            if (status === "MASTERY") return "bg-emerald-500";
            if (status === "DEVELOPING") return "bg-blue-500";
            return "bg-amber-500";
          };

          return (
            <div key={idx} className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800">{item.category}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${getBadgeColor(item.status)}`}>
                    {item.status}
                  </span>
                  <span className="font-extrabold text-slate-900">{item.accuracy}%</span>
                </div>
              </div>

              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-500 ${getBarColor(item.status)}`}
                  style={{ width: `${item.accuracy}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}