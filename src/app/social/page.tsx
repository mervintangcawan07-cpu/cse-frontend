// Relative Path: src/app/social/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ClassmatesSection from "@/components/social/ClassmatesSection";
import MessagesSection from "@/components/social/MessagesSection";
import StudyRoomsSection from "@/components/social/StudyRoomsSection";
import StudyEventsSection from "@/components/social/StudyEventsSection";
import StudyClubsSection from "@/components/social/StudyClubsSection";
import NotificationsSection from "@/components/social/NotificationsSection";
import StudyTogetherOnboarding from "@/components/social/profile/StudyTogetherOnboarding";
import { EditStudyProfileModal } from "@/components/social/profile/EditStudyProfileModal";
import { ProfileCompletionCard } from "@/components/social/profile/ProfileCompletionCard";
import { ProfileCompletionResult } from "@/lib/social/profileCompletion";
import { ResolvedPresence } from "@/lib/social/presence";
import { PresenceBadge } from "@/components/social/presence/PresenceBadge";

type SocialTab = "OVERVIEW" | "CLASSMATES" | "MESSAGES" | "ROOMS" | "EVENTS" | "CLUBS" | "NOTIFICATIONS";

const AVATAR_MAP: Record<string, { emoji: string; bg: string }> = {
  "avatar-owl": { emoji: "🦉", bg: "from-amber-600 to-yellow-500" },
  "avatar-scholar": { emoji: "📚", bg: "from-blue-600 to-indigo-500" },
  "avatar-grad": { emoji: "🧑‍🎓", bg: "from-emerald-600 to-teal-500" },
  "avatar-brain": { emoji: "🧠", bg: "from-purple-600 to-pink-500" },
  "avatar-rocket": { emoji: "🚀", bg: "from-rose-600 to-orange-500" },
  "avatar-target": { emoji: "🎯", bg: "from-cyan-600 to-blue-500" },
  "avatar-fox": { emoji: "🦊", bg: "from-orange-600 to-amber-500" },
  "avatar-star": { emoji: "⭐", bg: "from-yellow-600 to-amber-400" },
};

const PRESENCE_CHOICES = [
  { id: "ONLINE", label: "Online", desc: "Available for study", dot: "bg-emerald-400", emoji: "🟢" },
  { id: "AWAY", label: "Away", desc: "Taking a break", dot: "bg-amber-400", emoji: "🟡" },
  { id: "BUSY", label: "Busy", desc: "In focus mode", dot: "bg-rose-500", emoji: "🔴" },
  { id: "OFFLINE", label: "Invisible", desc: "Appear offline", dot: "bg-slate-500", emoji: "⚪" },
];

