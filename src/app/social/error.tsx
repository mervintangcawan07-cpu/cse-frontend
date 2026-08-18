"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function SocialError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SOCIAL_ROUTE_ERROR]", error);
  }, [error]);

  return (
    <div className="w-full max-w-xl mx-auto py-12 px-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-xl">
        <div className="w-14 h-14 bg-indigo-500/20 text-indigo-500 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-indigo-500/30">
          👥
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Study Together Error</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            We ran into an issue connecting to this social module. Try refreshing or return to the main Study Hub.
          </p>
          {error?.digest && (
            <p className="text-[10px] font-mono text-slate-400 pt-1">
              Error Digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition shadow-sm cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/social"
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Study Hub
          </Link>
        </div>
      </div>
    </div>
  );
}
