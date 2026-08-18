import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cachedJsonResponse, CACHE_PROFILES } from "@/lib/cache";

const DEFAULT_PLANS = [
  { planType: "1_MONTH", name: "1-Month Pass", price: 199, durationDays: 30 },
  { planType: "6_MONTHS", name: "6-Month Pass", price: 299, durationDays: 180 },
  { planType: "LIFETIME", name: "Lifetime Pass", price: 499, durationDays: 0 },
];

export async function GET() {
  try {
    let plans = await prisma.pricingPlan.findMany({
      orderBy: { price: "asc" },
    });

    if (plans.length === 0) {
      for (const p of DEFAULT_PLANS) {
        await prisma.pricingPlan.upsert({
          where: { planType: p.planType },
          update: {},
          create: p,
        });
      }
      plans = await prisma.pricingPlan.findMany({
        orderBy: { price: "asc" },
      });
    }

    return cachedJsonResponse(
      { success: true, plans },
      "STATIC_METADATA"
    );
  } catch (error) {
    console.error("[PRICING_FETCH_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to load pricing" },
      { status: 500, headers: CACHE_PROFILES.PRIVATE }
    );
  }
}