"use client";

import React, { useState, useEffect } from "react";
import { LiveDrillSession, DrillConfig, CoreSubject, DifficultyLevel, Question } from "@/types/cse";
import { CORE_SUBJECTS, DIFFICULTY_LEVELS } from "./CategoryTagging";
import { formatPromptHTML } from "@/lib/formatPrompt";

interface LiveSpeedDrillProps {
  session?: LiveDrillSession;
  onHostCreate?: (config: DrillConfig) => void;
  onJoinSession?: (sessionId: string) => void;
}

export const LiveSpeedDrill: React.FC<LiveSpeedDrillProps> = ({
  session,
  onHostCreate,
  onJoinSession,
}) => {
  const [showHostModal, setShowHostModal] = useState(false);
  const [config, setConfig] = useState<DrillConfig>({
    coreSubject: "Numerical Reasoning",
    difficulty: "Intermediate Drill",
    itemCount: 20,
    durationMinutes: 15,
  });

  // Time remaining engine
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
  const [isLiveNow, setIsLiveNow] = useState(false);

  useEffect(() => {
    if (!session) return;

    const checkTime = () => {
      const now = new Date().getTime();
      const start = new Date(session.startTime).getTime();
      const end = new Date(session.endTime).getTime();

      if (now >= start && now <= end) {
        setIsLiveNow(true);
        setTimeLeftSeconds(Math.max(0, Math.floor((end - now) / 1000)));
      } else if (now < start) {
        setIsLiveNow(false);
        setTimeLeftSeconds(Math.floor((start - now) / 1000));
      } else {
        setIsLiveNow(false);
        setTimeLeftSeconds(0);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md my-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
        <div>
          <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
            Synchronous Multiplayer Drill
          </span>
          <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
            {session ? session.title : "Live Speed Drill Session"}
          </h3>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {session
              ? `${session.config.coreSubject} • ${session.config.itemCount} Questions • ${session.config.durationMinutes} Mins`
              : "Host a synchronized real-time speed drill for your review group."}
          </p>
        </div>

        <button
          onClick={() => setShowHostModal(true)}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 shadow-sm transition-all"
        >
          + Host Live Drill
        </button>
      </div>

      {/* Dynamic Action Area */}
      {session && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isLiveNow ? "bg-emerald-500 animate-ping" : "bg-amber-500"}`} />
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isLiveNow ? "Session in Progress" : "Scheduled Start Countdown"}
              </div>
              <div className="text-lg font-mono font-black text-slate-900 dark:text-white">
                {formatCountdown(timeLeftSeconds)}
              </div>
            </div>
          </div>

          {/* Dynamic State Switch Button */}
          {isLiveNow ? (
            <button
              onClick={() => onJoinSession?.(session.id)}
              className="px-5 py-2.5 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 animate-bounce"
            >
              <span>🚀</span> Join Live Session
            </button>
          ) : (
            <button
              disabled
              className="px-4 py-2 rounded-xl font-bold text-xs bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 cursor-not-allowed"
            >
              ✓ RSVP / Registered
            </button>
          )}
        </div>
      )}

      {/* Host Configuration Modal */}
      {showHostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
              Configure Live Speed Drill
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Set the subject, question count, and synchronized countdown duration.
            </p>

            <div className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Core Subject</label>
                <select
                  value={config.coreSubject}
                  onChange={(e) => setConfig({ ...config, coreSubject: e.target.value as CoreSubject })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {CORE_SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Difficulty Level</label>
                <select
                  value={config.difficulty}
                  onChange={(e) => setConfig({ ...config, difficulty: e.target.value as DifficultyLevel })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {DIFFICULTY_LEVELS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Item Count</label>
                  <select
                    value={config.itemCount}
                    onChange={(e) => setConfig({ ...config, itemCount: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value={10}>10 Questions</option>
                    <option value={20}>20 Questions</option>
                    <option value={30}>30 Questions</option>
                    <option value={50}>50 Questions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Duration (Mins)</label>
                  <select
                    value={config.durationMinutes}
                    onChange={(e) => setConfig({ ...config, durationMinutes: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowHostModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onHostCreate?.(config);
                  setShowHostModal(false);
                }}
                className="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 text-white hover:bg-blue-500 shadow-md"
              >
                Launch Drill Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
