import type { DashboardAnalytics, Plan } from "./dashboardTypes";

export const DEFAULT_PLANS: readonly Plan[] = [
  { planType: "1_MONTH", name: "1-Month Pass", price: 99, durationDays: 30 },
  { planType: "6_MONTHS", name: "6-Month Pass", price: 199, durationDays: 180 },
  { planType: "1_YEAR", name: "1-Year Pass", price: 299, durationDays: 365 },
];

export const DEFAULT_DASHBOARD_ANALYTICS: DashboardAnalytics = {
  totalExams: 0,
  averageScore: 0,
  passReadinessScore: 0,
  currentStreak: 1,
  longestStreak: 1,
  totalBookmarks: 0,
  recommendation: "Focus on your daily practice question to build exam confidence.",
  recentHistory: [],
};

