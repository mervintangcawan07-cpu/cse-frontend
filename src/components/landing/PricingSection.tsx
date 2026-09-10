"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  PROMO_PRICING_DISPLAY,
  getPromoReferencePrice,
} from "@/config/promoPricingDisplay";

const DEFAULT_PRICING_PLANS = [
  {
    planType: "1_MONTH",
    name: "1-Month Intensive Pass",
    price: "₱99",
    duration: "30 Days Access",
    description:
      "Ideal for fast, focused preparation in the final weeks before your exam date.",
    popular: false,
  },
  {
    planType: "6_MONTHS",
    name: "6-Month Full Pass",
    price: "₱199",
    duration: "180 Days Access",
    description:
      "Our most popular pass. Complete coverage with ample time to master all subjects.",
    popular: true,
  },
  {
    planType: "1_YEAR",
    name: "1-Year Mastery Pass",
    price: "₱299",
    duration: "365 Days Access",
    description:
      "Best value for continuous review across multiple CSC PPT and COMEX schedules.",
    popular: false,
  },
];

export default function PricingSection() {
  const [pricingPlans, setPricingPlans] = useState(DEFAULT_PRICING_PLANS);

  useEffect(() => {
    let cancelled = false;

    async function loadPricingPlans() {
      try {
        const res = await fetch("/api/pricing", {
          cache: "no-store",
        });

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as {
          plans?: Array<{
            planType: string;
            price: number;
          }>;
        };

        if (cancelled || !Array.isArray(data.plans)) {
          return;
        }

        const priceByType = new Map(
          data.plans.map(
            (plan) => [plan.planType, plan.price] as const
          )
        );

        setPricingPlans((previous) =>
          previous.map((plan) => {
            const currentPrice = priceByType.get(plan.planType);

            if (
              typeof currentPrice !== "number" ||
              !Number.isFinite(currentPrice)
            ) {
              return plan;
            }

            return {
              ...plan,
              price: `₱${currentPrice}`,
            };
          })
        );
      } catch (error) {
        console.warn("Could not refresh public pricing:", error);
      }
    }

    void loadPricingPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="pricing" className="py-16 px-4 sm:px-6 bg-white border-y border-slate-200/80">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-black text-blue-600 uppercase tracking-wider">
            Transparent Pricing
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
            Choose Your PRO Review Pass
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            One-time payment via GCash, Maya, Card, or QRPH. No hidden fees or recurring subscriptions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pricingPlans.map((plan, idx) => {
            const promoRefPrice = getPromoReferencePrice(plan.planType);

            return (
              <div
                key={idx}
                className={`p-6 sm:p-7 rounded-3xl border flex flex-col justify-between space-y-6 relative transition ${
                  plan.popular
                    ? "bg-gradient-to-b from-blue-50/50 to-indigo-50/50 border-2 border-blue-600 shadow-xl"
                    : "bg-white border-slate-200/90 shadow-sm hover:shadow-md"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 right-6 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-[10px] rounded-full uppercase shadow-xs">
                    Most Popular
                  </span>
                )}

                <div className="space-y-3">
                  <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                    {plan.name}
                  </span>

                  {promoRefPrice && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-400 line-through">
                        ₱{promoRefPrice}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700">
                        {PROMO_PRICING_DISPLAY.badgeText}
                      </span>
                    </div>
                  )}

                  <div className="text-3xl sm:text-4xl font-black text-slate-900">
                    {plan.price}{" "}
                    <span className="text-xs font-semibold text-slate-500">
                      / {plan.duration}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {plan.description}
                  </p>

                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs font-medium text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Full Timed Mock Exam Suite</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Complete Step-by-Step Rationalizations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Mistake Notebook & Elimination Drills</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <span>Classmates & Study Rooms Access</span>
                  </div>
                </div>
              </div>

              <Link
                href="/signup"
                className={`w-full py-3.5 text-center text-xs font-black rounded-xl transition ${
                  plan.popular
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white shadow-md"
                    : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                Get Started Now
              </Link>
            </div>
          );
        })}
        </div>
      </div>
    </section>
  );
}
