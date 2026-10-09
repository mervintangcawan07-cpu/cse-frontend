"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import MobileBottomNavigation from "../navigation/MobileBottomNavigation";
import { LEARNING_RESOURCE_ROUTE_PREFIXES } from "../navigation/appNavigation";

const MOBILE_APP_ROUTE_PREFIXES = [
  "/dashboard",
  "/practice",
  "/learning",
  ...LEARNING_RESOURCE_ROUTE_PREFIXES,
  "/profile",
  "/mistakes",
  "/badges",
  "/drills",
  "/readiness-card",
  "/social",
  "/referrals",
] as const;

function isMobileAppRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return MOBILE_APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default function AppViewportShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const { user } = useAuth();
  const showBottomNavigation = Boolean(user) && isMobileAppRoute(pathname);

  return (
    <>
      <div
        className={`w-full flex-grow ${
          showBottomNavigation ? "pb-[calc(4.75rem+env(safe-area-inset-bottom))] xl:pb-0" : ""
        }`}
      >
        {children}
      </div>

      {showBottomNavigation && (
        <MobileBottomNavigation key={pathname ?? "govstudyx-app-navigation"} />
      )}
    </>
  );
}

