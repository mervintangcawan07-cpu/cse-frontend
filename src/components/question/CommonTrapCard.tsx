"use client";

import React from "react";

interface CommonTrapCardProps {
  trap?: string | null;
}

export default function CommonTrapCard({ trap }: CommonTrapCardProps) {
  if (!trap || !trap.trim()) return null;

  return (
    <div className="p-3.5 sm:p-4 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl space-y-1.5 shadow-2xs">
      <div className="flex items-center gap-1.5 font-black text-rose-900 dark:text-rose-300 uppercase text-[10px] sm:text-[11px] tracking-wider">
        <span>⚠️</span>
        <span>Common Trap</span>
      </div>
      <p className="text-rose-950 dark:text-rose-200 text-xs sm:text-sm leading-relaxed font-medium">
        {trap.trim()}
      </p>
    </div>
  );
}
