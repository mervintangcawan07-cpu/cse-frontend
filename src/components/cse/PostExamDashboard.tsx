"use client";

import React, { useState, useEffect } from "react";
import { StudyTogetherEvent, LeaderboardEntry } from "@/types/cse";
import { EventLeaderboard } from "./EventLeaderboard";
import { sortLeaderboardEntries } from "@/services/questionBankService";

interface PostExamDashboardProps {
  event: StudyTogetherEvent;
  onClose: () => void;
}

export const PostExamDashboard: React.FC<PostExamDashboardProps> = ({ event, onClose }) => {
  const result = event.currentUserResult;
  const [secondsUntilClose, setSecondsUntilClose] = useState(0);

  useEffect(() => {
    const startMs = new Date(event.scheduledStartTime).getTime();
    const closeMs = startMs + event.activeDurationHours * 3600 * 1000;

    const updateTimer = () => {
      const nowMs = Date.now();
      setSecondsUntilClose(Math.max(0, Math.floor((closeMs - nowMs) / 1000)));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [event]);

  const formatCountdown = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const sampleLeaderboard: LeaderboardEntry[] = sortLeaderboardEntries([
    {
      userId: "user-me",
      name: "System Admin (You)",
      score: result?.score || 18,
      totalItems: result?.totalItems || 20,
      accuracyPercent: result?.accuracyPercent || 90,
      timeSpentSeconds: result?.timeSpentSeconds || 420,
      submittedAt: "10m ago"
    },
    {
      userId: "user-2",
      name: "Maria Santos",
      score: 19,
      totalItems: 20,
      accuracyPercent: 95,
      timeSpentSeconds: 510,
      submittedAt: "15m ago"
    },
    {
      userId: "user-3",
      name: "Juan Dela Cruz",
      score: 16,
      totalItems: 20,
      accuracyPercent: 80,
      timeSpentSeconds: 380,
      submittedAt: "22m ago"
    }
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-3xl p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              ? Drill Completed
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">{event.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          >
            ? Return to Events
          </button>
        </div>

        {/* Event Stats Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Event Closes In</div>
            <div className="text-xl font-mono font-black text-rose-600 dark:text-rose-400 mt-0.5">
              {formatCountdown(secondsUntilClose)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Active Event Window: {event.activeDurationHours} Hours</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Participants</div>
            <div className="text-xl font-mono font-black text-blue-600 dark:text-blue-400 mt-0.5">
              {event.participantsCount + 2} Examinees
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Live Leaderboard Active</div>
          </div>
        </div>

        {/* Personal Score Summary */}
        <div className="p-5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-300">
            Your Personal Performance Summary
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/40">
              <div className="text-xs font-bold text-slate-500">Score</div>
              <div className="text-lg font-mono font-black text-emerald-600 dark:text-emerald-400">
                {result?.score || 18} / {result?.totalItems || 20}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/40">
              <div className="text-xs font-bold text-slate-500">Accuracy</div>
              <div className="text-lg font-mono font-black text-blue-600 dark:text-blue-400">
                {result?.accuracyPercent || 90}%
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/40">
              <div className="text-xs font-bold text-slate-500">Time Spent</div>
              <div className="text-lg font-mono font-black text-slate-900 dark:text-white">
                {Math.floor((result?.timeSpentSeconds || 420) / 60)}m {(result?.timeSpentSeconds || 420) % 60}s
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Leaderboard */}
        <EventLeaderboard entries={sampleLeaderboard} currentUserId="user-me" />
      </div>
    </div>
  );
};
