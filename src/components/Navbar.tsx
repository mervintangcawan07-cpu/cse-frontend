"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, type ReactNode } from "react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useAuth } from "@/context/AuthContext";
import InstallEntryLink from "@/components/pwa/InstallEntryLink";
import { getAppNavItems, isRouteActive, type AppNavItem } from "@/components/navigation/appNavigation";

type NavItem = AppNavItem;

interface UserProfilePreview {
  name?: string | null;
  role?: string | null;
}

interface SyncButtonProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onSync: () => void;
  className?: string;
}

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
  navItems: readonly NavItem[];
  user: UserProfilePreview | null;
  onLogout: () => void;
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onSync: () => void;
}



function getSyncBadgeTitle(isOnline: boolean, isSyncing: boolean, pendingCount: number): string {
  if (!isOnline) return "You are offline";
  if (isSyncing) return "Syncing pending submissions…";
  const pluralSuffix = pendingCount > 1 ? "s" : "";
  return `${pendingCount} pending submission${pluralSuffix} — click to sync`;
}

function getSyncBadgeClass(isOnline: boolean, isSyncing: boolean): string {
  if (!isOnline) return "bg-slate-900 border-slate-700 text-slate-400";
  if (isSyncing) return "bg-blue-950/50 border-blue-700/50 text-blue-400 animate-pulse";
  return "bg-amber-950/40 border-amber-600/40 text-amber-400 hover:bg-amber-950/60";
}

function SyncStatusButton({
  isOnline,
  pendingCount,
  isSyncing,
  onSync,
  className = "",
}: Readonly<SyncButtonProps>) {
  if (isOnline && pendingCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onSync}
      disabled={isSyncing || !isOnline}
      title={getSyncBadgeTitle(isOnline, isSyncing, pendingCount)}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer disabled:cursor-not-allowed ${getSyncBadgeClass(
        isOnline,
        isSyncing
      )} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full inline-block ${
          !isOnline
            ? "bg-slate-500"
            : isSyncing
            ? "bg-blue-400 animate-pulse"
            : "bg-amber-400"
        }`}
      />
      <span>
        {!isOnline
          ? "Offline"
          : isSyncing
          ? "Syncing…"
          : `${pendingCount} Pending`}
      </span>
    </button>
  );
}

function MobileDrawerSyncButton({
  isOnline,
  pendingCount,
  isSyncing,
  onSync,
}: Readonly<SyncButtonProps>) {
  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="pb-1">
      <button
        type="button"
        onClick={onSync}
        disabled={isSyncing || !isOnline}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer disabled:cursor-not-allowed ${getSyncBadgeClass(
          isOnline,
          isSyncing
        )}`}
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
  );
}

function DesktopUserSection({
  user,
  onLogout,
}: Readonly<{
  user: UserProfilePreview | null;
  onLogout: () => void;
}>) {
  if (!user) {
    return (
      <Link
        href="/login"
        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-md shrink-0"
      >
        Sign In
      </Link>
    );
  }

  const initial = user.name ? user.name[0] : "U";

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/profile"
        title={user.name || "My Account"}
        className="text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-slate-900 max-w-[180px]"
      >
        <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-blue-400 uppercase shrink-0">
          {initial}
        </div>
        <span className="truncate">{user.name || "My Account"}</span>
      </Link>

      <button
        type="button"
        onClick={onLogout}
        className="px-3 py-1.5 bg-slate-900 hover:bg-rose-950/40 hover:border-rose-500/30 border border-slate-800 text-slate-400 hover:text-rose-300 text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
      >
        Log Out
      </button>
    </div>
  );
}

function MobileDrawerUserSection({
  user,
  onLogout,
}: Readonly<{
  user: UserProfilePreview | null;
  onLogout: () => void;
}>) {
  if (!user) {
    return (
      <Link
        href="/login"
        className="w-full text-center py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md"
      >
        Sign In
      </Link>
    );
  }

  const initial = user.name ? user.name[0] : "U";

  return (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-blue-400 uppercase shrink-0">
          {initial}
        </div>
        <span className="text-xs font-bold text-slate-200 truncate">
          {user.name || "My Account"}
        </span>
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="px-3.5 py-1.5 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
      >
        Log Out
      </button>
    </>
  );
}

