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
import { HubNavIcons, SocialTab } from "@/components/social/HubNavIcons";
import { HubModuleCards } from "@/components/social/HubModuleCards";


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
    <div className="max-w-6xl mx-auto py-6 sm:py-8 px-3 sm:px-6 space-y-6 sm:space-y-8 text-slate-900">
      {/* HEADER BANNER WITH USER STUDY IDENTITY & STATUS CONTROLS */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white rounded-3xl p-5 sm:p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 sm:gap-6 shadow-xl shadow-purple-600/15 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 relative z-10 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 sm:px-3 py-1 bg-white/20 text-white rounded-full border border-white/30 backdrop-blur-md">
              Collaborative Study System
            </span>

            {/* Study Profile Identity Chip */}
            {studyProfile && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 bg-black/20 border border-white/20 rounded-full text-xs relative backdrop-blur-md">
                <span className="text-sm sm:text-base">{currentAvatarInfo.emoji}</span>
                <span className="font-extrabold text-white truncate max-w-[110px] sm:max-w-[140px]">
                  {studyProfile.displayName}
                </span>

                {completionData && (
                  <span className={`text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    completionData.isFullyComplete
                      ? "bg-emerald-400 text-slate-950 font-bold"
                      : "bg-white/30 text-white font-bold"
                  }`}>
                    {completionData.percentage}%
                  </span>
                )}

                {/* Interactive Status Selector Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className="flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full bg-white/15 border border-white/20 hover:bg-white/25 text-[10px] font-bold cursor-pointer transition text-white"
                    title="Change Availability Status"
                  >
                    <span className={`w-2 h-2 rounded-full ${presence?.dotColor || "bg-emerald-400"}`} />
                    <span>{presence?.label || "Online"}</span>
                    <span className="text-[8px] text-white/70">▼</span>
                  </button>

                  {/* Status Dropdown Menu */}
                  {showStatusDropdown && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 space-y-1 animate-fade-in text-slate-100">
                      <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Set Availability
                      </div>
                      {PRESENCE_CHOICES.map((choice) => (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => updatePresenceStatus(choice.id)}
                          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-slate-800 flex items-center justify-between text-xs text-left cursor-pointer transition"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${choice.dot}`} />
                            <span className="font-bold text-slate-200">{choice.label}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{choice.desc}</span>
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
          <p className="text-xs sm:text-sm text-purple-100 max-w-xl leading-relaxed font-medium">
            Review Civil Service topics alongside fellow examinees and classmates. Form study rooms, share practice questions, and track group progress.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 w-full md:w-auto relative z-10">
          <button
            type="button"
            onClick={() => setShowEditProfileModal(true)}
            className="flex-1 md:flex-initial px-3 sm:px-3.5 py-2.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition border border-white/20 cursor-pointer flex items-center justify-center gap-1.5 text-center backdrop-blur-md"
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

      {/* COMPACT SMALL-ICON HUB NAVIGATION */}
      <HubNavIcons
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        counts={counts}
      />

      {/* QUICK BREADCRUMB WHEN IN SUB-SECTIONS (MOBILE CONVENIENCE) */}
      {activeTab !== "OVERVIEW" && (
        <div className="flex md:hidden items-center justify-between px-3 py-2 bg-white/90 border border-slate-200/90 rounded-xl text-xs shadow-xs">
          <button
            onClick={() => setActiveTab("OVERVIEW")}
            className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1.5 cursor-pointer"
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
            <div className="bg-white border border-slate-200/90 p-4 sm:p-5 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block">Classmates Online</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-600">0</span>
              <span className="text-[10px] text-slate-500 block">0 total classmates</span>
            </div>

            <div className="bg-white border border-slate-200/90 p-4 sm:p-5 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block">Active Rooms</span>
              <span className="text-xl sm:text-2xl font-black text-blue-600">{counts.activeRooms}</span>
              <span className="text-[10px] text-slate-500 block">Available now</span>
            </div>

            <div className="bg-white border border-slate-200/90 p-4 sm:p-5 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block">Pending Invites</span>
              <span className="text-xl sm:text-2xl font-black text-amber-600">{counts.pendingClassmates}</span>
              <span className="text-[10px] text-slate-500 block">Requests pending</span>
            </div>

            <div className="bg-white border border-slate-200/90 p-4 sm:p-5 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block">Next Event</span>
              <span className="text-xs sm:text-sm font-black text-slate-800 block truncate">
                {counts.upcomingEvents > 0 ? `${counts.upcomingEvents} Scheduled` : "None Scheduled"}
              </span>
              <span className="text-[10px] text-slate-500 block">Check calendar</span>
            </div>
          </div>

          {/* ALL-IN-ONE HUB DASHBOARD SECTIONS (COMPACT DISCOVERABLE MODULE TILES) */}
          <HubModuleCards
            counts={counts}
            onSelectTab={(tab) => setActiveTab(tab)}
          />
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