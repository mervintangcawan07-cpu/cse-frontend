/**
 * Centralized Presentation-Only Configuration for Soft-Launch Promotional Pricing.
 *
 * IMPORTANT SAFETY RULES:
 * 1. This configuration is for UI/DISPLAY PRESENTATION ONLY.
 * 2. It must NEVER participate in checkout, PayMongo, APIs, database,
 *    accounting, ledger, or entitlement calculations.
 * 3. Changing `enabled: false` instantly reverts all user-facing pricing
 *    surfaces back to their standard real-price display with zero residual spacing.
 */

export const PROMO_PRICING_DISPLAY = {
  enabled: true,
  badgeText: "PROMO PRICE",
  referencePrices: {
    "1_MONTH": 199,
    "6_MONTHS": 299,
    "1_YEAR": 399,
  } as const satisfies Record<string, number>,
} as const;

/**
 * Returns the promotional reference (strikethrough) price for a given plan type.
 * Fails safely by returning `null` if:
 * - Promo display is globally disabled (`enabled === false`)
 * - The plan identifier is unknown or undefined
 * - No promotional reference price is registered for the plan
 *
 * When `null` is returned, consumers must render their factual real price normally.
 */
export function getPromoReferencePrice(planType?: string | null): number | null {
  if (!PROMO_PRICING_DISPLAY.enabled || !planType) {
    return null;
  }

  const price = (PROMO_PRICING_DISPLAY.referencePrices as Record<string, number>)[planType];
  return typeof price === "number" && Number.isFinite(price) ? price : null;
}
