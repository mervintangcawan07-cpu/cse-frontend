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

  // Close mobile menu whenever the path changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Fetch current user session & enforce auto-logout on session expiration
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
          } else {
            setUser(null);
            if (
              pathname !== "/" &&
              pathname !== "/login" &&
              pathname !== "/register" &&
              pathname !== "/signup"
            ) {
              router.push("/login");
            }
          }
        }
      } catch (err) {
        console.error("Auth check error:", err);
      }
    }
    fetchUser();
  }, [pathname, router]);

  // Hide Navbar on auth & landing pages
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/signup" ||
    pathname === "/"
  ) {
    return null;
  }

  const isPaid = user?.isPaid || user?.role === "ADMIN";

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      router.push("/login");
    }
  };

  return (
    // 👈 Set header to z-[9999] so all dropdowns sit on top of page content
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-[9999] text-white">
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

          {/* DESKTOP NAVIGATION */}
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

                {/* Outer wrapper provides an invisible hover bridge and elevated z-index */}
                <div className="absolute right-0 top-full pt-1.5 w-56 hidden group-hover:block z-[10000]">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 space-y-1">
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
              </div>
            )}
          </nav>

          {/* RIGHT CONTROLS & MOBILE TOGGLE */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="hidden md:block px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700"
            >
              Log Out
            </button>

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white focus:outline-none border border-slate-700"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE DROPDOWN DRAWER */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-3 pb-6 space-y-3 font-bold text-xs animate-in slide-in-from-top duration-200">
          <Link
            href="/dashboard"
            className={`block px-4 py-3 rounded-xl transition ${
              pathname === "/dashboard" ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-300"
            }`}
          >
            📊 Dashboard
          </Link>

          {isPaid ? (
            <>
              <Link
                href="/mock-exam/take"
                className={`block px-4 py-3 rounded-xl transition ${
                  pathname.startsWith("/mock-exam") ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-300"
                }`}
              >
                ⏱️ Practice Mock Exam
              </Link>
              <Link
                href="/drills"
                className={`block px-4 py-3 rounded-xl transition ${
                  pathname.startsWith("/drills") ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-300"
                }`}
              >
                ⚡ Category Speed Drills
              </Link>
              <Link
                href="/reviewer"
                className={`block px-4 py-3 rounded-xl transition ${
                  pathname.startsWith("/reviewer") ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-300"
                }`}
              >
                📝 Study Notes & Reviewers
              </Link>
              <Link
                href="/reading-materials"
                className={`block px-4 py-3 rounded-xl transition ${
                  pathname.startsWith("/reading-materials") ? "bg-blue-600 text-white" : "bg-slate-800/60 text-slate-300"
                }`}
              >
                📚 Handbooks & PDFs
              </Link>
            </>
          ) : (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-center">
              🔒 PRO Modules Locked (Select Plan on Dashboard)
            </div>
          )}

          {user?.role === "ADMIN" && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block px-1">
                Admin Controls
              </span>
              <Link
                href="/admin/pricing"
                className="block px-4 py-2.5 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/30"
              >
                💳 Manage Plan Pricing
              </Link>
              <Link
                href="/admin/dashboard"
                className="block px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl"
              >
                📊 Admin Revenue Center
              </Link>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold mt-2"
          >
            🚪 Log Out
          </button>
        </div>
      )}
    </header>
  );
}