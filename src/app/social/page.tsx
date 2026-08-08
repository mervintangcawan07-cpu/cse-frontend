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

type SocialTab = "OVERVIEW" | "CLASSMATES" | "MESSAGES" | "ROOMS" | "EVENTS" | "CLUBS" | "NOTIFICATIONS";

export default function SocialDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SocialTab>("OVERVIEW");

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
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
    checkAuth();
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

  const tabs: { id: SocialTab; label: string; icon: string }[] = [
    { id: "OVERVIEW", label: "Overview", icon: "📊" },
    { id: "CLASSMATES", label: "Classmates", icon: "🧑‍🎓" },
    { id: "MESSAGES", label: "Messages", icon: "💬" },
    { id: "ROOMS", label: "Study Rooms", icon: "🎧" },
    { id: "EVENTS", label: "Events", icon: "📅" },
    { id: "CLUBS", label: "Clubs", icon: "🏛️" },
    { id: "NOTIFICATIONS", label: "Alerts", icon: "🔔" },
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8 text-slate-100">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
            Collaborative Study System
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-white mt-2">
            Study Together Hub
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-xl leading-relaxed">
            Review Civil Service topics alongside fellow examinees and classmates. Form study rooms, share practice questions, and track group progress.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 shrink-0"
        >
          &larr; Return to Dashboard
        </Link>
      </div>

      {/* SUB-NAVIGATION TABS */}
      <div className="flex border-b border-slate-800 gap-1 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 px-4 text-xs font-bold transition border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === tab.id
                ? "border-blue-500 text-blue-400 font-black"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
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
              <span className="text-2xl font-black text-blue-400">0</span>
              <span className="text-[10px] text-slate-500 block">Available now</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pending Invites</span>
              <span className="text-2xl font-black text-amber-400">0</span>
              <span className="text-[10px] text-slate-500 block">Requests pending</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Next Event</span>
              <span className="text-sm font-black text-slate-300 block truncate">None Scheduled</span>
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
    </div>
  );
}