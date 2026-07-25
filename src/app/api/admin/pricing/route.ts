import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: String(session.userId) },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const { plans } = body;

    if (!Array.isArray(plans)) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }

    for (const p of plans) {
      await prisma.pricingPlan.update({
        where: { planType: p.planType },
        data: { price: Math.max(1, Number(p.price)) },
      });
    }

    return NextResponse.json({ success: true, message: "Prices updated successfully!" });
  } catch (error) {
    console.error("Update pricing error:", error);
    return NextResponse.json({ error: "Failed to update prices" }, { status: 500 });
  }
}