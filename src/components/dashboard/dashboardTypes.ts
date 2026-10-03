export interface Plan {
  planType: string;
  name: string;
  price: number;
  durationDays: number;
}

export interface DetailedAnalytics {
  summary: {
    totalExamsTaken: number;
    averageScore: number;
    highestScore: number;
    drillsCompleted: number;
    estimatedPassRate: string;
  };
  scoreHistory: { date: string; score: number; passing: number }[];
  categoryBreakdown: { category: string; score: number; color: string }[];
}

export interface DashboardAnalytics {
  totalExams: number;
  averageScore: number;
  passReadinessScore: number;
  currentStreak: number;
  longestStreak: number;
  totalBookmarks: number;
  recommendation: string;
  recentHistory: Array<{
    id: string;
    score: number;
    correct: number;
    totalItems: number;
    date: string;
  }>;
}

export interface DashboardUser {
  name?: string | null;
  role?: string | null;
  isPaid?: boolean | null;
  paidUntil?: string | Date | null;
}

export interface DashboardViewProps {
  user: DashboardUser | null;
  paymentStatus: string | null;
  isAdmin: boolean;
  isPaid: boolean;
  daysRemaining: number | null;
  plans: readonly Plan[];
  selectedPlan: string;
  checkoutLoading: boolean;
  dashAnalytics: DashboardAnalytics | null;
  analytics: DetailedAnalytics | null;
  analyticsError: boolean;
  analyticsLoading: boolean;
  onPlanChange: (planType: string) => void;
  onCheckout: (planType: string) => Promise<void> | void;
  onRetryAnalytics: () => Promise<void> | void;
}

