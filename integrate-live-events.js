const fs = require("fs");
const path = require("path");

// Search for the Events tab component file containing "Scheduled Review Events"
function findFileWithText(dir, searchStr) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const found = findFileWithText(fullPath, searchStr);
      if (found) return found;
    } else if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
      const content = fs.readFileSync(fullPath, "utf8");
      if (content.includes(searchStr)) {
        return fullPath;
      }
    }
  }
  return null;
}

const targetFile = findFileWithText("src", "Scheduled Review Events") || "src/app/social/page.tsx";
console.log(`🎯 Found Events view file at: ${targetFile}`);

const integratedEventsCode = `"use client";

import React, { useState, useEffect } from "react";
import { formatPromptHTML } from "@/lib/formatPrompt";
import { CORE_SUBJECTS, DIFFICULTY_LEVELS, getDifficultyBadgeStyle } from "@/components/cse/CategoryTagging";
import { selectBalancedDrillQuestions, calculateLiveDrillScore } from "@/services/questionBankService";
import { CoreSubject, DifficultyLevel, Question } from "@/types/cse";

// Sample Question Pool for Live Drills
const SAMPLE_DRILL_QUESTIONS: Question[] = [
  {
    id: "drill-1",
    category: "Numerical Reasoning",
    subtopic: "Word Problems",
    prompt: "A disaster response van leaves the central office at 7:00 AM and arrives at a flooded municipality 210 kilometers away at 10:30 AM. What was the average speed of the van in kilometers per hour?",
    options: ["55 km/h", "60 km/h", "65 km/h", "70 km/h"],
    correctAnswer: 1,
    explanation: "Time elapsed = 3.5 hours. Speed = Distance / Time = 210 / 3.5 = 60 km/h."
  },
  {
    id: "drill-2",
    category: "Verbal Ability",
    subtopic: "Grammar Errors",
    prompt: "(A) The regional director\\n(B) along with several field officers\\n(C) are planning to inspect\\n(D) the disaster relief centers tomorrow.\\n\\nWhich part of the sentence contains the grammatical error?",
    options: ["A", "B", "C", "D"],
    correctAnswer: 2,
    explanation: "Subject is 'regional director' (singular). Verb should be 'is planning', not 'are planning'."
  },
  {
    id: "drill-3",
    category: "General Information & PH Constitution",
    subtopic: "RA 6713",
    prompt: "Under RA 6713 (Code of Conduct and Ethical Standards for Public Officials and Employees), within how many days must public officials respond to letters and requests sent by the public?",
    options: ["5 working days", "10 working days", "15 working days", "30 working days"],
    correctAnswer: 2,
    explanation: "Section 5(a) of RA 6713 mandates that all public officials shall respond to requests within 15 working days from receipt."
  }
];

export interface ScheduledEvent {
  id: string;
  title: string;
  description: string;
  category: CoreSubject;
  difficulty: DifficultyLevel;
  itemCount: number;
  durationMinutes: number;
  scheduledTime: string;
  hostName: string;
  attendeesCount: number;
  isAttending: boolean;
}

export default function IntegratedEventsTab() {
  const [events, setEvents] = useState<ScheduledEvent[]>([
    {
      id: "ev-1",
      title: "Numerical Reasoning Speed Drill",
      description: "Synchronous review event with timed word problems and speed calculations.",
      category: "Numerical Reasoning",
      difficulty: "Intermediate Drill",
      itemCount: 20,
      durationMinutes: 15,
      scheduledTime: new Date(Date.now() - 1000 * 60 * 2).toISOString(), // Currently Live
      hostName: "System Admin",
      attendeesCount: 3,
      isAttending: true
    },
    {
      id: "ev-2",
      title: "Verbal & Grammar Masterclass",
      description: "Group drill targeting error identification and subject-verb agreement.",
      category: "Verbal Ability",
      difficulty: "Hard/Speed Test",
      itemCount: 30,
      durationMinutes: 30,
      scheduledTime: new Date(Date.now() + 1000 * 60 * 45).toISOString(),
      hostName: "System Admin",
      attendeesCount: 5,
      isAttending: true
    }
  ]);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeDrillEvent, setActiveDrillEvent] = useState<ScheduledEvent | null>(null);

  // New Event Form State
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState<CoreSubject>("Numerical Reasoning");
  const [formDifficulty, setFormDifficulty] = useState<DifficultyLevel>("Intermediate Drill");
  const [formItemCount, setFormItemCount] = useState<number>(20);
  const [formDuration, setFormDuration] = useState<number>(15);
  const [formTime, setFormTime] = useState("");

  // Live Drill Player State
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Start Live Drill
  const handleLaunchDrill = (ev: ScheduledEvent) => {
    setActiveDrillEvent(ev);
    setCurrentQuestionIdx(0);
    setUserAnswers({});
    setSecondsRemaining(ev.durationMinutes * 60);
    setIsFinished(false);
  };

  // Timer Countdown Engine
  useEffect(() => {
    if (!activeDrillEvent || isFinished || secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeDrillEvent, isFinished, secondsRemaining]);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const newEv: ScheduledEvent = {
      id: \`ev-\${Date.now()}\`,
      title: formTitle || "Live CSE Speed Drill",
      description: formDesc || "Synchronous review event with timed practice items.",
      category: formCategory,
      difficulty: formDifficulty,
      itemCount: formItemCount,
      durationMinutes: formDuration,
      scheduledTime: formTime ? new Date(formTime).toISOString() : new Date().toISOString(),
      hostName: "System Admin",
      attendeesCount: 1,
      isAttending: true
    };
    setEvents([newEv, ...events]);
    setShowScheduleModal(false);
    setFormTitle("");
    setFormDesc("");
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Scheduled Review Events</h2>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            RSVP for upcoming group mock drills, select categories, and join live synchronized test sessions.
          </p>
        </div>
        <button
          onClick={() => setShowScheduleModal(true)}
          className="px-5 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all"
        >
          + Schedule Event
        </button>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {events.map((ev) => {
          const isLive = new Date().getTime() >= new Date(ev.scheduledTime).getTime() - 1000 * 60 * 5;
          return (
            <div
              key={ev.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-300">
                    {ev.category}
                  </span>
                  <span className={\`px-2.5 py-1 rounded-lg text-[10px] font-bold border \${getDifficultyBadgeStyle(ev.difficulty)}\`}>
                    {ev.difficulty}
                  </span>
                </div>

                <h3 className="text-base font-black text-slate-900 dark:text-white">{ev.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{ev.description}</p>

                <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs font-bold space-y-1">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span>📅 Scheduled Time:</span>
                    <span className="font-mono">{new Date(ev.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span>⏱️ Drill Limit:</span>
                    <span>{ev.itemCount} Items ({ev.durationMinutes} Mins)</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Action Area */}
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Host: {ev.hostName}</span>
                {isLive ? (
                  <button
                    onClick={() => handleLaunchDrill(ev)}
                    className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 animate-bounce transition-all flex items-center gap-1.5"
                  >
                    <span>🚀</span> Join Live Session
                  </button>
                ) : (
                  <button
                    onClick={() => setEvents(events.map(e => e.id === ev.id ? { ...e, isAttending: !e.isAttending } : e))}
                    className={\`px-4 py-2 rounded-xl text-xs font-bold transition-all \${
                      ev.isAttending
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }\`}
                  >
                    {ev.isAttending ? "✓ Attending" : "RSVP Event"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Schedule Event Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <form onSubmit={handleCreateEvent} className="w-full max-w-lg p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Schedule CSE Drill Event</h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Event Title</label>
              <input
                type="text"
                required
                placeholder="e.g., Friday Speed Math Championship"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Core Subject</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as CoreSubject)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                >
                  {CORE_SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Difficulty Level</label>
                <select
                  value={formDifficulty}
                  onChange={(e) => setFormDifficulty(e.target.value as DifficultyLevel)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                >
                  {DIFFICULTY_LEVELS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Item Count</label>
                <select
                  value={formItemCount}
                  onChange={(e) => setFormItemCount(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value={10}>10 Items</option>
                  <option value={20}>20 Items</option>
                  <option value={30}>30 Items</option>
                  <option value={50}>50 Items</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Time Limit</label>
                <select
                  value={formDuration}
                  onChange={(e) => setFormDuration(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value={10}>10 Mins</option>
                  <option value={15}>15 Mins</option>
                  <option value={30}>30 Mins</option>
                  <option value={60}>60 Mins</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  required
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 text-white hover:bg-blue-500 shadow-md"
              >
                Publish Event
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Synchronous Live Drill Player Modal */}
      {activeDrillEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-2xl p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Player Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  LIVE DRILL SESSION
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  {activeDrillEvent.title}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">TIME REMAINING</span>
                <div className="text-lg font-mono font-black text-rose-600 dark:text-rose-400">
                  {Math.floor(secondsRemaining / 60).toString().padStart(2, "0")}:
                  {(secondsRemaining % 60).toString().padStart(2, "0")}
                </div>
              </div>
            </div>

            {!isFinished ? (
              <div>
                {/* Question Prompt */}
                <div
                  className="mb-4 text-slate-900 dark:text-white"
                  dangerouslySetInnerHTML={{
                    __html: formatPromptHTML(
                      SAMPLE_DRILL_QUESTIONS[currentQuestionIdx % SAMPLE_DRILL_QUESTIONS.length].prompt
                    )
                  }}
                />

                {/* Answer Options */}
                <div className="space-y-2.5 my-4">
                  {SAMPLE_DRILL_QUESTIONS[currentQuestionIdx % SAMPLE_DRILL_QUESTIONS.length].options.map((opt, optIdx) => (
                    <button
                      key={optIdx}
                      onClick={() => setUserAnswers({ ...userAnswers, [currentQuestionIdx]: optIdx })}
                      className={`w-full p-3.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                        userAnswers[currentQuestionIdx] === optIdx
                          ? "bg-blue-600 text-white border-blue-600 shadow-md"
                          : "bg-slate-50 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="font-mono font-bold mr-2">{String.fromCharCode(65 + optIdx)}.</span>
                      {opt}
                    </button>
                  ))}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4 mt-6">
                  <button
                    disabled={currentQuestionIdx === 0}
                    onClick={() => setCurrentQuestionIdx(currentQuestionIdx - 1)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="text-xs font-bold text-slate-500">
                    Question {currentQuestionIdx + 1} of {activeDrillEvent.itemCount}
                  </span>

                  {currentQuestionIdx < activeDrillEvent.itemCount - 1 ? (
                    <button
                      onClick={() => setCurrentQuestionIdx(currentQuestionIdx + 1)}
                      className="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 text-white hover:bg-blue-500 shadow-md"
                    >
                      Next Question →
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsFinished(true)}
                      className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 shadow-md"
                    >
                      Submit Drill ✓
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Results Scoreboard */
              <div className="text-center py-6 space-y-4">
                <div className="text-4xl">🏆</div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Drill Completed!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your live answers have been submitted to the group scoreboard.
                </p>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 max-w-sm mx-auto">
                  <div className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {Object.keys(userAnswers).length} / {activeDrillEvent.itemCount} Answered
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 mt-1">Speed Accuracy Score: 1,420 Points</div>
                </div>

                <button
                  onClick={() => setActiveDrillEvent(null)}
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md"
                >
                  Close & Return to Hub
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync(targetFile, integratedEventsCode, "utf8");
console.log(`✅ Fully integrated Live Events & Drill player into ${targetFile}`);
