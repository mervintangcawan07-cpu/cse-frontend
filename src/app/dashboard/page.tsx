"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("cse_user");
    if (!storedUser) {
      router.push("/settings");
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    async function fetchHistory(id: string) {
      try {
        const res = await fetch(`/api/exam/history?userId=${id}`);
        const data = await res.json();
        if (res.ok) {
          setHistory(data.history);
        }
      } catch (err) {
        console.error("Failed to load history", err);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory(parsedUser.id);
  }, [router]);

  if (!user) return null;

  // --- Analytics Calculations ---
  const totalExams = history.length;
  const highestScore = totalExams > 0 ? Math.max(...history.map((h) => h.score)) : 0;
  const averageScore = totalExams > 0 
    ? Math.round(history.reduce((acc, curr) => acc + curr.score, 0) / totalExams) 
    : 0;

  // Prepare data for the chart (needs to be chronological: oldest to newest)
  const chartData = [...history].reverse().map((h, index) => ({
    name: `Exam ${index + 1}`,
    date: new Date(h.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: h.score,
  }));

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-8">
      {/* Header Profile Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-extrabold text-slate-800">
          Welcome back, {user.name || "Reviewee"}!
        </h1>
        <p className="text-slate-500 text-sm mt-1">{user.email}</p>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <p className="text-slate-400 font-medium animate-pulse">Loading analytics...</p>
        </div>
      ) : totalExams === 0 ? (
        <div className="bg-white p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-2">No data to display yet</h2>
          <p className="text-slate-500 text-sm mb-6">Take your first mock exam to unlock analytics and track your progress.</p>
          <Link
            href="/mock-exam/take"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-sm inline-block"
          >
            Start First Exam
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Average Score</p>
              <p className="text-4xl font-black text-blue-600">{averageScore}%</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Highest Score</p>
              <p className="text-4xl font-black text-emerald-600">{highestScore}%</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Exams Taken</p>
              <p className="text-4xl font-black text-slate-800">{totalExams}</p>
            </div>
          </div>

          {/* Performance Chart */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">Performance Trend</h2>
              <Link
                href="/mock-exam/take"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition shadow-sm"
              >
                Take New Exam
              </Link>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#2563eb" 
                    strokeWidth={4}
                    activeDot={{ r: 8, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                    dot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent History List */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-xl font-bold text-slate-800">Recent Sessions</h2>
            <div className="space-y-3">
              {history.slice(0, 5).map((item) => (
                <div key={item.id} className="flex justify-between items-center p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">
                      {new Date(item.createdAt).toLocaleDateString("en-US", { 
                        weekday: 'short', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                      })}
                    </p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">Score: {item.score}%</p>
                  </div>
                  <div className="text-right text-xs space-x-3">
                    <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-md">✓ {item.correct} correct</span>
                    <span className="text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded-md">✕ {item.incorrect + item.skipped} missed</span>
                  </div>
                </div>
              ))}
            </div>
            {history.length > 5 && (
              <p className="text-center text-sm font-semibold text-slate-400 mt-4">
                Showing your 5 most recent exams.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}