import type { DashboardAnalytics, DetailedAnalytics, Plan } from "./dashboardTypes";
import { DEFAULT_DASHBOARD_ANALYTICS } from "./dashboardDefaults";

export async function syncPaymentVerification(signal?: AbortSignal): Promise<void> {
  try {
    await fetch("/api/paymongo/verify", { method: "POST", signal });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    console.error("Payment sync error:", err);
  }
}

export async function fetchDashboardDatasets(signal?: AbortSignal) {
  return Promise.allSettled([
    fetch("/api/pricing", { cache: "no-store", signal }).then((response) =>
      response.ok ? response.json() : null
    ),
    fetch("/api/analytics/dashboard", { signal }).then((response) =>
      response.ok ? response.json() : null
    ),
    fetch("/api/user/analytics/detailed", { signal }).then((response) =>
      response.ok ? response.json() : null
    ),
  ]);
}

export function applyDashboardResults(
  results: [
    PromiseSettledResult<{ plans?: Plan[] } | null>,
    PromiseSettledResult<DashboardAnalytics | null>,
    PromiseSettledResult<{ analytics?: DetailedAnalytics } | null>,
  ],
  handlers: {
    setPlans: (plans: Plan[]) => void;
    setDashAnalytics: (data: DashboardAnalytics) => void;
    setAnalytics: (data: DetailedAnalytics | null) => void;
    setAnalyticsError: (error: boolean) => void;
  }
): void {
  const [plansRes, dashboardRes, analyticsRes] = results;

  if (plansRes.status === "fulfilled" && plansRes.value?.plans) {
    handlers.setPlans(plansRes.value.plans);
  }

  if (dashboardRes.status === "fulfilled" && dashboardRes.value) {
    handlers.setDashAnalytics(dashboardRes.value);
  } else {
    handlers.setDashAnalytics(DEFAULT_DASHBOARD_ANALYTICS);
  }

  if (analyticsRes.status === "fulfilled" && analyticsRes.value?.analytics) {
    handlers.setAnalytics(analyticsRes.value.analytics);
    handlers.setAnalyticsError(false);
  } else {
    handlers.setAnalyticsError(true);
  }
}

