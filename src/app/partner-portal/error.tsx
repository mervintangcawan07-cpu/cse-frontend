"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PartnerPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PARTNER_PORTAL_ROUTE_ERROR]", error);
  }, [error]);

  return (
    <div className="w-full max-w-2xl mx-auto py-16 px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
        <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-emerald-500/20">
          🤝
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-white">Partner Portal Error</h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            An error occurred while loading this view in the Partner Portal. You can retry the operation or return to your partner dashboard.
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
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-sm cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/partner-portal/dashboard"
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition border border-slate-700 cursor-pointer"
          >
            Partner Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
