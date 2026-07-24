"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load user from localStorage and handle hydration
  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem("cse_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error("Failed to parse user from localStorage", err);
        setUser(null);
      }
    } else {
      setUser(null);
    }
  }, [pathname]);

  // Hide the navbar on auth pages, landing page, settings, or before mounting
  const isAuthPage =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/settings";

  if (!mounted || isAuthPage) return null;

  // If mounted but no user, hide navbar
  if (!user) return null;

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      localStorage.removeItem("cse_user");
      router.push("/login"); // 👈 Updated: Redirect straight to login page
    }
  }

  const navLinks = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Take Exam", href: "/mock-exam/take" }, // or "/exam"
    { name: "Question Bank", href: "/admin/questions" },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Left Side: Logo & Links */}
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-xl font-black text-blue-600 tracking-tighter">
            CSE Reviewer
          </Link>
          
          <div className="hidden md:flex gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Side: User Info & Logout */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-slate-600 hidden sm:block">
            {user.name || user.email}
          </span>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 font-bold text-sm rounded-xl transition"
          >
            Log Out
          </button>
        </div>
      </div>
    </nav>
  );
}