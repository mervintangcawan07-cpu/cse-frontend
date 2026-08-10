"use client";

import React, { useState, useEffect } from "react";
import { formatPromptHTML } from "@/lib/formatPrompt";
import { CORE_SUBJECTS, DIFFICULTY_LEVELS, getDifficultyBadgeStyle } from "@/components/cse/CategoryTagging";
import { DeleteEventModal } from "@/components/cse/DeleteEventModal";
import LiveWaitingRoom from "@/components/cse/LiveWaitingRoom";
import { CoreSubject, DifficultyLevel, Question } from "@/types/cse";

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
    prompt: "(A) The regional director\n(B) along with several field officers\n(C) are planning to inspect\n(D) the disaster relief centers tomorrow.\n\nWhich part of the sentence contains the grammatical error?",
    options: ["A", "B", "C", "D"],
    correctAnswer: 2,
    explanation: "Subject is 'regional director' (singular). Verb should be 'is planning', not 'are planning'."
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
  endTime?: string;
  hostName: string;
  hostUserId?: string;
  attendeesCount: number;
  isAttending: boolean;
}

const INITIAL_DEFAULT_EVENTS: ScheduledEvent[] = [
  {
    id: "ev-1",
    title: "Numerical Reasoning Speed Drill",
    description: "Synchronous review event with timed word problems and speed calculations.",
    category: "Numerical Reasoning",
    difficulty: "Intermediate Drill",
    itemCount: 20,
    durationMinutes: 15,
    scheduledTime: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
    endTime: new Date(Date.now() + 1000 * 60 * 135).toISOString(),
    hostName: "System Admin",
    hostUserId: "admin-1",
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
    scheduledTime: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    endTime: new Date(Date.now() + 1000 * 60 * 180).toISOString(),
    hostName: "System Admin",
    hostUserId: "admin-1",
    attendeesCount: 5,
    isAttending: true
  }
];

