"use client";

import React from "react";
import { ResolvedPresence } from "@/lib/social/presence";

interface PresenceBadgeProps {
  presence: ResolvedPresence | null | undefined;
  variant?: "dot-only" | "pill" | "full";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const PresenceBadge: React.FC<PresenceBadgeProps> = ({
  presence,
  variant = "pill",
  size = "md",
  className = "",
}) => {
  if (!presence) return null;

  const dotSizeClasses = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  }[size];

  const textSizeClasses = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
  }[size];

  if (variant === "dot-only") {
    return (
      <span
        title={`${presence.label}${presence.customStatusText ? ` - "${presence.customStatusText}"` : ""}`}
        className={`inline-block rounded-full ${presence.dotColor} ${dotSizeClasses} ${className}`}
      />
    );
  }

  if (variant === "pill") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${presence.badgeBg} ${presence.badgeText} ${textSizeClasses} font-extrabold ${className}`}
      >
        <span className={`rounded-full ${presence.dotColor} ${dotSizeClasses} shrink-0`} />
        <span>{presence.label}</span>
        {presence.customStatusEmoji && <span>{presence.customStatusEmoji}</span>}
      </div>
    );
  }

  // Full Variant with Custom Status Text
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${presence.badgeBg} ${presence.badgeText} ${textSizeClasses} font-extrabold`}>
        <span className={`rounded-full ${presence.dotColor} ${dotSizeClasses} shrink-0`} />
        <span>{presence.label}</span>
      </div>

      {presence.customStatusText && (
        <span className="text-[11px] text-slate-300 italic flex items-center gap-1 max-w-[200px] truncate">
          {presence.customStatusEmoji && <span>{presence.customStatusEmoji}</span>}
          <span>"{presence.customStatusText}"</span>
        </span>
      )}
    </div>
  );
};
