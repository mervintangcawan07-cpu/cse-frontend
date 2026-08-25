// Relative Path: src/app/upgrade/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingButton from "@/components/common/LoadingButton";
import { useDoubleSubmitPreventer } from "@/hooks/useDoubleSubmitPreventer";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

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

export default function UpgradePage() {
  const router = useRouter();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [selectedPlan, setSelectedPlan] =
    useState<string>("6_MONTHS");

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

  const selected =
    plans.find((plan) => plan.planType === selectedPlan) ??
    FALLBACK_PLANS[1];

  const executeUpgrade = async () => {
    setErrorMsg(null);

    try {
      const res = await fetchWithTimeout(
        "/api/paymongo/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planType: selectedPlan,
          }),
          timeout: 12000,
        }
      );

      const data = await res.json();

      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      const msg =
        data.error ||
        "Failed to initiate payment. Please try again.";

      setErrorMsg(msg);
      alert(msg);
    } catch (error: any) {
      console.error("Checkout error:", error);

      const msg =
        error?.message ||
        "An unexpected error occurred. Please try again.";

      setErrorMsg(msg);
      alert(msg);
    }
  };

  const {
    isSubmitting: loading,
    handleSubmit: handleUpgrade,
  } = useDoubleSubmitPreventer(executeUpgrade);

  const handleLogout = async () => {
    try {
      await fetchWithTimeout("/api/auth/logout", {
        method: "POST",
        timeout: 5000,
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-md space-y-6 text-center">
        <div className="space-y-2">
          <span className="text-4xl block">🔒</span>

          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md border border-amber-200 inline-block">
            Payment Required
          </span>

          <h2 className="text-2xl font-extrabold text-slate-900 pt-1">
            Upgrade to PRO
          </h2>

          <p className="text-xs text-slate-500">
            Choose your access period before continuing to
            PayMongo.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium text-left">
            ⚠️ <strong>Error:</strong> {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {plans.map((plan) => (
            <button
              key={plan.planType}
              type="button"
              onClick={() => setSelectedPlan(plan.planType)}
              disabled={loading}
              className={
                selectedPlan === plan.planType
                  ? "p-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-slate-900"
                  : "p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
              }
            >
              <span className="block text-xs font-bold">
                {plan.name}
              </span>

              <span className="block text-lg font-black mt-1">
                ₱{plan.price}
              </span>

              <span className="block text-[10px] text-slate-500">
                {plan.durationDays} days
              </span>
            </button>
          ))}
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3 text-left">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {selected.name}
            </span>

            <span className="text-2xl font-extrabold text-slate-900">
              ₱{selected.price}
            </span>
          </div>

          <ul className="text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-200 font-medium">
            <li className="text-emerald-600 font-bold">
              ✓ Full Timed Practice Mock Exams
            </li>
            <li className="text-emerald-600 font-bold">
              ✓ Category-Specific Speed Drills
            </li>
            <li className="text-emerald-600 font-bold">
              ✓ Full Access to Instructor Study Notes
            </li>
            <li className="text-emerald-600 font-bold">
              ✓ GCash, Maya, Card & QR Ph
            </li>
          </ul>
        </div>

        <LoadingButton
          type="button"
          onClick={handleUpgrade}
          isLoading={loading}
          loadingText="Redirecting to PayMongo..."
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition shadow-sm"
        >
          Pay ₱{selected.price} via PayMongo
        </LoadingButton>

        <a
          href="/redeem"
          className="block w-full text-center text-xs font-semibold text-violet-500 hover:text-violet-400 transition py-1"
        >
          🎟️ Have a school or institutional voucher? Redeem it here
        </a>

        <button
          type="button"
          onClick={handleLogout}
          className="block w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 transition cursor-pointer"
        >
          Log Out & Exit
        </button>
      </div>
    </div>
  );
}
