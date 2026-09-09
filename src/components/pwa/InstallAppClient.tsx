// Relative Path: src/components/pwa/InstallAppClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Download,
  CheckCircle2,
  Share,
  PlusSquare,
  Smartphone,
  Monitor,
  ExternalLink,
  ArrowRight,
  Info,
} from "lucide-react";

/**
 * Local non-standard BeforeInstallPromptEvent interface.
 * Preserves strict typing without globally polluting the Window or Event hierarchy.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

/**
 * Local Navigator extension for iOS Safari standalone detection.
 * Avoids global Navigator prototype pollution or loose object casting.
 */
type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type InstallState =
  | "detecting"
  | "available"
  | "unavailable"
  | "ios"
  | "installed"
  | "dismissed";

export default function InstallAppClient() {
  const [installState, setInstallState] = useState<InstallState>("detecting");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // 1. Standalone / Already Installed Detection
    const isChromiumStandalone =
      window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches;
    const isIosStandalone =
      (navigator as NavigatorWithStandalone).standalone === true;

    if (isChromiumStandalone || isIosStandalone) {
      setIsStandalone(true);
      setInstallState("installed");
      return;
    }

    // 2. Platform Detection (lightweight user-agent check for UX guidance only)
    const ua = navigator.userAgent || "";
    const isIosDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    setIsIos(isIosDevice);

    if (isIosDevice) {
      setInstallState("ios");
      return;
    }

    // 3. Native Chromium / Android beforeinstallprompt Listener
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser default mini-infobar from appearing immediately
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setInstallState("available");
    };

    // 4. appinstalled Listener
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setInstallState("installed");
      setIsInstalling(false);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );
    window.addEventListener("appinstalled", handleAppInstalled);

    // If beforeinstallprompt hasn't fired after initial load, set to unavailable guidance
    const timer = setTimeout(() => {
      setInstallState((prev) => (prev === "detecting" ? "unavailable" : prev));
    }, 1200);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    try {
      // Explicit user-driven prompt activation
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === "accepted") {
        // Wait for appinstalled event to update to "installed"
        setDeferredPrompt(null);
      } else {
        // User dismissed native prompt
        setInstallState("dismissed");
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.error("Installation prompt failed:", err);
      setInstallState("unavailable");
      setDeferredPrompt(null);
    } finally {
      setIsInstalling(false);
    }
  };

  // Render: Already Installed State
  if (isStandalone || installState === "installed") {
    return (
      <div className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-4 shadow-sm dark:bg-emerald-950/20 dark:border-emerald-500/30">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            GovStudyX is already installed.
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            You can launch GovStudyX anytime directly from your home screen or
            application launcher.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:scale-98 transition shadow-sm"
          >
            <span>Open GovStudyX</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Render: iOS / iPadOS Safari Guided Flow
  if (installState === "ios") {
    return (
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm text-left">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Install on iPhone or iPad
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Follow these simple steps in Safari to add GovStudyX to your home
              screen.
            </p>
          </div>
        </div>

        <ol className="space-y-3.5 text-sm text-slate-700 dark:text-slate-300">
          <li className="flex items-start gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 mt-0.5">
              1
            </span>
            <span>
              Open <strong>govstudyx.com</strong> in <strong>Safari</strong>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 mt-0.5">
              2
            </span>
            <span className="flex-1">
              Tap the <strong>Share</strong> button{" "}
              <Share className="inline-block w-4 h-4 mx-1 text-blue-600 dark:text-blue-400 align-text-bottom" />{" "}
              in the Safari toolbar.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 mt-0.5">
              3
            </span>
            <span className="flex-1">
              Scroll down and tap <strong>Add to Home Screen</strong>{" "}
              <PlusSquare className="inline-block w-4 h-4 mx-1 text-slate-700 dark:text-slate-300 align-text-bottom" />
              .
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 mt-0.5">
              4
            </span>
            <span>
              Tap <strong>Add</strong> in the top-right corner to finish.
            </span>
          </li>
        </ol>

        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
          <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            Apple requires Safari for adding progressive web apps to your home
            screen.
          </span>
        </div>
      </div>
    );
  }

  // Render: Native Prompt Available (Android & Desktop Chromium)
  if (installState === "available") {
    return (
      <div className="w-full space-y-3 text-center">
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 text-base font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 rounded-2xl transition shadow-md hover:shadow-lg disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
        >
          <Download className="w-5 h-5" />
          <span>{isInstalling ? "Opening Prompt..." : "Install GovStudyX"}</span>
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Clicking will open your browser&apos;s native installation confirmation.
        </p>
      </div>
    );
  }

  // Render: Prompt Dismissed or Not Yet Available / Unsupported Browser
  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm text-left">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          <Monitor className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {installState === "dismissed"
              ? "Installation Dismissed"
              : "Install from Browser Menu"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {installState === "dismissed"
              ? "You can still install GovStudyX manually at any time."
              : "Use your browser menu to add GovStudyX to your device."}
          </p>
        </div>
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-2">
        <p className="font-semibold text-slate-900 dark:text-slate-100">
          For Chrome, Edge, or Android browsers:
        </p>
        <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
          <li>
            Open your browser menu (tap <strong>⋮</strong> or <strong>⋯</strong>{" "}
            in the toolbar).
          </li>
          <li>
            Choose <strong>Install GovStudyX</strong> or{" "}
            <strong>Add to Home screen</strong>.
          </li>
          <li>Confirm the prompt to add the icon to your launcher.</li>
        </ol>
      </div>

      <div className="text-center pt-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
        >
          <span>Continue to GovStudyX</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