function MobileQuickReviewTools() {
  return (
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
  );
}

function MobileNavigationDrawer({
  isOpen,
  onClose,
  pathname,
  navItems,
  user,
  onLogout,
  isOnline,
  pendingCount,
  isSyncing,
  onSync,
}: Readonly<MobileDrawerProps>) {
  if (!isOpen) return null;

  return (
    <div
      id="mobile-navigation-menu"
      className="xl:hidden bg-slate-950 border-b border-slate-800/80 px-4 sm:px-6 md:px-8 pt-3 pb-5 space-y-4 shadow-2xl animate-in fade-in slide-from-top-2 duration-200 max-h-[calc(100dvh-4rem)] overflow-y-auto"
    >
      <MobileDrawerSyncButton
        isOnline={isOnline}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onSync={onSync}
      />

      <div>
        <p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
          Navigation
        </p>
        <nav className="flex flex-col space-y-1">
          {navItems.map((item) => {
            const isActive = isRouteActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                  isActive
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">
                    &bull; Active
                  </span>
                )}
              </Link>
            );
          })}
          {user && (
            <InstallEntryLink
              label="Install GovStudyX"
              onNavigate={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold transition text-blue-400 hover:text-blue-300 hover:bg-slate-900 border border-blue-500/20 hover:border-blue-500/40 inline-flex items-center gap-2"
            />
          )}
        </nav>
      </div>

      {user && <MobileQuickReviewTools />}

      <div className="pt-3 border-t border-slate-900 flex items-center justify-between">
        <MobileDrawerUserSection user={user} onLogout={onLogout} />
      </div>

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
  );
}

export default function Navbar(): ReactNode {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    clearAuth,
    pauseActivityHeartbeat,
    resumeActivityHeartbeat,
  } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineSync();

  useEffect(() => {
    const timer = setTimeout(() => {
      setMobileMenuOpen(false);
    }, 0);

    return () => clearTimeout(timer);
  }, [pathname]);

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
    pauseActivityHeartbeat();
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) {
        clearAuth();
      } else {
        resumeActivityHeartbeat();
      }
      router.push("/login");
      router.refresh();
    } catch (err: unknown) {
      resumeActivityHeartbeat();
      console.error("Logout failed:", err);
    }
  };

  const navItems = useMemo(() => getAppNavItems(user?.role), [user?.role]);
  const isLandingPage = pathname === "/";
  const isDashboardPage = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  // Admin routes already render an independent sticky header.
  const hasIndependentNavigation = isRouteActive(pathname, "/admin");

  return (
    <header
      className={`${
        isLandingPage ? "hidden xl:block" : (isDashboardPage || hasIndependentNavigation) ? "hidden" : "block"
      } bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-50`}
    >
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
              const isActive = isRouteActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
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
            {user && (
              <InstallEntryLink
                label="Install App"
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition text-blue-400 hover:text-blue-300 hover:bg-slate-900 border border-blue-500/20 hover:border-blue-500/30 inline-flex items-center gap-1.5"
              />
            )}
          </nav>
        </div>

        {/* DESKTOP ACTIONS */}
        <div className="hidden xl:flex items-center gap-3">
          <SyncStatusButton
            isOnline={isOnline}
            pendingCount={pendingCount}
            isSyncing={isSyncing}
            onSync={() => void syncNow()}
          />

          <DesktopUserSection user={user} onLogout={() => void handleLogout()} />
          
        </div>

        {/* MOBILE/TABLET HEADER ACTIONS */}
        <div className="flex items-center gap-2 xl:hidden">
          
          <SyncStatusButton
            isOnline={isOnline}
            pendingCount={pendingCount}
            isSyncing={isSyncing}
            onSync={() => void syncNow()}
            className="hidden sm:flex"
          />

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
            onClick={() => setMobileMenuOpen((prev) => !prev)}
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

      <MobileNavigationDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        pathname={pathname}
        navItems={navItems}
        user={user}
        onLogout={() => void handleLogout()}
        isOnline={isOnline}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onSync={() => void syncNow()}
      />
    </header>
  );
}