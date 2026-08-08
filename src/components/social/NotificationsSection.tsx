// Relative Path: src/components/social/NotificationsSection.tsx
"use client";

import { useEffect, useState } from "react";

export default function NotificationsSection() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "CLASSMATE_REQUEST" | "STUDY_ROOM">("ALL");

  const fetchNotifications = async () => {
    try {
      const typeParam = filter === "UNREAD" || filter === "ALL" ? "" : `?type=${filter}`;
      const res = await fetch(`/api/notifications${typeParam}`);
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
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId, action: "DELETE" }),
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "CLASSMATE_REQUEST":
        return "🧑‍🎓";
      case "DIRECT_MESSAGE":
        return "💬";
      case "STUDY_ROOM":
        return "🎧";
      case "EVENT_REMINDER":
        return "📅";
      default:
        return "🔔";
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & TOP CONTROLS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Notifications & Alerts</h3>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 bg-blue-500 text-white font-black text-[10px] rounded-full">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">Classmate invitations, room alerts, and study reminders.</p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 cursor-pointer"
          >
            ✓ Mark All as Read
          </button>
        )}
      </div>

      {/* FILTER TABS */}
      <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setFilter("ALL")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            filter === "ALL" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          All Notifications
        </button>
        <button
          onClick={() => setFilter("UNREAD")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            filter === "UNREAD" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Unread Only
        </button>
        <button
          onClick={() => setFilter("CLASSMATE_REQUEST")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            filter === "CLASSMATE_REQUEST" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Classmates
        </button>
        <button
          onClick={() => setFilter("STUDY_ROOM")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            filter === "STUDY_ROOM" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Rooms & Events
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
            Classmate requests, room invitations, and session reminders will appear in this feed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 rounded-2xl border transition flex items-start justify-between gap-4 ${
                !notif.isRead
                  ? "bg-blue-950/20 border-blue-500/30 shadow-lg shadow-blue-500/5"
                  : "bg-slate-900 border-slate-800 opacity-80"
              }`}
            >
              <div className="flex items-start gap-3 overflow-hidden">
                <span className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-lg shrink-0">
                  {getNotificationIcon(notif.type)}
                </span>
                <div className="overflow-hidden space-y-1">
                  <div className="flex items-center gap-2">
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

              <div className="flex items-center gap-1.5 shrink-0">
                {!notif.isRead && (
                  <button
                    onClick={() => markAsRead(notif.id)}
                    className="p-1.5 text-[10px] font-bold text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition cursor-pointer"
                    title="Mark as read"
                  >
                    ✓ Read
                  </button>
                )}
                <button
                  onClick={() => deleteNotification(notif.id)}
                  className="p-1.5 text-[10px] font-bold text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                  title="Delete notification"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}