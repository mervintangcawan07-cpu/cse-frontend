"use client";

import React, { useState, useEffect, useCallback } from "react";

interface Emote {
  id: string;
  symbol: string;
  xPosition: number;
}

interface LiveWaitingRoomProps {
  readonly eventName: string;
  readonly startTime: Date;
  readonly initialUserCount?: number;
  readonly onEventStart?: () => void;
  readonly onClose?: () => void;
}

interface TimeUnit {
  readonly label: string;
  readonly key: "hours" | "minutes" | "seconds";
  readonly value: string;
}

// Explicit Unicode escaping + Unique Item IDs to prevent shell character corruption & key collision
const AVAILABLE_EMOTES = [
  { id: "fire", symbol: "🔥" },
  { id: "clap", symbol: "👏" },
  { id: "bulb", symbol: "💡" },
  { id: "mindblown", symbol: "🤯" },
  { id: "flex", symbol: "💪" },
  { id: "hourglass", symbol: "⏳" },
] as const;

// Safe pseudorandom generator satisfying static security analyzers (SonarQube)
function getRandomInt(max: number): number {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] % max;
  }
  return Math.floor(Math.random() * max);
}

const animationStyles = `
  @keyframes float-fade-up {
    0% { transform: translateY(0); opacity: 0; }
    10% { opacity: 1; }
    80% { opacity: 1; }
    100% { transform: translateY(-400px); opacity: 0; }
  }
  .animate-float-fade-up {
    animation: float-fade-up 3s ease-out forwards;
  }
  .pulse-glow {
    box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.7);
    animation: pulse-glow 2s infinite;
  }
  @keyframes pulse-glow {
    0% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.7); }
    70% { box-shadow: 0 0 0 15px rgba(168, 85, 247, 0); }
    100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
  }
`;

