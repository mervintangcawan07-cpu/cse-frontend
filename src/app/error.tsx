"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GLOBAL_APP_ERROR]", error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="inline-flex p-5 bg-rose-50 text-rose-600 rounded-3xl border border-rose-100 text-3xl">
        ⚠️
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl font-extrabold text-slate-900">Something Went Wrong</h1>
        <p className="text-slate-500 text-sm leading-relaxed">
          An unexpected error occurred while processing your request. Try reloading the page or return to the main dashboard.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition"
        >
          Try Again
        </button>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}