export default function StudyEventsSection() {
  // Current Active User (Default: System Admin)
  const currentUserName = "System Admin";

  // 1. Initialize State with LocalStorage Persistence
  const [events, setEvents] = useState<ScheduledEvent[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cse_events_v2");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse saved events", e);
        }
      }
    }
    return INITIAL_DEFAULT_EVENTS;
  });

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeDrillEvent, setActiveDrillEvent] = useState<ScheduledEvent | null>(null);
  const [waitingRoomEvent, setWaitingRoomEvent] = useState<ScheduledEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<{ id: string; title: string } | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState<CoreSubject>("Numerical Reasoning");
  const [formDifficulty, setFormDifficulty] = useState<DifficultyLevel>("Intermediate Drill");
  const [formItemCount, setFormItemCount] = useState<number>(20);
  const [formDuration, setFormDuration] = useState<number>(15);
  const [formTime, setFormTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");

  // Live Drill State
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Auto-Save Events to LocalStorage on Any Change (Create / Delete)
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cse_events_v2", JSON.stringify(events));
    }
  }, [events]);

  const handleLaunchDrill = (ev: ScheduledEvent) => {
    setActiveDrillEvent(ev);
    setCurrentQuestionIdx(0);
    setUserAnswers({});
    setSecondsRemaining(ev.durationMinutes * 60);
    setIsFinished(false);
  };

  const handleDeleteEvent = (eventId: string, eventTitle: string) => {
    setEventToDelete({ id: eventId, title: eventTitle });
  };

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
    const startIso = formTime ? new Date(formTime).toISOString() : new Date().toISOString();
    const endIso = formEndTime
      ? new Date(formEndTime).toISOString()
      : new Date(new Date(startIso).getTime() + 3600 * 1000 * 2).toISOString();

    const newEv: ScheduledEvent = {
      id: `ev-${Date.now()}`,
      title: formTitle || "Live CSE Speed Drill",
      description: formDesc || "Synchronous review event with timed practice items.",
      category: formCategory,
      difficulty: formDifficulty,
      itemCount: formItemCount,
      durationMinutes: formDuration,
      scheduledTime: startIso,
      endTime: endIso,
      hostName: currentUserName,
      hostUserId: "admin-1",
      attendeesCount: 1,
      isAttending: true
    };

    setEvents([newEv, ...events]);
    setShowScheduleModal(false);
    setFormTitle("");
    setFormDesc("");
    setFormTime("");
    setFormEndTime("");
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Scheduled Review Events ({events.length})</h2>
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
      {events.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400 text-xs font-semibold">
          No scheduled events available. Click <span className="font-bold text-blue-600 dark:text-blue-400">+ Schedule Event</span> to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((ev) => {
            const nowMs = new Date().getTime();
            const startMs = new Date(ev.scheduledTime).getTime();
            const isLive = nowMs >= startMs;
            const isHost = ev.hostName === currentUserName;

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
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${getDifficultyBadgeStyle(ev.difficulty)}`}>
                        {ev.difficulty}
                      </span>
                      
                      {/* Host-Only Purge Button */}
                      {isHost && (
                        <button
                          onClick={() => handleDeleteEvent(ev.id, ev.title)}
                          className="group relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 hover:border-rose-400/80 shadow-xs hover:shadow-rose-500/25 transition-all duration-300 backdrop-blur-md overflow-hidden"
                          title="Purge Event (Host Only)"
                        >
                          <svg className="w-3 h-3 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="tracking-wider uppercase font-extrabold">Purge</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-black text-slate-900 dark:text-white">{ev.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{ev.description}</p>

                  <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs font-bold space-y-1">
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span>?? Start Time:</span>
                      <span className="font-mono">{new Date(ev.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {ev.endTime && (
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>?? End Time:</span>
                        <span className="font-mono">{new Date(ev.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <span>?? Drill Limit:</span>
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
                      <span>??</span> Join Live Session
                    </button>
                  ) : (
                    <button
                      onClick={() => setWaitingRoomEvent(ev)}
                      className="px-4 py-2 rounded-xl text-xs font-bold transition-all bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 flex items-center gap-1.5"
                    >
                      <span>?</span> Enter Pre-Event Lobby
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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

            <div className="grid grid-cols-2 gap-3">
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
            </div>

            <div className="grid grid-cols-2 gap-3">
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

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  required
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
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
                <div
                  className="mb-4 text-slate-900 dark:text-white"
                  dangerouslySetInnerHTML={{
                    __html: formatPromptHTML(
                      SAMPLE_DRILL_QUESTIONS[currentQuestionIdx % SAMPLE_DRILL_QUESTIONS.length].prompt
                    )
                  }}
                />

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
                      Next Question ?
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsFinished(true)}
                      className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 shadow-md"
                    >
                      Submit Drill ?
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="text-4xl">??</div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Drill Completed!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your live answers have been submitted to the group scoreboard.
                </p>

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

      {/* Pre-Event Live Waiting Room Lobby */}
      {waitingRoomEvent && (
        <LiveWaitingRoom
          eventName={waitingRoomEvent.title}
          startTime={new Date(waitingRoomEvent.scheduledTime)}
          initialUserCount={waitingRoomEvent.attendeesCount || 42}
          onEventStart={() => {
            const ev = waitingRoomEvent;
            setWaitingRoomEvent(null);
            handleLaunchDrill(ev);
          }}
          onClose={() => setWaitingRoomEvent(null)}
        />
      )}

      {/* Delete Event Confirmation Modal */}
      <DeleteEventModal
        isOpen={!!eventToDelete}
        eventTitle={eventToDelete?.title || ""}
        onConfirm={() => {
          if (eventToDelete) {
            setEvents((prev) => prev.filter((e) => e.id !== eventToDelete.id));
            setEventToDelete(null);
          }
        }}
        onCancel={() => setEventToDelete(null)}
      />
    </div>
  );
}
