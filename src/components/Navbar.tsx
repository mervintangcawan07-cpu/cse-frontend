"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface UserSession {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  isPaid: boolean;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<UserSession | null>(null);

  // Fetch current user session
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) setUser(data.user);
        }
      } catch (err) {
        console.error("Auth check error:", err);
      }
    }
    fetchUser();
  }, [pathname]);

  // Hide Navbar on auth & landing pages
  if (pathname === "/login" || pathname === "/register" || pathname === "/") {
    return null;
  }

  const isPaid = user?.isPaid || user?.role === "ADMIN";

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      router.push("/login");
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-black text-lg text-white tracking-tight"
          >
            <span className="p-1.5 bg-blue-600 rounded-lg text-xs">CSE</span>
            <span>Reviewer</span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/dashboard"
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                pathname === "/dashboard"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              Dashboard
            </Link>

            {isPaid ? (
              <>
                <Link
                  href="/mock-exam/take"
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                    pathname.startsWith("/mock-exam")
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  Mock Exam
                </Link>
                <Link
                  href="/drills"
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                    pathname.startsWith("/drills")
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  Speed Drills
                </Link>
                <Link
                  href="/reviewer"
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                    pathname.startsWith("/reviewer")
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  Study Notes
                </Link>
                <Link
                  href="/reading-materials"
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                    pathname.startsWith("/reading-materials")
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  Handbooks
                </Link>
              </>
            ) : (
              <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                🔒 PRO Modules Locked
              </span>
            )}

            {/* ADMIN DROPDOWN */}
            {user?.role === "ADMIN" && (
              <div className="relative group ml-2">
                <Link
                  href="/admin/dashboard"
                  className="px-3.5 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 rounded-xl transition flex items-center gap-1.5 font-extrabold text-xs"
                >
                  <span>⚙️ Admin Panel</span>
                  <span className="text-[10px]">▼</span>
                </Link>

                <div className="absolute right-0 top-full mt-1 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-2 hidden group-hover:block space-y-1 z-50">
                  <Link
                    href="/admin/pricing"
                    className="block px-3 py-2 text-amber-400 hover:bg-amber-500/10 rounded-xl text-xs font-bold transition"
                  >
                    💳 Manage Plan Pricing
                  </Link>
                  <Link
                    href="/admin/dashboard"
                    className="block px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-bold transition"
                  >
                    📊 Control Center & Revenue
                  </Link>
                  <Link
                    href="/admin/users"
                    className="block px-3 py-2 text-purple-400 hover:bg-purple-500/10 rounded-xl text-xs font-bold transition"
                  >
                    👥 Manage Users & PRO Status
                  </Link>
                </div>
              </div>
            )}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}