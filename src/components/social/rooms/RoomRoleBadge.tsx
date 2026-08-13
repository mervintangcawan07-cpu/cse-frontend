// Relative Path: src/components/social/rooms/RoomRoleBadge.tsx
"use client";

import React from "react";

export type RoomRole = "HOST" | "MODERATOR" | "MEMBER";

interface RoomRoleBadgeProps {
  role: RoomRole | string;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export const RoomRoleBadge: React.FC<RoomRoleBadgeProps> = ({
  role,
  size = "sm",
  showLabel = true,
}) => {
  const normalizedRole = (role || "MEMBER").toUpperCase();

  const getBadgeStyle = () => {
    switch (normalizedRole) {
      case "HOST":
        return {
          icon: "👑",
          label: "Host",
          classes: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        };
      case "MODERATOR":
        return {
          icon: "🛡️",
          label: "Moderator",
          classes: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
        };
      default:
        return {
          icon: "🧑‍🎓",
          label: "Member",
          classes: "bg-slate-800/80 text-slate-400 border-slate-700/60",
        };
    }
  };

  const { icon, label, classes } = getBadgeStyle();
  const textClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-extrabold shrink-0 ${classes} ${textClass}`}
      title={`Room Role: ${label}`}
    >
      <span>{icon}</span>
      {showLabel && <span>{label}</span>}
    </span>
  );
};
