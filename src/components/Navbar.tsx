// Relative Path: src/components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
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
        // Silently fail if unauthenticated
      }
    }
    fetchMe();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Practice & Prep", href: "/practice" },
    { label: "Learning Hub", href: "/learning" },
    { label: "Study Together 👥", href: "/social" },
  ];

  if (user?.role === "ADMIN") {
    navItems.push({ label: "Admin Portal", href: "/admin" });
  }

  return (
    <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-sm shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              CS
            </div>
            <span className="font-extrabold text-sm text-white tracking-wide">
              CSC Review <span className="text-blue-400 font-normal text-xs">PRO</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    isActive
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-slate-900"
              >
                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-blue-400 uppercase">
                  {user.name ? user.name[0] : "U"}
                </div>
                <span className="hidden sm:inline">{user.name || "My Account"}</span>
              </Link>

              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-slate-900 hover:bg-rose-950/40 hover:border-rose-500/30 border border-slate-800 text-slate-400 hover:text-rose-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Log Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-md"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}