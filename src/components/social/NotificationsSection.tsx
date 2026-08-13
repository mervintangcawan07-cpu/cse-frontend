// Relative Path: src/components/social/NotificationsSection.tsx
"use client";

import { useEffect, useState } from "react";

type NotificationCategory = "ALL" | "UNREAD" | "CLASSMATES" | "MESSAGES" | "ROOMS_CLUBS" | "EVENTS";

interface NotificationsSectionProps {
  onNavigateTab?: (tab: "OVERVIEW" | "CLASSMATES" | "MESSAGES" | "ROOMS" | "EVENTS" | "CLUBS" | "NOTIFICATIONS") => void;
}

export default function NotificationsSection({ onNavigateTab }: NotificationsSectionProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationCategory>("ALL");
  const [isClearingRead, setIsClearingRead] = useState(false);

  const fetchNotifications = async () => {
    try {
      let queryParam = "";
      if (filter === "UNREAD") {
        queryParam = "";
      } else if (filter !== "ALL") {
        queryParam = `?category=${filter}`;
      }

      const res = await fetch(`/api/notifications${queryParam}`);
      if (res.ok) {
        const data = await res.json();
        let list = data.notifications || [];
        if (filter === "UNREAD") {
          list = list.filter((n: any) => !n.isRead);
        }
        setNotifications(list);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const markAsRead = async (notificationId: string) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId, action: "READ" }),
      });
      if (res.ok) {
        await fetchNotifications();
      }
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const res = await fetch(`/api/notifications?id=${notificationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchNotifications();
      }
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (res.ok) {
        await fetchNotifications();
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const clearAllRead = async () => {
    setIsClearingRead(true);
    try {
      const res = await fetch("/api/notifications?action=CLEAR_READ", { method: "DELETE" });
      if (res.ok) {
        await fetchNotifications();
      }
    } catch (err) {
      console.error("Failed to clear read alerts:", err);
    } finally {
      setIsClearingRead(false);
    }
  };

  const getNotificationConfig = (type: string) => {
    switch (type) {
      case "CLASSMATE_REQUEST":
        return {
          icon: "🧑‍🎓",
          badge: "Classmate Request",
          color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          actionLabel: "View in Classmates",
          tab: "CLASSMATES" as const,
        };
      case "CLASSMATE_ACCEPTED":
        return {
          icon: "🎉",
          badge: "Classmate Connected",
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          actionLabel: "Open Messages",
          tab: "MESSAGES" as const,
        };
      case "DIRECT_MESSAGE":
        return {
          icon: "💬",
          badge: "Direct Message",
          color: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          actionLabel: "Open Chat",
          tab: "MESSAGES" as const,
        };
      case "STUDY_ROOM_INVITE":
      case "STUDY_ROOM":
        return {
          icon: "🎧",
          badge: "Study Room",
          color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
          actionLabel: "Go to Study Rooms",
          tab: "ROOMS" as const,
        };
      case "STUDY_ROOM_MODERATOR":
        return {
          icon: "🛡️",
          badge: "Room Moderator",
          color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
          actionLabel: "Go to Rooms",
          tab: "ROOMS" as const,
        };
      case "STUDY_CLUB_INVITE":
      case "STUDY_CLUB":
        return {
          icon: "🏛️",
          badge: "Study Club",
          color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
          actionLabel: "View Study Clubs",
          tab: "CLUBS" as const,
        };
      case "STUDY_CLUB_MODERATOR":
        return {
          icon: "🛡️",
          badge: "Club Moderator",
          color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
          actionLabel: "View Club",
          tab: "CLUBS" as const,
        };
      case "STUDY_CLUB_TRANSFER":
        return {
          icon: "👑",
          badge: "Club Leadership",
          color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          actionLabel: "Manage Club",
          tab: "CLUBS" as const,
        };
      case "EVENT_RSVP":
      case "EVENT_REMINDER":
        return {
          icon: "📅",
          badge: "Study Event",
          color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
          actionLabel: "View Events",
          tab: "EVENTS" as const,
        };
      case "PROFILE_COMPLETED":
        return {
          icon: "🌟",
          badge: "Profile Milestone",
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          actionLabel: "View Profile",
          tab: "OVERVIEW" as const,
        };
      default:
        return {
          icon: "🔔",
          badge: "System Alert",
          color: "bg-slate-800 text-slate-300 border-slate-700",
          actionLabel: null,
          tab: null,
        };
    }
  };

  const handleActionClick = async (notif: any, tab: any) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    if (tab && onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & TOP CONTROLS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Notifications & Activity Feed</h3>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded-full animate-pulse">
                {unreadCount} New
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">Classmate invitations, private messages, room alerts, and club activities.</p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 cursor-pointer"
            >
              ✓ Mark All Read
            </button>
          )}
          <button
            onClick={clearAllRead}
            disabled={isClearingRead}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700 cursor-pointer disabled:opacity-50"
            title="Remove all read notifications from feed"
          >
            {isClearingRead ? "Clearing..." : "Clear Read"}
          </button>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setFilter("ALL")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            filter === "ALL" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          All Activity
        </button>
        <button
          onClick={() => setFilter("UNREAD")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            filter === "UNREAD" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Unread Only {unreadCount > 0 ? `(${unreadCount})` : ""}
        </button>
        <button
          onClick={() => setFilter("CLASSMATES")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            filter === "CLASSMATES" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          🧑‍🎓 Classmates
        </button>
        <button
          onClick={() => setFilter("MESSAGES")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            filter === "MESSAGES" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          💬 Messages
        </button>
        <button
          onClick={() => setFilter("ROOMS_CLUBS")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            filter === "ROOMS_CLUBS" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          🎧 Rooms & Clubs
        </button>
        <button
          onClick={() => setFilter("EVENTS")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            filter === "EVENTS" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          📅 Events
        </button>
      </div>

      {/* NOTIFICATIONS LIST */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 font-bold animate-pulse">
          Loading alerts...
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <span className="text-4xl block">🔔</span>
          <h4 className="text-sm font-bold text-white">You're All Caught Up!</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Classmate requests, private messages, study room invites, and scheduled event reminders will appear here in real time.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const config = getNotificationConfig(notif.type);

            return (
              <div
                key={notif.id}
                className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  !notif.isRead
                    ? "bg-slate-900/90 border-blue-500/40 shadow-lg shadow-blue-500/5 ring-1 ring-blue-500/20"
                    : "bg-slate-900/50 border-slate-800/80 opacity-85"
                }`}
              >
                <div className="flex items-start gap-3.5 overflow-hidden w-full sm:w-auto">
                  <span className="p-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xl shrink-0">
                    {config.icon}
                  </span>
                  <div className="overflow-hidden space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${config.color}`}>
                        {config.badge}
                      </span>
                      <h4 className="text-xs font-bold text-white truncate">{notif.title}</h4>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{notif.message}</p>
                    <span className="text-[10px] text-slate-500 block">
                      {new Date(notif.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })} at{" "}
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {config.actionLabel && config.tab && (
                    <button
                      type="button"
                      onClick={() => handleActionClick(notif, config.tab)}
                      className="px-3 py-1.5 text-xs font-black bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{config.actionLabel}</span>
                      <span>&rarr;</span>
                    </button>
                  )}

                  {!notif.isRead && (
                    <button
                      type="button"
                      onClick={() => markAsRead(notif.id)}
                      className="p-1.5 text-[11px] font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => deleteNotification(notif.id)}
                    className="p-1.5 text-[11px] font-bold text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                    title="Delete notification"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}