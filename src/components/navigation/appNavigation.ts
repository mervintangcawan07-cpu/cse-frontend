import { USER_REFERRAL_ENABLED } from "@/lib/referral/config";
import { STUDY_TOGETHER_ENABLED } from "@/lib/config/features";

export interface AppNavItem {
  readonly label: string;
  readonly href: string;
}

export const APP_ROUTES = {
  dashboard: "/dashboard",
  practice: "/practice",
  learning: "/learning",
  profile: "/profile",
  mistakes: "/mistakes",
  badges: "/badges",
  drills: "/drills",
  flashcards: "/flashcards",
  readinessCard: "/readiness-card",
  social: "/social",
  referrals: "/referrals",
  admin: "/admin",
  pricing: "/pricing",
  support: "/support",
} as const;

export const REVIEW_TOOL_ITEMS: readonly AppNavItem[] = [
  { label: "Mistakes", href: APP_ROUTES.mistakes },
  { label: "Badges", href: APP_ROUTES.badges },
  { label: "Elimination Drills", href: APP_ROUTES.drills },
  { label: "Recall Flashcards", href: APP_ROUTES.flashcards },
];

export function getAppNavItems(role?: string | null): readonly AppNavItem[] {
  const items: AppNavItem[] = [
    { label: "Dashboard", href: APP_ROUTES.dashboard },
    { label: "Practice & Prep", href: APP_ROUTES.practice },
    { label: "Learning Hub", href: APP_ROUTES.learning },
  ];

  if (STUDY_TOGETHER_ENABLED) {
    items.push({ label: "Study Together", href: APP_ROUTES.social });
  }

  if (USER_REFERRAL_ENABLED) {
    items.push({ label: "Referrals", href: APP_ROUTES.referrals });
  }

  if (role === "ADMIN") {
    items.push({ label: "Admin Portal", href: APP_ROUTES.admin });
  }

  return items;
}

export function isRouteActive(pathname: string, href: string): boolean {
  if (href === APP_ROUTES.dashboard) {
    return pathname === APP_ROUTES.dashboard || pathname.startsWith(`${APP_ROUTES.dashboard}/`);
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
