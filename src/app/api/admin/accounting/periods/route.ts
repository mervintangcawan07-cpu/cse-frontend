// Relative Path: src/app/api/admin/accounting/periods/route.ts
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { PeriodService, PeriodDomainError } from "@/lib/accounting/periodService";

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

    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return NextResponse.json({ error: "Invalid startDate or endDate format" }, { status: 400 });
    }

    if (endDateTime <= startDateTime) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }

    const period = await prisma.$transaction(async (tx) => {
      // 1. Acquire transaction-scoped configuration advisory lock
      await PeriodService.acquireConfigurationLock(tx);

      // 2. Authoritatively verify no overlapping period exists
      const overlapping = await tx.accountingPeriod.findFirst({
        where: {
          startDate: { lte: endDateTime },
          endDate: { gte: startDateTime },
        },
        select: { id: true, name: true, startDate: true, endDate: true },
      });

      if (overlapping) {
        throw new PeriodDomainError(
          "PERIOD_OVERLAP",
          `Accounting period overlaps an existing period '${overlapping.name}' (${overlapping.startDate.toISOString().slice(0, 10)} to ${overlapping.endDate.toISOString().slice(0, 10)})`,
          409
        );
      }

      // 3. Create period safely
      return await tx.accountingPeriod.create({
        data: {
          name: name.trim(),
          startDate: startDateTime,
          endDate: endDateTime,
          status: "OPEN",
          notes: notes?.trim() || null,
        },
      });
    });

    return NextResponse.json({
      success: true,
      period,
      message: `Accounting Period '${period.name}' created!`,
    });
  } catch (error: any) {
    if (error instanceof PeriodDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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

    if (!["OPEN", "CLOSED", "LOCKED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const period = await prisma.$transaction(async (tx) => {
      // 1. Acquire row lock on AccountingPeriod
      const lockedRows = await tx.$queryRaw<Array<{
        id: string;
        name: string;
        status: "OPEN" | "CLOSED" | "LOCKED";
      }>>(
        Prisma.sql`
          SELECT id, name, status
          FROM "AccountingPeriod"
          WHERE id = ${periodId}
          FOR UPDATE
        `
      );

      if (!lockedRows || lockedRows.length === 0) {
        throw new PeriodDomainError("PERIOD_NOT_FOUND", "Accounting period not found", 404);
      }

      const currentPeriod = lockedRows[0];

      // 2. Terminal LOCKED enforcement: cannot transition out of LOCKED
      if (currentPeriod.status === "LOCKED" && status !== "LOCKED") {
        throw new PeriodDomainError(
          "LOCKED_PERIOD_TERMINAL",
          "Locked accounting periods cannot be reopened.",
          409
        );
      }

      // 3. Update status under row lock
      return await tx.accountingPeriod.update({
        where: { id: periodId },
        data: {
          status,
          notes: notes || undefined,
          closedBy: status === "CLOSED" || status === "LOCKED" ? user.id : null,
          closedAt: status === "CLOSED" || status === "LOCKED" ? new Date() : null,
        },
      });
    });

    return NextResponse.json({
      success: true,
      period,
      message: `Period '${period.name}' updated to ${status}!`,
    });
  } catch (error: any) {
    if (error instanceof PeriodDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[ADMIN_PERIODS_PATCH_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to update period" }, { status: 500 });
  }
}
