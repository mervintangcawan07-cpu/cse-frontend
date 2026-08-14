// Relative Path: src/components/common/DatabaseLoadingIndicator.tsx
"use client";

import React from "react";

interface DatabaseLoadingIndicatorProps {
  title?: string;
  subtitle?: string;
  showSkeletonCards?: boolean;
  skeletonCount?: number;
  className?: string;
}

export default function DatabaseLoadingIndicator({
  title = "Querying Civil Service Database...",
  subtitle = "Retrieving verified questions, diagnostics, and real-time records.",
  showSkeletonCards = true,
  skeletonCount = 3,
  className = "",
}: DatabaseLoadingIndicatorProps) {
  return (
    <div className={`w-full max-w-4xl mx-auto py-10 px-4 space-y-6 animate-in fade-in duration-300 ${className}`}>
      {/* Central Spinner & Status Badge */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center justify-center space-y-3">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-2xl shadow-inner">
              🗄️
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-950 border border-blue-500 flex items-center justify-center">
              <svg
                className="animate-spin h-3 w-3 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          </div>

          <div className="space-y-1 text-center max-w-md">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-wider text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span>Live Database Query</span>
            </div>
            <h3 className="text-base font-extrabold text-white">{title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Shimmer Skeleton Cards Preview */}
      {showSkeletonCards && (
        <div className="space-y-3">
          {Array.from({ length: skeletonCount }).map((_, idx) => (
            <div
              key={idx}
              className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex justify-between items-center animate-pulse"
              style={{ animationDelay: `${idx * 150}ms` }}
            >
              <div className="space-y-2.5 flex-1 pr-6">
                <div className="h-3.5 bg-slate-800 rounded-md w-1/3" />
                <div className="h-2.5 bg-slate-800/60 rounded-md w-2/3" />
              </div>
              <div className="w-20 h-7 bg-slate-800 rounded-xl shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
