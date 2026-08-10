"use client";

import React, { useState, useEffect } from "react";
import { EventNotification } from "@/types/cse";

interface NotificationSystemProps {
  notifications: EventNotification[];
  onMarkRead?: (id: string) => void;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications,
  onMarkRead,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  const requestPushPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission === "granted") {
        new Notification("CSC Reviewer Pro Alerts Enabled", {
          body: "You will receive reminders 15m and 5m before live events begin.",
          icon: "/favicon.ico",
        });
      }
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
        aria-label="Event Notifications"
      >
        <span className="text-base">??</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-900">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Event Alerts ({unreadCount})
            </h4>
            {pushPermission !== "granted" && (
              <button
                onClick={requestPushPermission}
                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Enable Web Push
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2">
            {notifications.length === 0 ? (
              <p className="text-xs text-center text-slate-500 py-4">No upcoming notifications.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => onMarkRead?.(n.id)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    n.read
                      ? "bg-slate-50 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                      : "bg-blue-50 text-blue-950 dark:bg-blue-950/50 dark:text-blue-200 border-blue-200 dark:border-blue-800 font-semibold"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[10px] uppercase text-blue-600 dark:text-blue-400">
                      {n.triggerType === "15min"
                        ? "? 15m Reminder"
                        : n.triggerType === "5min"
                        ? "?? 5m Urgent Call"
                        : "?? Live Now"}
                    </span>
                    <span className="text-[10px] opacity-70">{n.createdAt}</span>
                  </div>
                  <p className="leading-snug">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
