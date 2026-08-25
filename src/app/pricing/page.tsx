"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Plan {
  planType: string;
  name: string;
  price: number;
  durationDays: number;
}

const FALLBACK_PLANS: Plan[] = [
  {
    planType: "1_MONTH",
    name: "1-Month Pass",
    price: 99,
    durationDays: 30,
  },
  {
    planType: "6_MONTHS",
    name: "6-Month Pass",
    price: 199,
    durationDays: 180,
  },
  {
    planType: "1_YEAR",
    name: "1-Year Pass",
    price: 299,
    durationDays: 365,
  },
];

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPricing() {
      try {
        const res = await fetch("/api/pricing", {
          cache: "no-store",
        });

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as {
          plans?: Plan[];
        };

        if (
          !cancelled &&
          Array.isArray(data.plans) &&
          data.plans.length > 0
        ) {
          setPlans(data.plans);
        }
      } catch (error) {
        console.warn("Could not load current pricing:", error);
      }
    }

    void loadPricing();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCheckout = async (planType: string) => {
    setLoadingPlan(planType);

    try {
      const res = await fetch("/api/paymongo/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planType }),
      });

      const data = await res.json();

      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      alert(data.error || "Failed to launch payment.");
    } catch (error) {
      console.error(error);
      alert("Error starting checkout session.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-16 px-4">
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <Link
            href="/dashboard"
            className="text-blue-600 font-semibold hover:underline mb-6 inline-block"
          >
            &larr; Back to Dashboard
          </Link>

          <h1 className="text-4xl font-extrabold text-slate-900">
            Upgrade to PRO
          </h1>

          <p className="text-lg text-slate-600 mt-4">
            Choose the access period that fits your review schedule.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const recommended = plan.planType === "6_MONTHS";

            return (
              <div
                key={plan.planType}
                className={
                  recommended
                    ? "bg-slate-900 rounded-3xl p-7 border-2 border-emerald-500 shadow-xl flex flex-col relative"
                    : "bg-white rounded-3xl p-7 border border-slate-200 shadow-sm flex flex-col"
                }
              >
                {recommended && (
                  <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-xs font-bold px-4 py-1 rounded-bl-lg uppercase">
                    Recommended
                  </div>
                )}

                <h2
                  className={
                    recommended
                      ? "text-xl font-bold text-white"
                      : "text-xl font-bold text-slate-900"
                  }
                >
                  {plan.name}
                </h2>

                <div className="my-6">
                  <span
                    className={
                      recommended
                        ? "text-4xl font-extrabold text-white"
                        : "text-4xl font-extrabold text-slate-900"
                    }
                  >
                    ₱{plan.price}
                  </span>

                  <span
                    className={
                      recommended
                        ? "text-slate-400 font-medium"
                        : "text-slate-500 font-medium"
                    }
                  >
                    {" "}
                    / {plan.durationDays} days
                  </span>
                </div>

                <ul
                  className={
                    recommended
                      ? "space-y-3 mb-8 flex-1 text-slate-200 text-sm"
                      : "space-y-3 mb-8 flex-1 text-slate-700 text-sm"
                  }
                >
                  <li>✓ Unlimited Full Mock Exams</li>
                  <li>✓ Category-Specific Speed Drills</li>
                  <li>✓ Full Access to Study Notes</li>
                  <li>✓ CSE Review Tools and Analytics</li>
                </ul>

                <button
                  type="button"
                  onClick={() => handleCheckout(plan.planType)}
                  disabled={loadingPlan !== null}
                  className={
                    recommended
                      ? "w-full py-4 rounded-xl font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-60"
                      : "w-full py-4 rounded-xl font-black bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-60"
                  }
                >
                  {loadingPlan === plan.planType
                    ? "Connecting to PayMongo..."
                    : `Pay ₱${plan.price} via PayMongo`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