export default function SocialDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [studyProfile, setStudyProfile] = useState<any>(null);
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(null);
  const [completionData, setCompletionData] = useState<ProfileCompletionResult | null>(null);
  const [presence, setPresence] = useState<ResolvedPresence | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SocialTab>("OVERVIEW");

  const [counts, setCounts] = useState({
    unreadNotifications: 0,
    pendingClassmates: 0,
    unreadMessages: 0,
    activeRooms: 0,
    upcomingEvents: 0,
    clubsCount: 0,
  });

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/social/profile");
      if (res.ok) {
        const data = await res.json();
        setStudyProfile(data.profile || null);
        setProfileCompleted(Boolean(data.profileCompleted));
        if (data.completion) {
          setCompletionData(data.completion);
        }
        if (data.presence) {
          setPresence(data.presence);
        }
      }
    } catch (err) {
      console.error("Failed to fetch study profile:", err);
    }
  };

  const updatePresenceStatus = async (newStatus: string) => {
    setShowStatusDropdown(false);
    try {
      const res = await fetch("/api/social/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presenceStatus: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.presence) {
          setPresence(data.presence);
        }
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const fetchBadgeCounts = async () => {
    try {
      const res = await fetch("/api/social/counts");
      if (res.ok) {
        const data = await res.json();
        if (data.counts) {
          setCounts(data.counts);
        }
      }
    } catch (err) {
      console.error("Failed to fetch badge counts:", err);
    }
  };

  useEffect(() => {
    async function checkAuthAndProfile() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            await fetchProfile();
          } else {
            router.push("/login");
          }
        } else {
          router.push("/login");
        }
      } catch (err) {
        console.error("Auth error in social hub:", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndProfile();
    fetchBadgeCounts();

    // Smart 15s polling that pauses when window/tab is hidden
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchBadgeCounts();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [router]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-24 text-center font-bold text-slate-400 animate-pulse space-y-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Loading Study Together Hub...
        </p>
      </div>
    );
  }

  // 🔒 FIRST-TIME ENTRY GUARD: If user has not completed their Study Together profile, show friendly onboarding flow
  if (profileCompleted === false) {
    return (
      <StudyTogetherOnboarding
        initialDisplayName={user?.name || ""}
        onComplete={async () => {
          await fetchProfile();
          await fetchBadgeCounts();
        }}
      />
    );
  }

  const getBadgeCount = (tabId: SocialTab) => {
    switch (tabId) {
      case "CLASSMATES":
        return counts.pendingClassmates;
      case "MESSAGES":
        return counts.unreadMessages;
      case "ROOMS":
        return counts.activeRooms;
      case "EVENTS":
        return counts.upcomingEvents;
      case "CLUBS":
        return counts.clubsCount;
      case "NOTIFICATIONS":
        return counts.unreadNotifications;
      default:
        return 0;
    }
  };

  const getBadgeColor = (tabId: SocialTab) => {
    switch (tabId) {
      case "CLASSMATES":
        return "bg-amber-500 text-slate-950";
      case "MESSAGES":
        return "bg-rose-500 text-white animate-pulse";
      case "ROOMS":
        return "bg-emerald-500 text-slate-950";
      case "EVENTS":
        return "bg-purple-500 text-white";
      case "CLUBS":
        return "bg-indigo-500 text-white";
      case "NOTIFICATIONS":
        return "bg-rose-600 text-white animate-pulse";
      default:
        return "bg-blue-600 text-white";
    }
  };

  const tabs: { id: SocialTab; label: string; icon: string }[] = [
    { id: "OVERVIEW", label: "Overview", icon: "📊" },
    { id: "CLASSMATES", label: "Classmates", icon: "🧑‍🎓" },
    { id: "MESSAGES", label: "Messages", icon: "💬" },
    { id: "ROOMS", label: "Study Rooms", icon: "🎧" },
    { id: "EVENTS", label: "Events", icon: "📅" },
    { id: "CLUBS", label: "Clubs", icon: "🏛️" },
    { id: "NOTIFICATIONS", label: "Alerts", icon: "🔔" },
  ];

  const currentAvatarInfo = studyProfile?.avatar && AVATAR_MAP[studyProfile.avatar]
    ? AVATAR_MAP[studyProfile.avatar]
    : { emoji: "🧑‍🎓", bg: "from-blue-600 to-indigo-500" };

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-8 px-3 sm:px-6 space-y-6 sm:space-y-8 text-slate-100">
      {/* HEADER BANNER WITH USER STUDY IDENTITY & STATUS CONTROLS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 sm:gap-6 shadow-xl relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 relative z-10 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 sm:px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
              Collaborative Study System
            </span>

            {/* Study Profile Identity Chip */}
            {studyProfile && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 bg-slate-950/80 border border-slate-800 rounded-full text-xs relative">
                <span className="text-sm sm:text-base">{currentAvatarInfo.emoji}</span>
                <span className="font-extrabold text-white truncate max-w-[110px] sm:max-w-[140px]">
                  {studyProfile.displayName}
                </span>

                {completionData && (
                  <span className={`text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    completionData.isFullyComplete
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-blue-500/20 text-blue-300"
                  }`}>
                    {completionData.percentage}%
                  </span>
                )}

                {/* Interactive Status Selector Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className="flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 hover:border-slate-600 text-[10px] font-bold cursor-pointer transition"
                    title="Change Availability Status"
                  >
                    <span className={`w-2 h-2 rounded-full ${presence?.dotColor || "bg-emerald-400"}`} />
                    <span>{presence?.label || "Online"}</span>
                    <span className="text-[8px] text-slate-500">▼</span>
                  </button>

                  {/* Status Dropdown Menu */}
                  {showStatusDropdown && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 space-y-1 animate-fade-in">
                      <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Set Availability
                      </div>
                      {PRESENCE_CHOICES.map((choice) => (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => updatePresenceStatus(choice.id)}
                          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-slate-900 flex items-center justify-between text-xs text-left cursor-pointer transition"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${choice.dot}`} />
                            <span className="font-bold text-slate-200">{choice.label}</span>
                          </div>
                          <span className="text-[10px] text-slate-500">{choice.desc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white mt-1">
            Study Together Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl leading-relaxed">
            Review Civil Service topics alongside fellow examinees and classmates. Form study rooms, share practice questions, and track group progress.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 w-full md:w-auto relative z-10">
          <button
            type="button"
            onClick={() => setShowEditProfileModal(true)}
            className="flex-1 md:flex-initial px-3 sm:px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 cursor-pointer flex items-center justify-center gap-1.5 text-center"
            title="Edit Study Together Profile & Status"
          >
            <span>✏️</span>
            <span>Edit Profile</span>
          </button>

          <Link
            href="/dashboard"
            className="flex-1 md:flex-initial px-3 sm:px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 text-center"
          >
            &larr; Dashboard
          </Link>
        </div>
      </div>

      {/* MOBILE HIGH-VISIBILITY NAVIGATION GRID (< md) */}
      <div className="block md:hidden bg-slate-900/90 border border-slate-800 p-2 rounded-2xl shadow-lg">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 pb-1.5 flex items-center justify-between">
          <span>Hub Navigation</span>
          <span className="text-slate-500">Tap to switch view</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          {tabs.map((tab) => {
            const badgeCount = getBadgeCount(tab.id);
            const badgeColor = getBadgeColor(tab.id);
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex flex-col items-center justify-center gap-1 relative text-center ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 font-black border border-blue-400"
                    : "bg-slate-950/70 text-slate-300 hover:text-white border border-slate-800/80 hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-base">{tab.icon}</span>
                  {badgeCount > 0 && (
                    <span className={`px-1 py-0.2 text-[9px] font-black rounded-full leading-tight shrink-0 ${badgeColor}`}>
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] truncate max-w-full leading-tight">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* DESKTOP SUB-NAVIGATION TABS (md+) */}
      <div className="hidden md:flex border-b border-slate-800 gap-1 overflow-x-auto pb-1 scrollbar-none pt-2">
        {tabs.map((tab) => {
          const badgeCount = getBadgeCount(tab.id);
          const badgeColor = getBadgeColor(tab.id);

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-4 text-xs font-bold transition border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-2 relative ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400 font-black"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {badgeCount > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] font-black rounded-full leading-none shrink-0 ${badgeColor}`}>
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* QUICK BREADCRUMB WHEN IN SUB-SECTIONS (MOBILE CONVENIENCE) */}
      {activeTab !== "OVERVIEW" && (
        <div className="flex md:hidden items-center justify-between px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs">
          <button
            onClick={() => setActiveTab("OVERVIEW")}
            className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <span>&larr;</span>
            <span>Back to Hub Dashboard</span>
          </button>
          <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
            {tabs.find((t) => t.id === activeTab)?.label}
          </span>
        </div>
      )}

      {/* TAB CONTENT AREAS */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-6">
          {/* PROFILE COMPLETION & IDENTITY CARD */}
          <ProfileCompletionCard
            completion={completionData}
            onOpenEditModal={() => setShowEditProfileModal(true)}
          />

          {/* STATS SUMMARY GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-1">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Classmates Online</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400">0</span>
              <span className="text-[10px] text-slate-500 block">0 total classmates</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-1">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Active Rooms</span>
              <span className="text-xl sm:text-2xl font-black text-blue-400">{counts.activeRooms}</span>
              <span className="text-[10px] text-slate-500 block">Available now</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-1">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Pending Invites</span>
              <span className="text-xl sm:text-2xl font-black text-amber-400">{counts.pendingClassmates}</span>
              <span className="text-[10px] text-slate-500 block">Requests pending</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-1">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Next Event</span>
              <span className="text-xs sm:text-sm font-black text-slate-300 block truncate">
                {counts.upcomingEvents > 0 ? `${counts.upcomingEvents} Scheduled` : "None Scheduled"}
              </span>
              <span className="text-[10px] text-slate-500 block">Check calendar</span>
            </div>
          </div>

          {/* ALL-IN-ONE HUB DASHBOARD SECTIONS (DISCOVERABLE TILES) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>⚡</span>
                <span>Study Together Hub Modules</span>
              </h2>
              <span className="text-[11px] text-slate-400 hidden sm:inline font-semibold">
                Explore all collaboration tools
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {/* 1. STUDY ROOMS */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-blue-500/50 transition shadow-lg group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xl group-hover:scale-110 transition">
                      🎧
                    </span>
                    <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded-full border border-blue-500/30">
                      {counts.activeRooms} Active
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Study Rooms</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Collaborative audio rooms, interactive whiteboards, and synchronized group question review.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("ROOMS")}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20"
                >
                  <span>Enter Study Rooms</span>
                  <span>&rarr;</span>
                </button>
              </div>

              {/* 2. CLASSMATES & 1V1 DUELS */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-emerald-500/50 transition shadow-lg group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xl group-hover:scale-110 transition">
                      🧑‍🎓
                    </span>
                    {counts.pendingClassmates > 0 ? (
                      <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded-full border border-amber-500/30">
                        {counts.pendingClassmates} Pending Request
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-500/30">
                        1v1 Duels Ready
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Classmates & 1v1 Duels</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Connect with examinees targeting your CSE exam date, track buddies, and challenge peers to direct live duels.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("CLASSMATES")}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                >
                  <span>Find Classmates & Duel</span>
                  <span>&rarr;</span>
                </button>
              </div>

              {/* 3. DIRECT MESSAGES */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-rose-500/50 transition shadow-lg group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xl group-hover:scale-110 transition">
                      💬
                    </span>
                    {counts.unreadMessages > 0 ? (
                      <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 text-[10px] font-bold rounded-full border border-rose-500/30 animate-pulse">
                        {counts.unreadMessages} New Message{counts.unreadMessages > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-800 text-slate-400 text-[10px] font-bold rounded-full">
                        Private Chat
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Messages & Chat</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      One-on-one direct chats and study buddy coordination with instant read receipts and presence indicators.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("MESSAGES")}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20"
                >
                  <span>Open Messages</span>
                  <span>&rarr;</span>
                </button>
              </div>

              {/* 4. EVENTS & TIMED SESSIONS */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-purple-500/50 transition shadow-lg group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-xl group-hover:scale-110 transition">
                      📅
                    </span>
                    <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 text-[10px] font-bold rounded-full border border-purple-500/30">
                      {counts.upcomingEvents > 0 ? `${counts.upcomingEvents} Scheduled` : "Calendar"}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Study Events</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Community mock exams, scheduled cram sessions, and focused topic drills with calendar RSVP reminders.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("EVENTS")}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20"
                >
                  <span>View Study Events</span>
                  <span>&rarr;</span>
                </button>
              </div>

              {/* 5. STUDY CLUBS */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-indigo-500/50 transition shadow-lg group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-xl group-hover:scale-110 transition">
                      🏛️
                    </span>
                    <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-full border border-indigo-500/30">
                      {counts.clubsCount > 0 ? `${counts.clubsCount} Joined` : "Communities"}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Study Clubs</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Join topic-focused groups (Verbal, Math, Clerical, General Information) or found your own review club.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("CLUBS")}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
                >
                  <span>Explore Study Clubs</span>
                  <span>&rarr;</span>
                </button>
              </div>

              {/* 6. ALERTS & NOTIFICATIONS */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-amber-500/50 transition shadow-lg group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xl group-hover:scale-110 transition">
                      🔔
                    </span>
                    {counts.unreadNotifications > 0 ? (
                      <span className="px-2.5 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-full animate-pulse">
                        {counts.unreadNotifications} Unread Alert{counts.unreadNotifications > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-800 text-slate-400 text-[10px] font-bold rounded-full">
                        All Caught Up
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Alerts & Activity</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Real-time duel invitations, classmate requests, club announcements, and room notification history.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("NOTIFICATIONS")}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Check Activity Alerts</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "CLASSMATES" && <ClassmatesSection />}
      {activeTab === "MESSAGES" && <MessagesSection />}
      {activeTab === "ROOMS" && <StudyRoomsSection />}
      {activeTab === "EVENTS" && <StudyEventsSection />}
      {activeTab === "CLUBS" && <StudyClubsSection />}
      {activeTab === "NOTIFICATIONS" && (
        <NotificationsSection onNavigateTab={(tab) => setActiveTab(tab)} />
      )}

      {/* EDIT STUDY PROFILE MODAL */}
      <EditStudyProfileModal
        isOpen={showEditProfileModal}
        initialProfile={studyProfile}
        onClose={() => setShowEditProfileModal(false)}
        onProfileUpdated={async () => {
          await fetchProfile();
        }}
      />
    </div>
  );
}