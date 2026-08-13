// Relative Path: src/lib/social/presence.ts

export type PresenceStatusType = "ONLINE" | "AWAY" | "BUSY" | "OFFLINE";

export interface ResolvedPresence {
  status: PresenceStatusType;
  label: string;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
  customStatusText: string | null;
  customStatusEmoji: string | null;
  isOnline: boolean;
  lastActiveFormatted?: string;
}

export function resolveUserPresence(
  lastActiveAt: Date | string | null | undefined,
  studyProfile?: {
    presenceStatus?: string | null;
    customStatusText?: string | null;
    customStatusEmoji?: string | null;
    showActivity?: boolean | null;
  } | null
): ResolvedPresence {
  // If user disabled activity visibility, appear offline
  if (studyProfile?.showActivity === false) {
    return {
      status: "OFFLINE",
      label: "Offline",
      dotColor: "bg-slate-500",
      badgeBg: "bg-slate-800/80",
      badgeText: "text-slate-400",
      customStatusText: null,
      customStatusEmoji: null,
      isOnline: false,
    };
  }

  const customText = studyProfile?.customStatusText || null;
  const customEmoji = studyProfile?.customStatusEmoji || null;
  const manualPreference = (studyProfile?.presenceStatus || "ONLINE").toUpperCase() as PresenceStatusType;

  if (manualPreference === "OFFLINE") {
    return {
      status: "OFFLINE",
      label: "Appear Offline",
      dotColor: "bg-slate-500",
      badgeBg: "bg-slate-800/80",
      badgeText: "text-slate-400",
      customStatusText: null,
      customStatusEmoji: null,
      isOnline: false,
    };
  }

  if (!lastActiveAt) {
    return {
      status: "OFFLINE",
      label: "Offline",
      dotColor: "bg-slate-500",
      badgeBg: "bg-slate-800/80",
      badgeText: "text-slate-400",
      customStatusText: null,
      customStatusEmoji: null,
      isOnline: false,
    };
  }

  const activeTime = new Date(lastActiveAt).getTime();
  const now = Date.now();
  const diffMinutes = (now - activeTime) / (1000 * 60);

  // Inactive for more than 15 minutes -> OFFLINE
  if (diffMinutes >= 15) {
    let lastActiveFormatted = "Active recently";
    if (diffMinutes < 60) {
      lastActiveFormatted = `${Math.floor(diffMinutes)}m ago`;
    } else if (diffMinutes < 1440) {
      lastActiveFormatted = `${Math.floor(diffMinutes / 60)}h ago`;
    }

    return {
      status: "OFFLINE",
      label: "Offline",
      dotColor: "bg-slate-500",
      badgeBg: "bg-slate-800/80",
      badgeText: "text-slate-400",
      customStatusText: null,
      customStatusEmoji: null,
      isOnline: false,
      lastActiveFormatted,
    };
  }

  // If user explicitly set BUSY
  if (manualPreference === "BUSY") {
    return {
      status: "BUSY",
      label: "Busy / In Focus",
      dotColor: "bg-rose-500",
      badgeBg: "bg-rose-500/10 border border-rose-500/20",
      badgeText: "text-rose-400",
      customStatusText: customText,
      customStatusEmoji: customEmoji || "🔴",
      isOnline: true,
    };
  }

  // If user explicitly set AWAY, or was idle for 3–15 minutes
  if (manualPreference === "AWAY" || diffMinutes >= 3) {
    return {
      status: "AWAY",
      label: "Away",
      dotColor: "bg-amber-400",
      badgeBg: "bg-amber-500/10 border border-amber-500/20",
      badgeText: "text-amber-400",
      customStatusText: customText,
      customStatusEmoji: customEmoji || "🟡",
      isOnline: true,
    };
  }

  // Default: ONLINE (Active within 3 minutes)
  return {
    status: "ONLINE",
    label: "Online",
    dotColor: "bg-emerald-400 animate-pulse",
    badgeBg: "bg-emerald-500/10 border border-emerald-500/20",
    badgeText: "text-emerald-400",
    customStatusText: customText,
    customStatusEmoji: customEmoji || "🟢",
    isOnline: true,
  };
}
