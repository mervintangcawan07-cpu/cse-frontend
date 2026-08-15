"use client";

import React from "react";

interface EliminationStrategyCardProps {
  strategy?: string | null;
}

export default function EliminationStrategyCard({ strategy }: EliminationStrategyCardProps) {
  if (!strategy || !strategy.trim()) return null;

  return (
    <div className="p-3.5 sm:p-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl space-y-1.5 shadow-2xs min-w-0 break-words">
      <div className="flex items-center gap-1.5 font-black text-blue-900 dark:text-blue-300 uppercase text-[10px] sm:text-[11px] tracking-wider">
        <span>⚡</span>
        <span>Elimination Strategy</span>
      </div>
      <p className="text-blue-950 dark:text-blue-200 text-xs sm:text-sm leading-relaxed font-medium break-words">
        {strategy.trim()}
      </p>
    </div>
  );
}
