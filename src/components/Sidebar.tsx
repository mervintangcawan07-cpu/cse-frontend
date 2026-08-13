// Relative Path: src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name?: string; role?: string; isPaid?: boolean } | null>(null);

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
    <aside className="w-64 bg-slate-950 border-r border-slate-800/80 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between hidden md:flex shrink-0">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
            Main Navigation
          </p>
          <nav className="space-y-1">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
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

        <div>
          <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
            Quick Actions
          </p>
          <div className="space-y-1">
            <Link
              href="/mistakes"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition ${
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
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition ${
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
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-amber-400 hover:bg-slate-900/80 transition"
            >
              <span>⚡</span>
              <span>Take Mock Exam</span>
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 transition"
            >
              <span>⚙️</span>
              <span>Account Settings</span>
            </Link>
            {user?.role === "ADMIN" && (
              <Link
                href="/admin/flags"
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition ${
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

      {user && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3">
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
  );
}