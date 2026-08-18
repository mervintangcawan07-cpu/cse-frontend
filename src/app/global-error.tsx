"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CRITICAL_ROOT_LAYOUT_ERROR]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center text-3xl mx-auto border border-rose-500/30">
            ⚠️
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-white">Application Error</h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              An unexpected system error occurred. You can reload the application or return to the home page.
            </p>
            {error?.digest && (
              <p className="text-[10px] font-mono text-slate-500 pt-1">
                Error ID: {error.digest}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
            >
              🔄 Reload Application
            </button>
            <a
              href="/"
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Home Page
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
