// Relative Path: src/components/common/CookieConsent.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

interface ConsentSettings {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

const STORAGE_KEY = "govstudyx_cookie_consent";

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        // Delay slightly for smooth page load
        const timer = setTimeout(() => setShowBanner(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // LocalStorage access issues (e.g. strict private browsing mode)
    }
  }, []);

  const saveConsent = (settings: ConsentSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn("Could not save cookie consent:", err);
    }
    setShowBanner(false);
    setShowModal(false);
  };

  const handleAcceptAll = () => {
    saveConsent({
      essential: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
    });
  };

  const handleDeclineNonEssential = () => {
    saveConsent({
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
    });
  };

  const handleSaveCustom = () => {
    saveConsent({
      essential: true,
      analytics,
      marketing,
      timestamp: new Date().toISOString(),
    });
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Floating Bottom Cookie Consent Banner */}
      <aside
        aria-label="Cookie consent banner"
        className="fixed bottom-3 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-md bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🍪</span>
            <h2 className="font-extrabold text-sm text-white tracking-wide">
              Cookie &amp; Privacy Preferences
            </h2>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {siteConfig.name} uses essential cookies to keep you signed in, manage test sessions, and secure payments. We also use optional analytics and advertising technologies to improve your review experience.
          </p>

          <p className="text-[11px] text-slate-400">
            Read our{" "}
            <Link href="/cookies" className="text-blue-400 underline font-semibold hover:text-blue-300">
              Cookie Policy
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-blue-400 underline font-semibold hover:text-blue-300">
              Privacy Policy
            </Link>
            .
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleAcceptAll}
              className="flex-1 py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white text-xs font-black rounded-xl shadow-md transition cursor-pointer text-center"
            >
              Accept All
            </button>
            <button
              type="button"
              onClick={handleDeclineNonEssential}
              className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer text-center"
            >
              Essential Only
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="py-2.5 px-3 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer text-center"
            >
              Customize
            </button>
          </div>
        </div>
      </aside>

      {/* Customize Preferences Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <h3 className="text-lg font-black text-white">Customize Cookies</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Essential */}
              <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/70 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="font-extrabold text-slate-200 uppercase tracking-wide text-[11px]">
                    Strictly Essential Cookies
                  </span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Necessary for user login, session authentication, CSRF security, and PayMongo transactions.
                  </p>
                </div>
                <span className="shrink-0 px-2.5 py-1 bg-blue-500/20 text-blue-300 text-[10px] font-black rounded-lg border border-blue-500/30 uppercase">
                  Always Active
                </span>
              </div>

              {/* Analytics */}
              <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/70 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="font-extrabold text-slate-200 uppercase tracking-wide text-[11px]">
                    Performance &amp; Analytics
                  </span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Help us track practice test usage, error reports, and feature response times to optimize performance.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Marketing / AdSense */}
              <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/70 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="font-extrabold text-slate-200 uppercase tracking-wide text-[11px]">
                    Marketing &amp; Advertising
                  </span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Used by advertising networks (e.g. Google AdSense) to measure and serve relevant educational ads.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustom}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
