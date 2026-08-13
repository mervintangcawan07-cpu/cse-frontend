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

export default function SocialDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [studyProfile, setStudyProfile] = useState<any>(null);
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(null);
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
      }
    } catch (err) {
      console.error("Failed to fetch study profile:", err);
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
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8 text-slate-100">
      {/* HEADER BANNER WITH USER STUDY IDENTITY CHIP */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
              Collaborative Study System
            </span>

            {/* Study Profile Identity Chip */}
            {studyProfile && (
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-950/80 border border-slate-800 rounded-full text-xs">
                <span className="text-base">{currentAvatarInfo.emoji}</span>
                <span className="font-extrabold text-white truncate max-w-[140px]">
                  {studyProfile.displayName}
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">● Active</span>
              </div>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-white mt-1">
            Study Together Hub
          </h1>
          <p className="text-xs md:text-sm text-slate-400 max-w-xl leading-relaxed">
            Review Civil Service topics alongside fellow examinees and classmates. Form study rooms, share practice questions, and track group progress.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowEditProfileModal(true)}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 cursor-pointer flex items-center gap-1.5"
            title="Edit Study Together Profile"
          >
            <span>✏️</span>
            <span>Edit Study Profile</span>
          </button>

          <Link
            href="/dashboard"
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700"
          >
            &larr; Return to Dashboard
          </Link>
        </div>
      </div>

      {/* SUB-NAVIGATION TABS */}
      <div className="flex border-b border-slate-800 gap-1 overflow-x-auto pb-1 scrollbar-none pt-2">
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

      {/* TAB CONTENT AREAS */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-6">
          {/* STATS SUMMARY GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Classmates Online</span>
              <span className="text-2xl font-black text-emerald-400">0</span>
              <span className="text-[10px] text-slate-500 block">0 total classmates</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Active Rooms</span>
              <span className="text-2xl font-black text-blue-400">{counts.activeRooms}</span>
              <span className="text-[10px] text-slate-500 block">Available now</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pending Invites</span>
              <span className="text-2xl font-black text-amber-400">{counts.pendingClassmates}</span>
              <span className="text-[10px] text-slate-500 block">Requests pending</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Next Event</span>
              <span className="text-sm font-black text-slate-300 block truncate">
                {counts.upcomingEvents > 0 ? `${counts.upcomingEvents} Scheduled` : "None Scheduled"}
              </span>
              <span className="text-[10px] text-slate-500 block">Check calendar</span>
            </div>
          </div>

          {/* QUICK START CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xl">🎧</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Study Rooms</h3>
                  <p className="text-xs text-slate-400">Start or join a collaborative group study room.</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("ROOMS")}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
              >
                Go to Study Rooms
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xl">🧑‍🎓</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Find Classmates</h3>
                  <p className="text-xs text-slate-400">Connect with examinees targeting the same CSE date.</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("CLASSMATES")}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
              >
                Search Classmates
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "CLASSMATES" && <ClassmatesSection />}
      {activeTab === "MESSAGES" && <MessagesSection />}
      {activeTab === "ROOMS" && <StudyRoomsSection />}
      {activeTab === "EVENTS" && <StudyEventsSection />}
      {activeTab === "CLUBS" && <StudyClubsSection />}
      {activeTab === "NOTIFICATIONS" && <NotificationsSection />}

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