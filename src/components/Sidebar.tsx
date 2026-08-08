// Relative Path: src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-200 min-h-screen p-5 flex flex-col justify-between shrink-0 shadow-xl hidden md:flex">
      <div className="space-y-6">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-xs shadow-lg shadow-blue-600/30">
            CSE
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-white block">
              CSE Reviewer
            </span>
            <span className="text-[10px] text-slate-400 font-mono block">PRO Platform</span>
          </div>
        </div>

        <div className="h-px bg-slate-800"></div>

        {/* Navigation Sections */}
        <nav className="space-y-6 text-xs font-bold">
          {/* Section 1: Overview */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 px-3 block">
              Overview
            </span>
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
                pathname === "/dashboard"
                  ? "bg-blue-600 text-white font-extrabold shadow-md shadow-blue-600/20"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <span>📊</span>
              <span>Dashboard</span>
            </Link>
          </div>

          {/* Section 2: Assessment & Testing */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 px-3 block">
              Assessment
            </span>
            <Link
              href="/practice"
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
                pathname === "/practice" || isActive("/exam") || isActive("/drills") || isActive("/1v1")
                  ? "bg-blue-600 text-white font-extrabold shadow-md shadow-blue-600/20"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <span>🎯</span>
              <span>Practice & Prep Center</span>
            </Link>
            <div className="pl-6 space-y-1 pt-1 border-l border-slate-800 ml-5">
              <Link
                href="/exam"
                className={`block py-1.5 px-3 rounded-lg text-[11px] transition ${
                  isActive("/exam") ? "text-blue-400 font-extrabold" : "text-slate-400 hover:text-white"
                }`}
              >
                Mock Exam
              </Link>
              <Link
                href="/drills"
                className={`block py-1.5 px-3 rounded-lg text-[11px] transition ${
                  isActive("/drills") ? "text-blue-400 font-extrabold" : "text-slate-400 hover:text-white"
                }`}
              >
                Speed Drills
              </Link>
              <Link
                href="/1v1"
                className={`block py-1.5 px-3 rounded-lg text-[11px] transition ${
                  isActive("/1v1") ? "text-blue-400 font-extrabold" : "text-slate-400 hover:text-white"
                }`}
              >
                1v1 Duels
              </Link>
            </div>
          </div>

          {/* Section 3: Knowledge Vault */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 px-3 block">
              Knowledge Vault
            </span>
            <Link
              href="/learning"
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
                pathname === "/learning" || isActive("/flashcards") || isActive("/bookmarks") || isActive("/reviewer") || isActive("/reading-materials")
                  ? "bg-purple-600 text-white font-extrabold shadow-md shadow-purple-600/20"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <span>📚</span>
              <span>Learning Hub</span>
            </Link>
            <div className="pl-6 space-y-1 pt-1 border-l border-slate-800 ml-5">
              <Link
                href="/flashcards"
                className={`block py-1.5 px-3 rounded-lg text-[11px] transition ${
                  isActive("/flashcards") ? "text-purple-400 font-extrabold" : "text-slate-400 hover:text-white"
                }`}
              >
                Flashcards
              </Link>
              <Link
                href="/bookmarks"
                className={`block py-1.5 px-3 rounded-lg text-[11px] transition ${
                  isActive("/bookmarks") ? "text-purple-400 font-extrabold" : "text-slate-400 hover:text-white"
                }`}
              >
                Bookmarks
              </Link>
              <Link
                href="/reviewer"
                className={`block py-1.5 px-3 rounded-lg text-[11px] transition ${
                  isActive("/reviewer") ? "text-purple-400 font-extrabold" : "text-slate-400 hover:text-white"
                }`}
              >
                Study Notes
              </Link>
              <Link
                href="/reading-materials"
                className={`block py-1.5 px-3 rounded-lg text-[11px] transition ${
                  isActive("/reading-materials") ? "text-purple-400 font-extrabold" : "text-slate-400 hover:text-white"
                }`}
              >
                Handbooks
              </Link>
            </div>
          </div>
        </nav>
      </div>

      <div className="px-2 pt-4 border-t border-slate-800">
        <Link
          href="/profile"
          className="flex items-center gap-3 text-xs font-bold text-slate-400 hover:text-white transition py-2"
        >
          <span>👤</span>
          <span>My Account</span>
        </Link>
      </div>
    </aside>
  );
}