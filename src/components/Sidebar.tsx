// Relative Path: src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name?: string; role?: string; isPaid?: boolean } | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
        }
      } catch (err) {
        // Silently handle unauthenticated state
      }
    }
    fetchMe();
  }, [pathname]);

  // Auto-close slide-over drawer when navigating to a new route
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, handleKeyDown]);

  const mainNavItems = [
    { label: "Dashboard", href: "/dashboard", icon: "🏠" },
    { label: "Practice & Prep", href: "/practice", icon: "📝" },
    { label: "Learning Hub", href: "/learning", icon: "📚" },
    { label: "Study Together", href: "/social", icon: "👥" },
  ];

  if (user?.role === "ADMIN") {
    mainNavItems.push({ label: "Admin Portal", href: "/admin", icon: "🛡️" });
  }

  return (
    <>
      {/* FLOATING QUICK ACTIONS TOGGLE BUTTON (VISIBLE ON ALL SCREENS) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 left-5 z-40 flex items-center gap-2 px-4 py-2.5 bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-bold rounded-full border border-slate-700/80 shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer group"
        aria-label="Open Quick Navigation Menu"
      >
        <span className="text-sm group-hover:rotate-12 transition-transform">⚡</span>
        <span className="font-extrabold tracking-wide">Quick Menu</span>
      </button>

      {/* SLIDE-OVER DRAWER OVERLAY BACKDROP */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* SLIDE-OVER DRAWER CONTAINER */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-slate-950 border-r border-slate-800/90 p-5 flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-out transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Quick Actions Sidebar Drawer"
      >
        <div className="space-y-6 overflow-y-auto pr-1">
          {/* DRAWER TOP HEADER */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-black text-blue-400">
                CS
              </div>
              <div>
                <h2 className="text-xs font-black text-white uppercase tracking-wider">Quick Navigation</h2>
                <p className="text-[10px] text-slate-400">Civil Service Review Hub</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition border border-slate-800 cursor-pointer text-sm"
              aria-label="Close Drawer"
            >
              ✕
            </button>
          </div>

          {/* MAIN NAVIGATION */}
          <div>
            <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Main Sections
            </p>
            <nav className="space-y-1">
              {mainNavItems.map((item) => {
                const isActive =
                  pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                      isActive
                        ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-black shadow-md shadow-blue-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/80"
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* QUICK ACTIONS */}
          <div>
            <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Quick Review Actions
            </p>
            <div className="space-y-1">
              <Link
                href="/mistakes"
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                  pathname === "/mistakes"
                    ? "bg-rose-600/20 text-rose-400 border border-rose-500/30 font-black shadow-md shadow-rose-500/10"
                    : "text-slate-400 hover:text-rose-400 hover:bg-slate-900/80"
                }`}
              >
                <span>📕</span>
                <span>Mistake Notebook</span>
              </Link>
              <Link
                href="/badges"
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                  pathname === "/badges"
                    ? "bg-amber-600/20 text-amber-400 border border-amber-500/30 font-black shadow-md shadow-amber-500/10"
                    : "text-slate-400 hover:text-amber-400 hover:bg-slate-900/80"
                }`}
              >
                <span>🏆</span>
                <span>Achievements</span>
              </Link>
              <Link
                href="/mock-exam/take"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-amber-400 hover:bg-slate-900/80 transition"
              >
                <span>⚡</span>
                <span>Take Mock Exam</span>
              </Link>
              <Link
                href="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 transition"
              >
                <span>⚙️</span>
                <span>Account Settings</span>
              </Link>
              {user?.role === "ADMIN" && (
                <Link
                  href="/admin/flags"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                    pathname === "/admin/flags"
                      ? "bg-amber-600/20 text-amber-400 border border-amber-500/30 font-black shadow-md shadow-amber-500/10"
                      : "text-slate-400 hover:text-amber-400 hover:bg-slate-900/80"
                  }`}
                >
                  <span>🚩</span>
                  <span>Flag Review Queue</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* USER PROFILE FOOTER */}
        {user && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3 mt-4">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-xs uppercase">
              {user.name ? user.name[0] : "U"}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-bold text-white truncate">{user.name || "Examinee"}</p>
              <span className="text-[10px] font-semibold text-emerald-400 block truncate">
                {user.role === "ADMIN" ? "Administrator" : user.isPaid ? "PRO Member" : "Free Member"}
              </span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}