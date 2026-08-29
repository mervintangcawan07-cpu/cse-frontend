import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const { plans } = body;

    const supportedPlanTypes = ["1_MONTH", "6_MONTHS", "1_YEAR"];

    if (
      !Array.isArray(plans) ||
      plans.length !== supportedPlanTypes.length
    ) {
      return NextResponse.json(
        { error: "Exactly 3 supported pricing plans are required." },
        { status: 400 }
      );
    }

    const seenPlanTypes = new Set<string>();
    const normalizedPlans: Array<{
      planType: string;
      price: number;
    }> = [];

    for (const item of plans as unknown[]) {
      if (typeof item !== "object" || item === null) {
        return NextResponse.json(
          { error: "Invalid pricing plan." },
          { status: 400 }
        );
      }

      const plan = item as {
        planType?: unknown;
        price?: unknown;
      };

      if (
        typeof plan.planType !== "string" ||
        !supportedPlanTypes.includes(plan.planType) ||
        seenPlanTypes.has(plan.planType)
      ) {
        return NextResponse.json(
          { error: "Unsupported or duplicate pricing plan." },
          { status: 400 }
        );
      }

      const price = Number(plan.price);

      if (!Number.isFinite(price) || price < 1) {
        return NextResponse.json(
          { error: "Invalid plan price." },
          { status: 400 }
        );
      }

      seenPlanTypes.add(plan.planType);

      normalizedPlans.push({
        planType: plan.planType,
        price,
      });
    }

    if (seenPlanTypes.size !== supportedPlanTypes.length) {
      return NextResponse.json(
        { error: "All 3 supported pricing plans are required." },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      normalizedPlans.map((plan) =>
        prisma.pricingPlan.update({
          where: { planType: plan.planType },
          data: { price: plan.price },
        })
      )
    );

    return NextResponse.json({ success: true, message: "Prices updated successfully!" });
  } catch (error) {
    console.error("Update pricing error:", error);
    return NextResponse.json({ error: "Failed to update prices" }, { status: 500 });
  }
}
