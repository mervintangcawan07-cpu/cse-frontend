// Relative Path: src/components/pwa/InstallEntryLink.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";

/**
 * Local Navigator extension for iOS Safari standalone detection.
 * Strictly local to prevent global Navigator type pollution.
 */
type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

interface InstallEntryLinkProps {
  label?: string;
  className?: string;
  showIcon?: boolean;
  onNavigate?: () => void;
  "aria-label"?: string;
}

export default function InstallEntryLink({
  label = "Install App",
  className = "inline-flex items-center gap-1.5 px-3.5 py-2 font-bold text-xs text-blue-600 bg-blue-50/80 hover:bg-blue-100 rounded-xl border border-blue-200/60 transition",
  showIcon = true,
  onNavigate,
  "aria-label": ariaLabel,
}: InstallEntryLinkProps) {
  // ZERO-FLASH REQUIREMENT: default to false (unresolved/hidden)
  const [canShow, setCanShow] = useState(false);

  useEffect(() => {
    // 1. Standalone / Already Installed Detection
    const isChromiumStandalone =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches;

    const isIosStandalone =
      typeof navigator !== "undefined" &&
      (navigator as NavigatorWithStandalone).standalone === true;

    if (isChromiumStandalone || isIosStandalone) {
      setCanShow(false);
      return;
    }

    // Normal browser context: allow rendering the install discovery entry
    setCanShow(true);

    // 2. Hide immediately if the app becomes installed in this browser session
    const handleAppInstalled = () => {
      setCanShow(false);
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    // 3. Listen for display-mode changes (e.g. browser transitions to standalone)
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setCanShow(false);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleMediaChange);
    } else if ("addListener" in mediaQuery) {
      // Legacy Safari / Chromium fallback
      (mediaQuery as { addListener: (cb: (e: MediaQueryListEvent) => void) => void }).addListener(handleMediaChange);
    }

    return () => {
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleMediaChange);
      } else if ("removeListener" in mediaQuery) {
        (mediaQuery as { removeListener: (cb: (e: MediaQueryListEvent) => void) => void }).removeListener(handleMediaChange);
      }
    };
  }, []);

  if (!canShow) {
    return null;
  }

  return (
    <Link
      href="/install"
      onClick={onNavigate}
      className={className}
      aria-label={ariaLabel || label}
    >
      {showIcon && <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      <span>{label}</span>
    </Link>
  );
}
