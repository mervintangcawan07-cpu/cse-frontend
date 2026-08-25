import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_PLANS = [
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

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

export async function GET() {
  try {
    const supportedPlanTypes = DEFAULT_PLANS.map(
      (plan) => plan.planType
    );

    const databasePlans = await prisma.pricingPlan.findMany({
      where: {
        planType: {
          in: supportedPlanTypes,
        },
      },
      orderBy: { durationDays: "asc" },
    });

    const databasePlanByType = new Map(
      databasePlans.map((plan) => [plan.planType, plan])
    );

    const plans = DEFAULT_PLANS.map(
      (defaultPlan) =>
        databasePlanByType.get(defaultPlan.planType) ??
        defaultPlan
    );

    return NextResponse.json(
      { success: true, plans },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[PRICING_FETCH_ERROR]", error);

    return NextResponse.json(
      { error: "Failed to load pricing" },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
