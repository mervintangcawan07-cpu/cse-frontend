"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import ThemeToggle from "@/components/common/ThemeToggle";
import InstallEntryLink from "@/components/pwa/InstallEntryLink";
import CSCServicesSheet from "@/components/csc/CSCServicesSheet";
import {
  APP_ROUTES,
  REVIEW_TOOL_ITEMS,
  getAppNavItems,
  isRouteActive,
  type AppNavItem,
} from "@/components/navigation/appNavigation";
import {
  BadgeIcon,
  CSCIcon,
  CommunityIcon,
  DrillIcon,
  FlashcardIcon,
  GiftIcon,
  HomeIcon,
  LearningIcon,
  LogoutIcon,
  MistakesIcon,
  PracticeIcon,
  ProfileIcon,
  ShieldIcon,
  SupportIcon,
  SyncIcon,
} from "@/components/navigation/MobileNavIcons";

function iconForRoute(href: string) {
  switch (href) {
    case APP_ROUTES.dashboard:
      return <HomeIcon />;
    case APP_ROUTES.practice:
      return <PracticeIcon />;
    case APP_ROUTES.learning:
      return <LearningIcon />;
    case APP_ROUTES.profile:
      return <ProfileIcon />;
    case APP_ROUTES.mistakes:
      return <MistakesIcon />;
    case APP_ROUTES.badges:
      return <BadgeIcon />;
    case APP_ROUTES.drills:
      return <DrillIcon />;
    case APP_ROUTES.flashcards:
      return <FlashcardIcon />;
    case APP_ROUTES.social:
      return <CommunityIcon />;
    case APP_ROUTES.referrals:
      return <GiftIcon />;
    case APP_ROUTES.admin:
      return <ShieldIcon />;
    default:
      return <HomeIcon />;
  }
}

function SidebarLink({
  item,
  pathname,
}: Readonly<{
  item: AppNavItem;
  pathname: string;
}>) {
  const active = isRouteActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        active
          ? "border border-blue-500/30 bg-blue-500/15 text-blue-300"
          : "border border-transparent text-slate-400 hover:bg-slate-900 hover:text-white"
      }`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
          active
            ? "bg-blue-500/15 text-blue-300"
            : "bg-slate-900 text-slate-500 group-hover:text-slate-300"
        }`}
      >
        {iconForRoute(item.href)}
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SectionTitle({ children }: Readonly<{ children: string }>) {
  return (
    <p className="px-3 pb-1.5 pt-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">
      {children}
    </p>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    clearAuth,
    pauseActivityHeartbeat,
    resumeActivityHeartbeat,
  } = useAuth();

  const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineSync();
  const [cscOpen, setCscOpen] = useState(false);

  const navItems = useMemo(() => getAppNavItems(user?.role), [user?.role]);
  const mainItems = navItems.slice(0, 3);
  const conditionalItems = navItems.slice(3);
  const initial = user?.name?.trim()?.[0]?.toUpperCase() || "U";

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

  const showSyncStatus = !isOnline || pendingCount > 0;

  return (
    <>
      <aside className="hidden h-dvh w-72 shrink-0 flex-col border-r border-slate-800/90 bg-slate-950 text-slate-300 xl:sticky xl:top-0 xl:flex 2xl:w-80">
        <div className="flex h-20 shrink-0 items-center border-b border-slate-900 px-6 2xl:px-7">
          <Link
            href={APP_ROUTES.dashboard}
            className="inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <span className="h-9 w-9 overflow-hidden rounded-xl ring-1 ring-white/10">
              <Image
                src="/brand/govstudyx-icon.png"
                alt=""
                width={36}
                height={36}
                className="h-full w-full object-cover"
              />
            </span>
            <span className="text-base font-black tracking-tight text-white">
              GovStudy<span className="text-blue-400">X</span>
            </span>
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 2xl:px-5">
          <SectionTitle>Main</SectionTitle>

          <nav className="space-y-1" aria-label="Desktop application navigation">
            {mainItems.map((item) => (
              <SidebarLink key={item.href} item={item} pathname={pathname} />
            ))}

            <button
              type="button"
              onClick={() => setCscOpen(true)}
              className="group flex min-h-[42px] w-full items-center gap-3 rounded-xl border border-transparent px-3 text-left text-xs font-bold text-slate-400 transition hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-slate-500 transition group-hover:text-slate-300">
                <CSCIcon />
              </span>
              <span>CSC Services</span>
            </button>

            <SidebarLink
              item={{ label: "Profile", href: APP_ROUTES.profile }}
              pathname={pathname}
            />
          </nav>

          <SectionTitle>Review Tools</SectionTitle>
          <nav className="space-y-1" aria-label="Review tools">
            {REVIEW_TOOL_ITEMS.map((item) => (
              <SidebarLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>

          {(conditionalItems.length > 0 || user) && (
            <>
              <SectionTitle>More</SectionTitle>
              <nav className="space-y-1" aria-label="Additional application links">
                {conditionalItems.map((item) => (
                  <SidebarLink key={item.href} item={item} pathname={pathname} />
                ))}

                <Link
                  href={APP_ROUTES.pricing}
                  className="group flex min-h-[42px] items-center gap-3 rounded-xl border border-transparent px-3 text-xs font-bold text-slate-400 transition hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-slate-500 group-hover:text-slate-300">
                    <ShieldIcon />
                  </span>
                  <span>PRO & Pricing</span>
                </Link>

                {user && (
                  <InstallEntryLink
                    label="Install GovStudyX"
                    className="group flex min-h-[42px] w-full items-center gap-3 rounded-xl border border-transparent px-3 text-xs font-bold text-blue-400 transition hover:bg-slate-900 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  />
                )}
              </nav>
            </>
          )}
        </div>

        <div className="shrink-0 space-y-2.5 border-t border-slate-900 p-4 2xl:p-5">
          {showSyncStatus && (
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={isSyncing || !isOnline}
              className="flex min-h-[42px] w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 text-xs font-bold text-slate-300 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-blue-400">
                <SyncIcon />
              </span>
              <span className="min-w-0 flex-1 text-left">
                {!isOnline
                  ? "Offline Mode"
                  : isSyncing
                  ? "Syncing..."
                  : `${pendingCount} Pending`}
              </span>
            </button>
          )}

          <Link
            href={APP_ROUTES.support}
            className="flex min-h-[38px] items-center gap-2 rounded-xl px-3 text-[11px] font-bold text-slate-500 transition hover:bg-slate-900 hover:text-slate-300"
          >
            <SupportIcon className="h-4 w-4" />
            <span>Support</span>
          </Link>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-2.5">
            <Link
              href={APP_ROUTES.profile}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-700 bg-slate-800 text-xs font-black uppercase text-blue-400"
              title={user?.name || "My Account"}
            >
              {initial}
            </Link>

            <Link href={APP_ROUTES.profile} className="min-w-0 flex-1">
              <span className="block truncate text-xs font-black text-slate-200">
                {user?.name || "My Account"}
              </span>
              <span className="block truncate text-[9px] font-bold uppercase tracking-wide text-slate-600">
                {user?.role === "ADMIN" ? "Administrator" : "Examinee"}
              </span>
            </Link>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              aria-label="Log out"
              title="Log out"
            >
              <LogoutIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <CSCServicesSheet isOpen={cscOpen} onClose={() => setCscOpen(false)} />
    </>
  );
}
