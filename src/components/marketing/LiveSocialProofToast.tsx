"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Zap, Sparkles, Trophy, X } from "lucide-react";

interface SocialProofEvent {
  id: string;
  name: string;
  location: string;
  action: string;
  detail: string;
  icon: "check" | "zap" | "sparkles" | "trophy";
  timeAgo: string;
}

const SAMPLE_EVENTS: SocialProofEvent[] = [
  {
    id: "sp-1",
    name: "Ralph D.",
    location: "Quezon City",
    action: "completed",
    detail: "Numerical Reasoning Mock Drill (94%)",
    icon: "trophy",
    timeAgo: "2 mins ago",
  },
  {
    id: "sp-2",
    name: "Maria Santos",
    location: "Iloilo City",
    action: "unlocked",
    detail: "1-Year Reviewer Pass",
    icon: "sparkles",
    timeAgo: "4 mins ago",
  },
  {
    id: "sp-3",
    name: "Christian B.",
    location: "Cebu",
    action: "finished",
    detail: "Full Timed Mock Exam 2 (88%)",
    icon: "check",
    timeAgo: "6 mins ago",
  },
  {
    id: "sp-4",
    name: "Jasmine T.",
    location: "Davao City",
    action: "scored",
    detail: "91% on Philippine Constitution Drill",
    icon: "zap",
    timeAgo: "9 mins ago",
  },
  {
    id: "sp-5",
    name: "Paulo M.",
    location: "Pampanga",
    action: "achieved",
    detail: "14-Day Study Streak Badge 🔥",
    icon: "trophy",
    timeAgo: "12 mins ago",
  },
  {
    id: "sp-6",
    name: "Andrea K.",
    location: "Baguio City",
    action: "unlocked",
    detail: "CSE Professional Review Bundle",
    icon: "sparkles",
    timeAgo: "15 mins ago",
  },
  {
    id: "sp-7",
    name: "Danilo V.",
    location: "Cavite",
    action: "completed",
    detail: "Verbal Ability Speed Drill (96%)",
    icon: "zap",
    timeAgo: "18 mins ago",
  },
];

export default function LiveSocialProofToast() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (isDismissed) return;

    // Initial show after 3 seconds of landing
    const initialTimer = setTimeout(() => {
      setIsVisible(true);
    }, 3000);

    // Loop interval: show for 6s, hide for 9s
    const interval = setInterval(() => {
      setIsVisible((prev) => {
        if (prev) {
          // Hide and advance index
          setCurrentIndex((idx) => (idx + 1) % SAMPLE_EVENTS.length);
          return false;
        } else {
          return true;
        }
      });
    }, 8500);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isDismissed]);

  if (isDismissed) return null;

  const current = SAMPLE_EVENTS[currentIndex];

  return (
    <div
      className={`fixed bottom-4 left-4 z-40 max-w-xs sm:max-w-sm transition-all duration-500 transform ${
        isVisible
          ? "translate-y-0 opacity-100 scale-100 pointer-events-auto"
          : "translate-y-6 opacity-0 scale-95 pointer-events-none"
      }`}
    >
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl shadow-black/60 flex items-start gap-3 text-left">
        {/* Icon Avatar */}
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mt-0.5">
          {current.icon === "trophy" && <Trophy className="w-5 h-5 text-amber-400" />}
          {current.icon === "sparkles" && <Sparkles className="w-5 h-5 text-purple-400" />}
          {current.icon === "zap" && <Zap className="w-5 h-5 text-emerald-400" />}
          {current.icon === "check" && <CheckCircle2 className="w-5 h-5 text-blue-400" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span className="font-bold text-slate-200 truncate">{current.name}</span>
            <span>•</span>
            <span className="text-slate-400 truncate">{current.location}</span>
          </div>
          <p className="text-xs text-slate-300 font-semibold mt-0.5 leading-snug">
            {current.action}{" "}
            <span className="text-emerald-400 font-bold">{current.detail}</span>
          </p>
          <span className="text-[10px] text-slate-500 block mt-1 font-mono">
            {current.timeAgo} • Verified Reviewee
          </span>
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="text-slate-500 hover:text-slate-300 p-1 -mr-1 -mt-1 rounded-lg hover:bg-slate-800 transition"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
