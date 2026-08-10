"use client";

import React, { useState, useEffect, useCallback } from "react";

interface Emote {
  id: number;
  symbol: string;
  xPosition: number;
}

interface LiveWaitingRoomProps {
  eventName: string;
  startTime: Date;
  initialUserCount?: number;
  onEventStart?: () => void;
  onClose?: () => void;
}

// Explicit Unicode escaping + Unique Item IDs to prevent shell character corruption & key collision
const AVAILABLE_EMOTES = [
  { id: "fire", symbol: "🔥" },      // ??
  { id: "clap", symbol: "👏" },      // ??
  { id: "bulb", symbol: "💡" },      // ??
  { id: "mindblown", symbol: "🤯" }, // ??
  { id: "flex", symbol: "💪" },      // ??
  { id: "hourglass", symbol: "⏳" }       // ?
];

export const LiveWaitingRoom: React.FC<LiveWaitingRoomProps> = ({
  eventName,
  startTime,
  initialUserCount = 142,
  onEventStart,
  onClose,
}) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: string; minutes: string; seconds: string } | null>(null);
  const [userCount, setUserCount] = useState(initialUserCount);
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const [isEventLive, setIsEventLive] = useState(false);

  const calculateTimeLeft = useCallback(() => {
    const difference = startTime.getTime() - new Date().getTime();

    if (difference <= 0) {
      if (!isEventLive) {
        setIsEventLive(true);
        onEventStart?.();
      }
      return null;
    }

    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((difference / 1000 / 60) % 60);
    const seconds = Math.floor((difference / 1000) % 60);

    return {
      hours: String(hours).padStart(2, "0"),
      minutes: String(minutes).padStart(2, "0"),
      seconds: String(seconds).padStart(2, "0"),
    };
  }, [startTime, isEventLive, onEventStart]);

  useEffect(() => {
    setTimeLeft(calculateTimeLeft());
    const timerInterval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining === null) {
        clearInterval(timerInterval);
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [calculateTimeLeft]);

  useEffect(() => {
    if (isEventLive) return;
    const joinInterval = setInterval(() => {
      setUserCount((prev) => prev + Math.floor(Math.random() * 3));
    }, 5000);

    return () => clearInterval(joinInterval);
  }, [isEventLive]);

  const handleAddEmote = (symbol: string) => {
    const newEmote: Emote = {
      id: Date.now() + Math.random(),
      symbol,
      xPosition: Math.random() * 80 + 10,
    };

    setEmotes((prev) => [...prev, newEmote]);

    setTimeout(() => {
      setEmotes((prev) => prev.filter((e) => e.id !== newEmote.id));
    }, 3000);
  };

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

  return (
    <>
      <style>{animationStyles}</style>

      <div className="fixed inset-0 z-50 bg-gray-950 text-white flex flex-col font-sans relative overflow-hidden animate-fade-in">
        {/* Floating Emote Overlay Layer */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {emotes.map((emote) => (
            <div
              key={emote.id}
              className="absolute bottom-0 text-4xl animate-float-fade-up pointer-events-none opacity-0"
              style={{ left: `${emote.xPosition}%` }}
            >
              {emote.symbol}
            </div>
          ))}
        </div>

        {/* Header */}
        <header className="w-full p-6 flex justify-between items-center border-b border-gray-800 z-20 bg-gray-950/80 backdrop-blur-sm sticky top-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤝</span>
            <h1 className="text-xl font-bold tracking-tight">Study Together Event Lobby</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 ${isEventLive ? "bg-emerald-600" : "bg-gray-800"}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${isEventLive ? "bg-white animate-pulse" : "bg-amber-400"}`}></span>
              <span className="text-sm font-semibold uppercase tracking-wider">
                {isEventLive ? "Live Now" : "In Lobby"}
              </span>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300 transition-all"
              >
                ? Exit Lobby
              </button>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-grow flex flex-col items-center justify-center p-6 text-center z-20 overflow-y-auto">
          <div className="max-w-3xl w-full flex flex-col items-center gap-6">
            <p className="text-lg text-purple-300 font-semibold">Featured Live Session</p>
            <h2 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tighter text-gray-50">
              {eventName}
            </h2>

            {/* User Counter */}
            <div className="flex items-center gap-4 mt-2 px-6 py-3 bg-gray-900 rounded-full border border-gray-800 shadow-xl">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
              </span>
              <p className="text-base md:text-lg font-medium">
                <strong className="text-2xl font-bold text-emerald-400 tabular-nums">{userCount.toLocaleString()}</strong>
                <span className="text-gray-300 ml-2">Examinees Waiting in Lobby</span>
              </p>
            </div>

            {/* Countdown Timer Section */}
            <div className="w-full mt-6 p-8 bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl relative overflow-hidden pulse-glow">
              {!isEventLive && timeLeft ? (
                <>
                  <p className="text-xl text-gray-400 mb-6 font-medium">The drill starts in...</p>

                  <div className="flex items-center justify-center gap-3 md:gap-6 tabular-nums">
                    {[timeLeft.hours, timeLeft.minutes, timeLeft.seconds].map((value, index) => (
                      <React.Fragment key={index}>
                        <div className="flex flex-col items-center">
                          <div className="flex gap-1">
                            {value.split("").map((char, charIndex) => (
                              <span
                                key={charIndex}
                                className="text-5xl md:text-7xl font-black bg-gray-800 p-4 rounded-xl shadow-inner min-w-[60px] md:min-w-[80px]"
                              >
                                {char}
                              </span>
                            ))}
                          </div>
                          <span className="text-xs uppercase tracking-widest mt-3 text-gray-500 font-bold">
                            {index === 0 ? "Hours" : index === 1 ? "Minutes" : "Seconds"}
                          </span>
                        </div>
                        {index < 2 && (
                          <span className="text-5xl md:text-7xl font-black text-purple-500 pb-8">:</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-4xl md:text-5xl font-black text-white animate-pulse">
                    GO! GO! GO! 🚀
                  </h3>
                  <p className="text-xl text-purple-200 mt-4">The drill has officially unlocked.</p>
                  <button
                    className="mt-6 px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-black rounded-full transition-all shadow-lg hover:scale-105"
                    onClick={() => onEventStart?.()}
                  >
                    🚀 Launch Exam Drill Now
                  </button>
                </>
              )}
            </div>

            <p className="text-xs text-gray-500 mt-6">
              Civil Service Reviewer Pro � Stay synced. Keep focused.
            </p>
          </div>
        </main>

        {/* Emote Reaction Footer */}
        <footer className="w-full p-4 flex flex-col items-center gap-3 border-t border-gray-800 z-30 bg-gray-950 sticky bottom-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tap to Hype Lobby</p>

          <div className="flex items-center gap-3 sm:gap-6 p-2.5 bg-gray-900 rounded-full border border-gray-800 shadow-inner">
            {AVAILABLE_EMOTES.map((item) => (
              <button
                key={item.id}
                onClick={() => handleAddEmote(item.symbol)}
                className="text-3xl md:text-4xl transform hover:scale-125 transition-transform duration-150 active:scale-95 active:opacity-70 focus:outline-none"
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
