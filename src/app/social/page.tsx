// Relative Path: src/app/social/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SOCIAL_COUNTS_POLL_INTERVAL_MS = 30000; // 30 seconds while visible
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
import { StudyCommonsSection } from "@/components/social/commons/StudyCommonsSection";


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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
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
    setShowProfileMenu(false);
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

  const countsInFlightRef = useRef(false);
  const lastCountsFetchTimeRef = useRef(0);
  const countsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBadgeCounts = useCallback(async (isManual = false) => {
    if (countsInFlightRef.current) return;
    if (!isManual && typeof document !== "undefined" && document.hidden) return;
    if (!isManual && typeof navigator !== "undefined" && !navigator.onLine) return;

    countsInFlightRef.current = true;
    try {
      const res = await fetch("/api/social/counts");
      if (res.ok) {
        const data = await res.json();
        if (data.counts) {
          setCounts(data.counts);
        }
      }
      lastCountsFetchTimeRef.current = Date.now();
    } catch (err) {
      console.error("Failed to fetch badge counts:", err);
    } finally {
      countsInFlightRef.current = false;
    }
  }, []);

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
  }, [router]);

  // Dedicated 30s visibility-aware and in-flight guarded polling loop for aggregate badge counts
  useEffect(() => {
    const resetTimer = () => {
      if (countsTimerRef.current) {
        clearInterval(countsTimerRef.current);
        countsTimerRef.current = null;
      }
      if (typeof document !== "undefined" && document.hidden) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      countsTimerRef.current = setInterval(() => {
        void fetchBadgeCounts();
      }, SOCIAL_COUNTS_POLL_INTERVAL_MS);
    };

    const handleVisibilityOrOnline = () => {
      const isVisible = typeof document !== "undefined" && !document.hidden;
      const isOnline = typeof navigator === "undefined" || navigator.onLine;

      if (!isVisible || !isOnline) {
        if (countsTimerRef.current) {
          clearInterval(countsTimerRef.current);
          countsTimerRef.current = null;
        }
        return;
      }

      const now = Date.now();
      const isStale = now - lastCountsFetchTimeRef.current >= SOCIAL_COUNTS_POLL_INTERVAL_MS;
      if (isStale) {
        void fetchBadgeCounts();
      }
      resetTimer();
    };

    void fetchBadgeCounts();
    resetTimer();

    document.addEventListener("visibilitychange", handleVisibilityOrOnline);
    window.addEventListener("online", handleVisibilityOrOnline);
    window.addEventListener("offline", handleVisibilityOrOnline);

    return () => {
      if (countsTimerRef.current) {
        clearInterval(countsTimerRef.current);
        countsTimerRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityOrOnline);
      window.removeEventListener("online", handleVisibilityOrOnline);
      window.removeEventListener("offline", handleVisibilityOrOnline);
    };
  }, [fetchBadgeCounts]);

  if (loading) {
    return (
      <div className="w-full py-24 text-center font-bold text-slate-400 animate-pulse space-y-3">
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
    <div className="w-full py-3 sm:py-6 px-2 sm:px-4 md:px-6 lg:px-8 space-y-3 sm:space-y-6 text-slate-900">
      {/* MINIMIZED SLEEK TOP PROFILE & BRAND BAR */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-lg shadow-purple-600/10 relative">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Brand & Hub Identity */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("OVERVIEW")}
              className="flex items-center gap-2 group cursor-pointer text-left"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-base sm:text-lg backdrop-blur-md group-hover:scale-105 transition shrink-0">
                👥
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-base font-black text-white tracking-tight">
                    Study Together
                  </span>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-white/20 rounded-full border border-white/30 text-purple-100">
                    HUB
                  </span>
                </div>
                <p className="text-[10px] text-purple-200 hidden sm:block font-medium">
                  Collaborative Study & Practice Rooms
                </p>
              </div>
            </button>
          </div>

          {/* Right: User Profile Menu Pill & Dropdown */}
          <div className="flex items-center gap-2 relative">
            {studyProfile && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 pl-2 pr-2.5 sm:pr-3 py-1.5 rounded-full bg-black/20 hover:bg-black/30 border border-white/25 text-xs font-bold text-white transition backdrop-blur-md cursor-pointer shadow-sm"
                  title="Open Study Profile & Availability Menu"
                >
                  <span className="text-base sm:text-lg leading-none">{currentAvatarInfo.emoji}</span>
                  <div className="flex flex-col items-start text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-white text-xs max-w-[90px] sm:max-w-[130px] truncate leading-tight">
                        {studyProfile.displayName}
                      </span>
                      {completionData && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none ${
                          completionData.isFullyComplete
                            ? "bg-emerald-400 text-slate-950"
                            : "bg-white/30 text-white"
                        }`}>
                          {completionData.percentage}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-purple-200 leading-tight mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${presence?.dotColor || "bg-emerald-400"}`} />
                      <span>{presence?.label || "Online"}</span>
                      <span className="text-[7px] text-white/60">▼</span>
                    </div>
                  </div>
                </button>

                {/* Interactive Profile Dropdown Menu */}
                {showProfileMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <div className="absolute top-full right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-4 z-50 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-100">
                      {/* User Header Details */}
                      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-2xl shadow-inner shrink-0">
                          {currentAvatarInfo.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-black text-sm text-white truncate">
                            {studyProfile.displayName}
                          </h3>
                          <p className="text-[11px] text-slate-400 truncate">
                            {studyProfile.studyGoal || "Civil Service Exam"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${completionData?.percentage || 0}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-400">
                              {completionData?.percentage || 0}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Presence Availability Selector */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block px-1">
                          My Availability Status
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {PRESENCE_CHOICES.map((choice) => (
                            <button
                              key={choice.id}
                              type="button"
                              onClick={() => {
                                updatePresenceStatus(choice.id);
                                setShowProfileMenu(false);
                              }}
                              className={`p-2 rounded-xl text-left border text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                                presence?.status === choice.id
                                  ? "bg-purple-600/30 border-purple-500 text-white"
                                  : "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${choice.dot}`} />
                              <span>{choice.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Action Links */}
                      <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowProfileMenu(false);
                            setShowEditProfileModal(true);
                          }}
                          className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <span>✏️</span>
                          <span>Edit Study Profile</span>
                        </button>

                        <Link
                          href="/dashboard"
                          onClick={() => setShowProfileMenu(false)}
                          className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition text-center border border-slate-700"
                        >
                          &larr; Back to Dashboard
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Direct Dashboard link on desktop for quick escape */}
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-2 bg-black/20 hover:bg-black/30 border border-white/20 rounded-xl text-xs font-bold text-white transition backdrop-blur-md"
              title="Return to Main Dashboard"
            >
              <span>←</span>
              <span>Dashboard</span>
            </Link>
          </div>
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

          {/* 🏛️ CSE STUDY COMMONS FEED (COMMUNITY PEER BULLETIN & Q&A) */}
          <StudyCommonsSection />
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