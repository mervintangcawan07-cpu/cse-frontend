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

  // Fetch current logged-in user session
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (res.ok && data.user) {
          setUser(data.user);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      }
    }
    fetchUser();
  }, []);

  // Hide Navbar on authentication and landing pages
  if (pathname === "/login" || pathname === "/register" || pathname === "/") {
    return null;
  }

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/mock-exam/take", label: "Mock Exam" },
    { href: "/drills", label: "Speed Drills" },
    { href: "/reviewer", label: "Study Notes" },
    { href: "/reading-materials", label: "Handbooks" },
  ];

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
          <Link href="/dashboard" className="flex items-center gap-2 font-black text-lg text-white tracking-tight">
            <span className="p-1.5 bg-blue-600 rounded-lg text-xs">CSE</span>
            <span>Reviewer</span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* ADMIN-ONLY DROPDOWN MENU */}
            {user?.role === "ADMIN" && (
              <div className="relative group ml-2">
                <Link
                  href="/admin/dashboard"
                  className="px-3.5 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 rounded-xl transition flex items-center gap-1.5 font-extrabold text-xs"
                >
                  <span>⚙️ Admin Panel</span>
                  <span className="text-[10px]">▼</span>
                </Link>

                {/* Hover Dropdown Menu */}
                <div className="absolute right-0 top-full mt-1 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-2 hidden group-hover:block space-y-1">
                  <Link
                    href="/admin/dashboard"
                    className="block px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-bold transition"
                  >
                    📊 Control Center & Revenue
                  </Link>
                  <Link
                    href="/admin/reviewer"
                    className="block px-3 py-2 text-amber-400 hover:bg-amber-500/10 rounded-xl text-xs font-bold transition"
                  >
                    📝 Manage Study Notes
                  </Link>
                  <Link
                    href="/admin/reading-materials"
                    className="block px-3 py-2 text-emerald-400 hover:bg-emerald-500/10 rounded-xl text-xs font-bold transition"
                  >
                    📚 Manage Handbooks (.pdf, .doc)
                  </Link>
                  <Link
                    href="/admin/questions"
                    className="block px-3 py-2 text-blue-400 hover:bg-blue-500/10 rounded-xl text-xs font-bold transition"
                  >
                    ❓ Manage Question Bank
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

          {/* Right Action: Logout & Mobile Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="hidden sm:block px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700"
            >
              Log Out
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 pt-3 pb-6 space-y-2">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-xl text-sm font-bold transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Mobile Admin Section */}
          {user?.role === "ADMIN" && (
            <div className="pt-2 border-t border-slate-800 space-y-1">
              <span className="px-4 text-[10px] font-extrabold text-amber-400 uppercase tracking-wider">
                Admin Controls
              </span>
              <Link
                href="/admin/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2.5 rounded-xl text-sm font-bold text-amber-400 hover:bg-slate-800"
              >
                📊 Admin Dashboard
              </Link>
              <Link
                href="/admin/reviewer"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2.5 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800"
              >
                📝 Study Notes Manager
              </Link>
              <Link
                href="/admin/reading-materials"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2.5 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800"
              >
                📚 Handbooks Manager
              </Link>
              <Link
                href="/admin/questions"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2.5 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800"
              >
                ❓ Question Bank
              </Link>
              <Link
                href="/admin/users"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2.5 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800"
              >
                👥 User Management
              </Link>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full text-left px-4 py-3 text-rose-400 font-bold text-sm hover:bg-slate-800 rounded-xl transition"
            >
              Log Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}