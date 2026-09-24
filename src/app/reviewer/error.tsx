"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ReviewerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[REVIEWER_ROUTE_ERROR]", error);
  }, [error]);

  return (
    <div className="w-full max-w-2xl mx-auto py-16 px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
        <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-indigo-500/20">
          📚
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-white">Study Reviewer Error</h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            An unexpected error occurred while loading reviewer content. You can retry the operation or return to your dashboard.
          </p>
          {error?.digest && (
            <p className="text-[10px] font-mono text-slate-500 pt-1">
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
            href="/dashboard"
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition border border-slate-700 cursor-pointer"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
