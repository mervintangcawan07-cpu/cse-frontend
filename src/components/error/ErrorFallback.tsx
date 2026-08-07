// Relative Path: src/components/error/ErrorFallback.tsx
"use client";

import React from "react";

interface ErrorFallbackProps {
  error: Error | null;
  errorId?: string;
  resetErrorBoundary?: () => void;
}

export function ErrorFallback({
  error,
  errorId,
  resetErrorBoundary,
}: ErrorFallbackProps) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-slate-950 text-white rounded-3xl border border-slate-800 shadow-2xl">
      <div className="max-w-md w-full space-y-5 text-center">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto text-2xl text-rose-400">
          ⚠️
        </div>

        <div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-rose-500/20 text-rose-400 rounded-full border border-rose-500/30">
            System Alert
          </span>
          <h2 className="text-xl font-black mt-3">Something Went Wrong</h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            An unexpected application error occurred. Our automated telemetry has logged this incident for review.
          </p>
        </div>

        {errorId && (
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Reference Incident ID</span>
            <code className="text-xs font-mono text-blue-400 select-all">{errorId}</code>
          </div>
        )}

        {isDev && error && (
          <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-xl text-left overflow-x-auto max-h-36 text-xs text-rose-300 font-mono">
            <p className="font-bold">{error.name}: {error.message}</p>
            {error.stack && <pre className="text-[10px] text-rose-400/80 mt-1 whitespace-pre-wrap">{error.stack}</pre>}
          </div>
        )}

        <div className="flex gap-3">
          {resetErrorBoundary && (
            <button
              onClick={resetErrorBoundary}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer"
            >
              🔄 Try Again
            </button>
          )}
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            🏠 Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
