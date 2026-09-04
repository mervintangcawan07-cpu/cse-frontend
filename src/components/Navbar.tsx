// Relative Path: src/components/Navbar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOfflineSync } from "@/hooks/useOfflineSync";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; role?: string; isPaid?: boolean } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineSync();

  useEffect(() => {
    let isMounted = true;

    async function fetchMe() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.kicked) {
              setUser(null);
              if (
                pathname !== "/login" &&
                pathname !== "/" &&
                !pathname.startsWith("/privacy") &&
                !pathname.startsWith("/terms") &&
                !pathname.startsWith("/refund") &&
                !pathname.startsWith("/cookies")
              ) {
                window.location.href = "/login?kicked=true";
                return;
              }
            } else {
              setUser(data.user || null);
            }
          }
        }
      } catch (err) {
        // Silently fail if unauthenticated
      }
    }

    fetchMe();

    // 🔒 Lightweight periodic session heartbeat & window focus check (every 30s)
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchMe();
      }
    }, 30000);

    const onFocus = () => {
      fetchMe();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);

  // Close mobile navigation drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close compact navigation drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

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
    { label: "Referrals 🎁", href: "/referrals" },
  ];

  if (user?.role === "ADMIN") {
    navItems.push({ label: "Admin Portal", href: "/admin" });
  }

  return (
    <header className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-50">
      <div className="w-full max-w-none px-3 sm:px-4 md:px-6 xl:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 group shrink-0">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg">
              <Image
                src="/brand/govstudyx-icon.png"
                alt=""
                width={32}
                height={32}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="font-extrabold text-sm text-white tracking-wide">
              GovStudy<span className="text-blue-400 font-black">X</span>
            </span>
          </Link>

          {/* DESKTOP NAVIGATION */}
          <nav className="hidden xl:flex items-center gap-1">
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

        {/* DESKTOP ACTIONS */}
        <div className="hidden xl:flex items-center gap-3">
          {/* Offline / Sync Indicator */}
          {(!isOnline || pendingCount > 0) && (
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={isSyncing || !isOnline}
              title={
                !isOnline
                  ? "You are offline"
                  : isSyncing
                  ? "Syncing pending submissions…"
                  : `${pendingCount} pending submission${pendingCount > 1 ? "s" : ""} — click to sync`
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer disabled:cursor-not-allowed ${
                !isOnline
                  ? "bg-slate-900 border-slate-700 text-slate-400"
                  : isSyncing
                  ? "bg-blue-950/50 border-blue-700/50 text-blue-400 animate-pulse"
                  : "bg-amber-950/40 border-amber-600/40 text-amber-400 hover:bg-amber-950/60"
              }`}
            >
              {!isOnline ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
                  <span>Offline</span>
                </>
              ) : isSyncing ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block animate-pulse" />
                  <span>Syncing…</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  <span>{pendingCount} Pending</span>
                </>
              )}
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                title={user.name || "My Account"}
                className="text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-slate-900 max-w-[180px]"
              >
                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-blue-400 uppercase shrink-0">
                  {user.name ? user.name[0] : "U"}
                </div>
                <span className="truncate">{user.name || "My Account"}</span>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 bg-slate-900 hover:bg-rose-950/40 hover:border-rose-500/30 border border-slate-800 text-slate-400 hover:text-rose-300 text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
              >
                Log Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-md shrink-0"
            >
              Sign In
            </Link>
          )}
        </div>

        {/* MOBILE/TABLET HAMBURGER BUTTON & SHORTCUTS */}
        <div className="flex items-center gap-2 xl:hidden">
          {(!isOnline || pendingCount > 0) && (
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={isSyncing || !isOnline}
              title={
                !isOnline
                  ? "You are offline"
                  : isSyncing
                  ? "Syncing pending submissions…"
                  : `${pendingCount} pending submission${pendingCount > 1 ? "s" : ""} — click to sync`
              }
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer disabled:cursor-not-allowed ${
                !isOnline
                  ? "bg-slate-900 border-slate-700 text-slate-400"
                  : isSyncing
                  ? "bg-blue-950/50 border-blue-700/50 text-blue-400 animate-pulse"
                  : "bg-amber-950/40 border-amber-600/40 text-amber-400 hover:bg-amber-950/60"
              }`}
            >
              {!isOnline ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
                  <span>Offline</span>
                </>
              ) : isSyncing ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block animate-pulse" />
                  <span>Syncing…</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  <span>{pendingCount} Pending</span>
                </>
              )}
            </button>
          )}

          {user && (
            <Link
              href="/profile"
              title={user.name || "My Account"}
              className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-blue-400 uppercase shrink-0"
            >
              {user.name ? user.name[0] : "U"}
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* MOBILE/TABLET DROPDOWN DRAWER */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          className="xl:hidden bg-slate-950 border-b border-slate-800/80 px-4 sm:px-6 md:px-8 pt-3 pb-5 space-y-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 max-h-[calc(100dvh-4rem)] overflow-y-auto"
        >
          {/* Compact Menu Offline / Sync Indicator */}
          {(!isOnline || pendingCount > 0) && (
            <div className="pb-1">
              <button
                type="button"
                onClick={() => void syncNow()}
                disabled={isSyncing || !isOnline}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer disabled:cursor-not-allowed ${
                  !isOnline
                    ? "bg-slate-900 border-slate-700 text-slate-400"
                    : isSyncing
                    ? "bg-blue-950/50 border-blue-700/50 text-blue-400 animate-pulse"
                    : "bg-amber-950/40 border-amber-600/40 text-amber-400 hover:bg-amber-950/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      !isOnline
                        ? "bg-slate-500"
                        : isSyncing
                        ? "bg-blue-400 animate-pulse"
                        : "bg-amber-400"
                    }`}
                  />
                  <span>
                    {!isOnline
                      ? "Offline Mode"
                      : isSyncing
                      ? "Syncing pending submissions…"
                      : `${pendingCount} pending submission${pendingCount > 1 ? "s" : ""}`}
                  </span>
                </div>
                {isOnline && !isSyncing && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-900/60 px-2 py-0.5 rounded-md border border-amber-500/30">
                    Sync Now
                  </span>
                )}
              </button>
            </div>
          )}

          <div>
            <p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              Navigation
            </p>
            <nav className="flex flex-col space-y-1">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                      isActive
                        ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                        : "text-slate-300 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <span>{item.label}</span>
                    {isActive && <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">&bull; Active</span>}
                  </Link>
                );
              })}
            </nav>
          </div>

          {user && (
            <div className="pt-2 border-t border-slate-900">
              <p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                Quick Review Tools
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Link
                  href="/mistakes"
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                >
                  <span>📕</span>
                  <span>Mistakes</span>
                </Link>
                <Link
                  href="/badges"
                  className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                >
                  <span>🏆</span>
                  <span>Badges</span>
                </Link>
                <Link
                  href="/practice"
                  className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                >
                  <span>⚡</span>
                  <span>Practice</span>
                </Link>
                <Link
                  href="/profile"
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                >
                  <span>⚙️</span>
                  <span>Account</span>
                </Link>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-900 flex items-center justify-between">
            {user ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-blue-400 uppercase shrink-0">
                    {user.name ? user.name[0] : "U"}
                  </div>
                  <span className="text-xs font-bold text-slate-200 truncate">{user.name || "My Account"}</span>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3.5 py-1.5 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
                >
                  Log Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="w-full text-center py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* 1-TAP LEGAL & COMPLIANCE ACCESS */}
          <div className="pt-3 border-t border-slate-900 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold text-slate-400">
              <Link href="/privacy" className="hover:text-blue-400 transition">Privacy</Link>
              <span>&bull;</span>
              <Link href="/terms" className="hover:text-blue-400 transition">Terms</Link>
              <span>&bull;</span>
              <Link href="/refund" className="hover:text-blue-400 transition">Refunds</Link>
              <span>&bull;</span>
              <Link href="/cookies" className="hover:text-blue-400 transition">Cookies</Link>
              <span>&bull;</span>
              <Link href="/support" className="hover:text-blue-400 transition">Support</Link>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              GovStudyX is an independent educational platform not affiliated with the Civil Service Commission (CSC).
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
