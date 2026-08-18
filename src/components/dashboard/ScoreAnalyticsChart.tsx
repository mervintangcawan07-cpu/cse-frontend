"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface ScoreHistoryPoint {
  date: string;
  score: number;
  passing: number;
}

interface ScoreAnalyticsChartProps {
  scoreHistory: ScoreHistoryPoint[];
}

export default function ScoreAnalyticsChart({ scoreHistory }: ScoreAnalyticsChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={scoreHistory} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0f172a",
            borderRadius: "16px",
            border: "none",
            color: "#fff",
            fontSize: "12px",
          }}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#2563eb"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#scoreColor)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