export const LiveWaitingRoom: React.FC<LiveWaitingRoomProps> = ({
  eventName,
  startTime,
  initialUserCount = 142,
  onEventStart,
  onClose,
}) => {
  // Pure time calculator avoiding side-effects inside render or state transitions
  const computeTimeRemaining = useCallback(() => {
    const difference = startTime.getTime() - Date.now();
    if (difference <= 0) return null;

    const hours = Math.floor(difference / (1000 * 60 * 60));
    const minutes = Math.floor((difference / (1000 * 60)) % 60);
    const seconds = Math.floor((difference / 1000) % 60);

    return {
      hours: String(hours).padStart(2, "0"),
      minutes: String(minutes).padStart(2, "0"),
      seconds: String(seconds).padStart(2, "0"),
    };
  }, [startTime]);

  // 1. Fix: Lazy state initialization removes synchronous setState inside useEffect
  const [timeLeft, setTimeLeft] = useState<{ hours: string; minutes: string; seconds: string } | null>(
    () => computeTimeRemaining()
  );
  const [userCount, setUserCount] = useState(initialUserCount);
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const [isEventLive, setIsEventLive] = useState(() => startTime.getTime() <= Date.now());

  // Timer interval with clean tick handling
  useEffect(() => {
    if (isEventLive) return;

    const timerInterval = setInterval(() => {
      const remaining = computeTimeRemaining();
      setTimeLeft(remaining);

      if (remaining === null) {
        clearInterval(timerInterval);
        setIsEventLive(true);
        onEventStart?.();
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [computeTimeRemaining, isEventLive, onEventStart]);

  // 2. Fix: Uses crypto-safe PRNG helper for simulated audience increments
  useEffect(() => {
    if (isEventLive) return;

    const joinInterval = setInterval(() => {
      setUserCount((prev) => prev + getRandomInt(3));
    }, 5000);

    return () => clearInterval(joinInterval);
  }, [isEventLive]);

  // 3. Fix: useCallback prevents React 19 / Compiler impure render diagnostics
  const handleAddEmote = useCallback((symbol: string) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${getRandomInt(100000)}`;

    const newEmote: Emote = {
      id,
      symbol,
      xPosition: getRandomInt(80) + 10,
    };

    setEmotes((prev) => [...prev, newEmote]);

    setTimeout(() => {
      setEmotes((prev) => prev.filter((e) => e.id !== newEmote.id));
    }, 3000);
  }, []);

  // 4 & 5. Fix: Pre-structured units eliminate nested ternary & array-index keys
  const timeUnits: TimeUnit[] = timeLeft
    ? [
        { label: "Hours", key: "hours", value: timeLeft.hours },
        { label: "Minutes", key: "minutes", value: timeLeft.minutes },
        { label: "Seconds", key: "seconds", value: timeLeft.seconds },
      ]
    : [];

  return (
    <>
      <style>{animationStyles}</style>

      <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-gray-950 font-sans text-white animate-fade-in">
        {/* Floating Emote Overlay Layer */}
        <div className="pointer-events-none absolute inset-0 z-10">
          {emotes.map((emote) => (
            <div
              key={emote.id}
              className="pointer-events-none absolute bottom-0 text-4xl opacity-0 animate-float-fade-up"
              style={{ left: `${emote.xPosition}%` }}
            >
              {emote.symbol}
            </div>
          ))}
        </div>

        {/* Header */}
        <header className="sticky top-0 z-20 flex w-full items-center justify-between border-b border-gray-800 bg-gray-950/80 p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">🤝</span>
            <h1 className="text-xl font-bold tracking-tight">Study Together Event Lobby</h1>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 ${
                isEventLive ? "bg-emerald-600" : "bg-gray-800"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isEventLive ? "animate-pulse bg-white" : "bg-amber-400"
                }`}
              />
              <span className="text-sm font-semibold uppercase tracking-wider">
                {isEventLive ? "Live Now" : "In Lobby"}
              </span>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-gray-800 px-3 py-1.5 text-xs font-bold text-gray-300 transition-all hover:bg-gray-700"
              >
                ✕ Exit Lobby
              </button>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="z-20 flex flex-grow flex-col items-center justify-center overflow-y-auto p-6 text-center">
          <div className="flex w-full max-w-3xl flex-col items-center gap-6">
            <p className="text-lg font-semibold text-purple-300">Featured Live Session</p>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tighter text-gray-50 md:text-6xl">
              {eventName}
            </h2>

            {/* User Counter */}
            <div className="mt-2 flex items-center gap-4 rounded-full border border-gray-800 bg-gray-900 px-6 py-3 shadow-xl">
              <span className="relative flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500" />
              </span>
              <p className="text-base font-medium md:text-lg">
                <strong className="text-2xl font-bold tabular-nums text-emerald-400">
                  {userCount.toLocaleString()}
                </strong>
                <span className="ml-2 text-gray-300">Examinees Waiting in Lobby</span>
              </p>
            </div>

            {/* Countdown Timer Section */}
            <div className="relative mt-6 w-full overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 p-8 shadow-2xl pulse-glow">
              {!isEventLive && timeLeft ? (
                <>
                  <p className="mb-6 text-xl font-medium text-gray-400">The drill starts in...</p>

                  <div className="flex items-center justify-center gap-3 tabular-nums md:gap-6">
                    {timeUnits.map((unit, index) => (
                      <React.Fragment key={unit.key}>
                        <div className="flex flex-col items-center">
                          <div className="flex gap-1">
                            {unit.value.split("").map((char, charIdx) => (
                              <span
                                key={`${unit.key}-digit-${charIdx}`}
                                className="min-w-[60px] rounded-xl bg-gray-800 p-4 text-5xl font-black shadow-inner md:min-w-[80px] md:text-7xl"
                              >
                                {char}
                              </span>
                            ))}
                          </div>
                          <span className="mt-3 text-xs font-bold uppercase tracking-widest text-gray-500">
                            {unit.label}
                          </span>
                        </div>

                        {index < 2 && (
                          <span className="pb-8 text-5xl font-black text-purple-500 md:text-7xl">
                            :
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="animate-pulse text-4xl font-black text-white md:text-5xl">
                    GO! GO! GO! 🚀
                  </h3>
                  <p className="mt-4 text-xl text-purple-200">The drill has officially unlocked.</p>
                  <button
                    type="button"
                    className="mt-6 rounded-full bg-emerald-600 px-10 py-4 text-lg font-black text-white shadow-lg transition-all hover:scale-105 hover:bg-emerald-500"
                    onClick={() => onEventStart?.()}
                  >
                    🚀 Launch Exam Drill Now
                  </button>
                </>
              )}
            </div>

            <p className="mt-6 text-xs text-gray-500">
              GovStudyX Study Room • Stay synced. Keep focused.
            </p>
          </div>
        </main>

        {/* Emote Reaction Footer */}
        <footer className="sticky bottom-0 z-30 flex w-full flex-col items-center gap-3 border-t border-gray-800 bg-gray-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Tap to Hype Lobby
          </p>

          <div className="flex items-center gap-3 rounded-full border border-gray-800 bg-gray-900 p-2.5 shadow-inner sm:gap-6">
            {AVAILABLE_EMOTES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleAddEmote(item.symbol)}
                className="transform text-3xl transition-transform duration-150 hover:scale-125 focus:outline-none active:scale-95 active:opacity-70 md:text-4xl"
                aria-label={`React with ${item.id}`}
              >
                {item.symbol}
              </button>
            ))}
          </div>
        </footer>
      </div>
    </>
  );
};

export default LiveWaitingRoom;