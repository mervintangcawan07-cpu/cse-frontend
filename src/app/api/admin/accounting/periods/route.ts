// Relative Path: src/app/api/admin/accounting/periods/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const periods = await prisma.accountingPeriod.findMany({
      orderBy: { startDate: "desc" },
      include: {
        _count: { select: { ledgerEntries: true, deductions: true } },
      },
    });

    return NextResponse.json({ success: true, periods });
  } catch (error) {
    console.error("[ADMIN_PERIODS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch accounting periods" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, startDate, endDate, notes } = body;

    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: "Name, start date, and end date are required" }, { status: 400 });
    }

    const period = await prisma.accountingPeriod.create({
      data: {
        name: name.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: "OPEN",
        notes: notes?.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      period,
      message: `Accounting Period '${period.name}' created!`,
    });
  } catch (error: any) {
    console.error("[ADMIN_PERIODS_POST_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to create period" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { periodId, status, notes } = body;

    if (!periodId || !status) {
      return NextResponse.json({ error: "periodId and status are required" }, { status: 400 });
    }

    const period = await prisma.accountingPeriod.update({
      where: { id: periodId },
      data: {
        status,
        notes: notes || undefined,
        closedBy: status === "CLOSED" || status === "LOCKED" ? user.id : null,
        closedAt: status === "CLOSED" || status === "LOCKED" ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      period,
      message: `Period '${period.name}' updated to ${status}!`,
    });
  } catch (error: any) {
    console.error("[ADMIN_PERIODS_PATCH_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to update period" }, { status: 500 });
  }
}
