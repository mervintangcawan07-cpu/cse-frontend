"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardView from "@/components/dashboard/DashboardView";
import DashboardLoadingState, { DashboardPageFallback } from "@/components/dashboard/DashboardLoadingState";
import { applyDashboardResults, fetchDashboardDatasets, syncPaymentVerification } from "@/components/dashboard/dashboardApi";
import { DEFAULT_PLANS } from "@/components/dashboard/dashboardDefaults";
import type { DashboardAnalytics, DetailedAnalytics, Plan } from "@/components/dashboard/dashboardTypes";
import { useAuth } from "@/context/AuthContext";

function DashboardContent() {
  const { user, status: authStatus, refreshAuth } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get("payment");

  const [plans, setPlans] = useState<readonly Plan[]>(DEFAULT_PLANS);
  const [analytics, setAnalytics] = useState<DetailedAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [dashAnalytics, setDashAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("6_MONTHS");
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!user?.paidUntil) {
        setDaysRemaining(null);
        return;
      }

      const targetTime = new Date(user.paidUntil).getTime();
      const diff = targetTime - Date.now();
      setDaysRemaining(Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))));
    }, 0);

    return () => clearTimeout(timer);
  }, [user?.paidUntil]);

  const fetchAnalyticsOnly = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(false);

    try {
      const response = await fetch("/api/user/analytics/detailed");
      if (response.ok) {
        const data = await response.json();
        if (data.analytics) {
          setAnalytics(data.analytics);
          setAnalyticsError(false);
          return;
        }
      }
      setAnalyticsError(true);
    } catch (err: unknown) {
      console.warn("Could not reload analytics:", err);
      setAnalyticsError(true);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "loading") return;

    if (authStatus === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (authStatus === "error" || !user) {
      const timer = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(timer);
    }

    const controller = new AbortController();

    async function checkAuthAndLoadDashboard() {
      if (paymentStatus === "success") {
        setVerifyingPayment(true);
        await syncPaymentVerification(controller.signal);
        if (!controller.signal.aborted) setVerifyingPayment(false);
      }

      try {
        const currentUser = paymentStatus === "success" ? await refreshAuth("entitlement") : user;
        if (!currentUser) {
          router.push("/login");
          return;
        }
        if (controller.signal.aborted) return;

        const results = await fetchDashboardDatasets(controller.signal);
        if (controller.signal.aborted) return;

        applyDashboardResults(results, {
          setPlans,
          setDashAnalytics,
          setAnalytics,
          setAnalyticsError,
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Dashboard auth check failed:", err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void checkAuthAndLoadDashboard();
    return () => controller.abort();
  }, [authStatus, paymentStatus, refreshAuth, router, user]);

  const handlePayMongoCheckout = async (planType: string) => {
    if (checkoutLoading) return;

    setCheckoutLoading(true);
    try {
      const response = await fetch("/api/paymongo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });
      const data = await response.json();

      if (response.ok && data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      } else {
        alert(data.error || "Failed to launch PayMongo checkout.");
      }
    } catch (err: unknown) {
      console.error("PayMongo checkout error:", err);
      alert("Error connecting to payment server.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const isAdmin = user?.role === "ADMIN";
  const isPaid = Boolean(user?.isPaid || isAdmin);

  if (loading || verifyingPayment) {
    return <DashboardLoadingState verifyingPayment={verifyingPayment} />;
  }

  return (
    <DashboardView
      user={user}
      paymentStatus={paymentStatus}
      isAdmin={isAdmin}
      isPaid={isPaid}
      daysRemaining={daysRemaining}
      plans={plans}
      selectedPlan={selectedPlan}
      checkoutLoading={checkoutLoading}
      dashAnalytics={dashAnalytics}
      analytics={analytics}
      analyticsError={analyticsError}
      analyticsLoading={analyticsLoading}
      onPlanChange={setSelectedPlan}
      onCheckout={handlePayMongoCheckout}
      onRetryAnalytics={fetchAnalyticsOnly}
    />
  );
}

export default function StudentDashboardPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <DashboardContent />
    </Suspense>
  );
}