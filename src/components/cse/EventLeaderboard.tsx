"use client";

import React from "react";
import { LeaderboardEntry } from "@/types/cse";

interface EventLeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
}

export const EventLeaderboard: React.FC<EventLeaderboardProps> = ({
  entries,
  currentUserId = "user-me",
}) => {
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
          <span>??</span> Live Event Scoreboard
        </h3>
        <span className="text-xs font-bold text-slate-500">{entries.length} Participants</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {entries.map((entry, idx) => {
            const rank = entry.rank || idx + 1;
            const isMe = entry.userId === currentUserId;

            return (
              <div
                key={entry.userId || idx}
                className={`flex items-center justify-between p-3.5 transition-colors ${
                  isMe
                    ? "bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-l-blue-600 dark:border-l-blue-400"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono text-xs font-black ${
                      rank === 1
                        ? "bg-amber-400 text-amber-950 shadow-xs ring-2 ring-amber-300"
                        : rank === 2
                        ? "bg-slate-300 text-slate-900 shadow-xs"
                        : rank === 3
                        ? "bg-amber-700 text-amber-100 shadow-xs"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    #{rank}
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{entry.name}</span>
                      {isMe && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-600 text-white">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Time: {formatTime(entry.timeSpentSeconds)} • {entry.accuracyPercent}% Accuracy
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {entry.score} / {entry.totalItems}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400">{entry.submittedAt}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
