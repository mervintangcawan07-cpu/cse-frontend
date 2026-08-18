// Relative Path: src/components/social/HubNavIcons.tsx
"use client";

import React from "react";

export type SocialTab = "OVERVIEW" | "CLASSMATES" | "MESSAGES" | "ROOMS" | "EVENTS" | "CLUBS" | "NOTIFICATIONS";

interface HubNavIconsProps {
  activeTab: SocialTab;
  onSelectTab: (tab: SocialTab) => void;
  counts: {
    unreadNotifications: number;
    pendingClassmates: number;
    unreadMessages: number;
    activeRooms: number;
    upcomingEvents: number;
    clubsCount: number;
  };
}

interface TabItem {
  id: SocialTab;
  label: string;
  shortLabel: string;
  icon: string;
  badgeCount: number;
  badgeBg: string;
}

export const HubNavIcons: React.FC<HubNavIconsProps> = ({
  activeTab,
  onSelectTab,
  counts,
}) => {
  const tabs: TabItem[] = [
    {
      id: "OVERVIEW",
      label: "Overview",
      shortLabel: "Hub",
      icon: "📊",
      badgeCount: 0,
      badgeBg: "bg-blue-600 text-white",
    },
    {
      id: "CLASSMATES",
      label: "Classmates",
      shortLabel: "Classmates",
      icon: "🧑‍🎓",
      badgeCount: counts.pendingClassmates,
      badgeBg: "bg-amber-500 text-slate-950",
    },
    {
      id: "MESSAGES",
      label: "Messages",
      shortLabel: "Messages",
      icon: "💬",
      badgeCount: counts.unreadMessages,
      badgeBg: "bg-rose-500 text-white animate-pulse",
    },
    {
      id: "ROOMS",
      label: "Study Rooms",
      shortLabel: "Rooms",
      icon: "🎧",
      badgeCount: counts.activeRooms,
      badgeBg: "bg-emerald-600 text-white",
    },
    {
      id: "EVENTS",
      label: "Events",
      shortLabel: "Events",
      icon: "📅",
      badgeCount: counts.upcomingEvents,
      badgeBg: "bg-purple-600 text-white",
    },
    {
      id: "CLUBS",
      label: "Clubs",
      shortLabel: "Clubs",
      icon: "🏛️",
      badgeCount: counts.clubsCount,
      badgeBg: "bg-indigo-600 text-white",
    },
    {
      id: "NOTIFICATIONS",
      label: "Alerts",
      shortLabel: "Alerts",
      icon: "🔔",
      badgeCount: counts.unreadNotifications,
      badgeBg: "bg-rose-600 text-white animate-pulse",
    },
  ];

  return (
    <div className="w-full">
      {/* MOBILE COMPACT ICON BAR (< md) */}
      <div className="block md:hidden bg-slate-100/90 border border-slate-200/90 p-1.5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 px-0.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`relative shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25 font-black scale-[1.02]"
                    : "bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/60"
                }`}
                title={tab.label}
              >
                <span className="text-sm">{tab.icon}</span>
                <span className="text-[11px] whitespace-nowrap">{tab.shortLabel}</span>
                {tab.badgeCount > 0 && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 text-[9px] font-black rounded-full leading-tight shrink-0 shadow-xs ${
                      isActive ? "bg-white text-blue-700 font-extrabold" : tab.badgeBg
                    }`}
                  >
                    {tab.badgeCount > 99 ? "99+" : tab.badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* DESKTOP SLEEK PILL NAVIGATION (md+) */}
      <div className="hidden md:flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 shadow-xs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200/80 font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent"
              }`}
            >
              <span className="text-sm">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badgeCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-black rounded-full leading-none shrink-0 shadow-xs ${tab.badgeBg}`}
                >
                  {tab.badgeCount > 99 ? "99+" : tab.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
