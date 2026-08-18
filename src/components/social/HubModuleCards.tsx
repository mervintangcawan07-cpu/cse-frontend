// Relative Path: src/components/social/HubModuleCards.tsx
"use client";

import React from "react";
import { SocialTab } from "./HubNavIcons";

interface HubModuleCardsProps {
  counts: {
    unreadNotifications: number;
    pendingClassmates: number;
    unreadMessages: number;
    activeRooms: number;
    upcomingEvents: number;
    clubsCount: number;
  };
  onSelectTab: (tab: SocialTab) => void;
}

export const HubModuleCards: React.FC<HubModuleCardsProps> = ({
  counts,
  onSelectTab,
}) => {
  const modules = [
    {
      tab: "ROOMS" as SocialTab,
      title: "Study Rooms",
      icon: "🎧",
      iconBg: "bg-blue-50 text-blue-600 border-blue-100",
      badge: `${counts.activeRooms} Active`,
      badgeStyle: "bg-blue-50 text-blue-700 border-blue-200",
      description: "Collaborative audio rooms, interactive whiteboards, and synchronized group question review.",
      actionText: "Enter Study Rooms",
      btnBg: "bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20",
    },
    {
      tab: "CLASSMATES" as SocialTab,
      title: "Classmates & 1v1 Duels",
      icon: "🧑‍🎓",
      iconBg: "bg-emerald-50 text-emerald-600 border-emerald-100",
      badge: counts.pendingClassmates > 0 ? `${counts.pendingClassmates} Pending` : "1v1 Duels Ready",
      badgeStyle: counts.pendingClassmates > 0
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "Connect with examinees targeting your CSE exam date, track buddies, and challenge peers to direct live duels.",
      actionText: "Find Classmates & Duel",
      btnBg: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-500/20",
    },
    {
      tab: "MESSAGES" as SocialTab,
      title: "Messages & Chat",
      icon: "💬",
      iconBg: "bg-rose-50 text-rose-600 border-rose-100",
      badge: counts.unreadMessages > 0 ? `${counts.unreadMessages} New` : "Private Chat",
      badgeStyle: counts.unreadMessages > 0
        ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse font-extrabold"
        : "bg-slate-100 text-slate-600 border-slate-200",
      description: "One-on-one direct chats and study buddy coordination with instant read receipts and presence indicators.",
      actionText: "Open Messages",
      btnBg: "bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20",
    },
    {
      tab: "EVENTS" as SocialTab,
      title: "Study Events",
      icon: "📅",
      iconBg: "bg-purple-50 text-purple-600 border-purple-100",
      badge: counts.upcomingEvents > 0 ? `${counts.upcomingEvents} Scheduled` : "Calendar",
      badgeStyle: "bg-purple-50 text-purple-700 border-purple-200",
      description: "Community mock exams, scheduled cram sessions, and focused topic drills with calendar RSVP reminders.",
      actionText: "View Study Events",
      btnBg: "bg-purple-600 hover:bg-purple-500 text-white shadow-sm shadow-purple-500/20",
    },
    {
      tab: "CLUBS" as SocialTab,
      title: "Study Clubs",
      icon: "🏛️",
      iconBg: "bg-indigo-50 text-indigo-600 border-indigo-100",
      badge: counts.clubsCount > 0 ? `${counts.clubsCount} Joined` : "Communities",
      badgeStyle: "bg-indigo-50 text-indigo-700 border-indigo-200",
      description: "Join topic-focused groups (Verbal, Math, Clerical, General Information) or found your own review club.",
      actionText: "Explore Study Clubs",
      btnBg: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20",
    },
    {
      tab: "NOTIFICATIONS" as SocialTab,
      title: "Alerts & Activity",
      icon: "🔔",
      iconBg: "bg-amber-50 text-amber-600 border-amber-100",
      badge: counts.unreadNotifications > 0 ? `${counts.unreadNotifications} Unread` : "All Caught Up",
      badgeStyle: counts.unreadNotifications > 0
        ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse font-extrabold"
        : "bg-slate-100 text-slate-600 border-slate-200",
      description: "Real-time duel invitations, classmate requests, club announcements, and room notification history.",
      actionText: "Check Activity Alerts",
      btnBg: "bg-slate-800 hover:bg-slate-700 text-white shadow-sm",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
          <span>⚡</span>
          <span>Study Together Hub Modules</span>
        </h2>
        <span className="text-[11px] text-slate-500 hidden sm:inline font-semibold">
          Explore all collaboration tools
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {modules.map((mod) => (
          <div
            key={mod.tab}
            className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3 shadow-xs hover:shadow-md transition-all group"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center text-lg group-hover:scale-105 transition-transform ${mod.iconBg}`}
                >
                  <span>{mod.icon}</span>
                </div>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${mod.badgeStyle}`}
                >
                  {mod.badge}
                </span>
              </div>

              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  {mod.title}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-2">
                  {mod.description}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectTab(mod.tab)}
              className={`w-full py-2 px-3 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${mod.btnBg}`}
            >
              <span>{mod.actionText}</span>
              <span className="text-xs">&rarr;</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
