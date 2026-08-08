// Relative Path: src/components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-blue-600/30">
            CSE
          </div>
          <span className="font-extrabold text-base tracking-tight text-white">
            Reviewer
          </span>
        </Link>

        {/* Top Navbar Nav Links */}
        <nav className="hidden md:flex items-center gap-2 text-xs font-bold">
          <Link
            href="/dashboard"
            className={`px-3.5 py-2 rounded-xl transition ${
              pathname === "/dashboard"
                ? "bg-blue-600 text-white font-extrabold shadow-md shadow-blue-600/20"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            📊 Dashboard
          </Link>

          <Link
            href="/practice"
            className={`px-3.5 py-2 rounded-xl transition ${
              isActive("/practice") || isActive("/exam") || isActive("/drills") || isActive("/1v1")
                ? "bg-blue-600 text-white font-extrabold shadow-md shadow-blue-600/20"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            🎯 Practice & Prep
          </Link>

          <Link
            href="/learning"
            className={`px-3.5 py-2 rounded-xl transition ${
              isActive("/learning") || isActive("/flashcards") || isActive("/bookmarks") || isActive("/reviewer") || isActive("/reading-materials")
                ? "bg-purple-600 text-white font-extrabold shadow-md shadow-purple-600/20"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            📚 Learning Hub
          </Link>

          <Link
            href="/profile"
            className={`px-3.5 py-2 rounded-xl transition ${
              isActive("/profile")
                ? "bg-slate-800 text-white font-extrabold"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            👤 Profile
          </Link>
        </nav>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
        >
          Log Out
        </button>
      </div>
    </header>
  );
}