import { PROMO_PRICING_DISPLAY, getPromoReferencePrice } from "@/config/promoPricingDisplay";
import type { Plan } from "./dashboardTypes";

interface DashboardUpgradeCardProps {
  readonly plans: readonly Plan[];
  readonly selectedPlan: string;
  readonly checkoutLoading: boolean;
  readonly onPlanChange: (planType: string) => void;
  readonly onCheckout: (planType: string) => Promise<void> | void;
}

export default function DashboardUpgradeCard({
  plans,
  selectedPlan,
  checkoutLoading,
  onPlanChange,
  onCheckout,
}: DashboardUpgradeCardProps) {
  const activePlanPrice = plans.find((plan) => plan.planType === selectedPlan)?.price || 199;

  return (
    <section>
      <div className="relative space-y-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-4 text-white shadow-lg sm:space-y-5 sm:rounded-3xl sm:p-6 md:p-7">
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-60 w-60 rounded-full bg-blue-500/10 blur-2xl" />

        <div className="relative z-10">
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-blue-300 sm:text-[10px]">
            Unlock Full Review Access
          </span>
          <h2 className="mt-2 text-lg font-black text-white sm:text-xl">Upgrade Your Review Pass</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Gain full access to the 170-item mock exam player, specialized strategy drills, and official handbooks.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-2 sm:gap-3">
          {plans.map((plan) => {
            const promoRefPrice = getPromoReferencePrice(plan.planType);
            const selected = selectedPlan === plan.planType;

            return (
              <button
                key={plan.planType}
                type="button"
                onClick={() => onPlanChange(plan.planType)}
                className={`relative flex min-h-[104px] flex-col justify-between rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:min-h-[124px] sm:p-4 ${
                  selected
                    ? "border-blue-400 bg-blue-500/10 text-white shadow-md shadow-blue-500/10"
                    : "border-slate-700/80 bg-slate-800/60 text-slate-300 hover:border-slate-500"
                }`}
              >
                {plan.planType === "6_MONTHS" && (
                  <span className="absolute -top-2 right-2 rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-950 sm:right-3 sm:px-2 sm:text-[9px]">
                    Popular
                  </span>
                )}

                <div>
                  <span className="block text-[9px] font-bold uppercase text-slate-400 sm:text-[10px]">{plan.name}</span>
                  {promoRefPrice && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] font-semibold text-slate-400 line-through sm:text-xs">â‚±{promoRefPrice}</span>
                      <span className="rounded-full border border-rose-500/30 bg-rose-500/20 px-1 py-0.5 text-[7px] font-black uppercase text-rose-300 sm:text-[8px]">
                        {PROMO_PRICING_DISPLAY.badgeText}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="block text-lg font-black text-white sm:text-2xl">â‚±{plan.price}</span>
                  <span className="mt-0.5 block text-[9px] text-slate-400 sm:text-[10px]">{plan.durationDays} days</span>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => void onCheckout(selectedPlan)}
          disabled={checkoutLoading}
          className="relative z-10 w-full rounded-2xl bg-blue-600 px-4 py-3.5 text-xs font-black text-white shadow-lg transition hover:bg-blue-500 disabled:opacity-50 sm:text-sm"
        >
          {checkoutLoading ? "Launching PayMongo Portal..." : `Unlock PRO via PayMongo (â‚±${activePlanPrice}) ðŸ’³`}
        </button>
      </div>
    </section>
  );
}

