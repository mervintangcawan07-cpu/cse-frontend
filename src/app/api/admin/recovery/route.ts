// Relative Path: src/app/api/admin/recovery/route.ts

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSudo } from "@/middleware/requireSudo";
import { calculateDaysRemaining } from "@/lib/db/softDelete";
import { purgeExpiredRecords } from "@/jobs/purgeExpiredRecords";
import { logger } from "@/lib/logger/logger";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const softDeletedUsers = await prisma.user.findMany({
      where: {
        isBanned: true,
        banReason: { startsWith: "[SOFT_DELETED]" },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true,
        banReason: true,
      },
    });

    const items = softDeletedUsers.map((u) => {
      const deletedAt = u.updatedAt;
      const restorableUntil = new Date(deletedAt.getTime());
      restorableUntil.setDate(restorableUntil.getDate() + 30);
      const daysRemaining = calculateDaysRemaining(restorableUntil);

      return {
        id: u.id,
        entityType: "user",
        displayName: u.email || u.name || u.id,
        deletedAt: deletedAt.toISOString(),
        restorableUntil: restorableUntil.toISOString(),
        daysRemaining,
        canRestore: daysRemaining > 0,
        metadata: {
          email: u.email,
          role: u.role,
          rawReason: u.banReason,
        },
      };
    });

    return NextResponse.json({
      success: true,
      count: items.length,
      records: items,
    });
  } catch (error: any) {
    logger.error("Failed to fetch soft-deleted records archive", {
      context: { reason: error?.message },
    });
    return NextResponse.json({ error: "Failed to list soft-deleted items" }, { status: 500 });
  }
}

export const POST = requireSudo(async (req: NextRequest) => {
  try {
    const { id, entityType } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Record ID is required" }, { status: 400 });
    }

    if (entityType === "user" || !entityType) {
      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }

      const restoredUser = await prisma.user.update({
        where: { id },
        data: {
          isBanned: false,
          banReason: null,
        },
      });

      logger.info(`ADMIN RESTORATION EXECUTED: Restored soft-deleted user ID: ${id}`, {
        context: { id, email: restoredUser.email },
      });

      return NextResponse.json({
        success: true,
        message: `Record ${id} restored successfully.`,
        record: {
          id: restoredUser.id,
          email: restoredUser.email,
          isBanned: restoredUser.isBanned,
        },
      });
    }

    return NextResponse.json({ error: "Unsupported entity type" }, { status: 400 });
  } catch (error: any) {
    logger.error("Failed to execute admin record restoration", {
      context: { reason: error?.message },
    });
    return NextResponse.json({ error: "Restoration failed" }, { status: 500 });
  }
});

export const DELETE = requireSudo(async (req: NextRequest) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const batchSize = parseInt(searchParams.get("batchSize") || "50", 10);

    const purgeResult = await purgeExpiredRecords(batchSize);

    return NextResponse.json(
      {
        success: false,
        userHardPurgeDisabled: purgeResult.disabled === true,
        code: purgeResult.code,
        message: purgeResult.message,
        result: purgeResult,
      },
      { status: 501 }
    );
  } catch (error: any) {
    logger.error("Manual background purge execution failed", {
      context: { reason: error?.message },
    });
    return NextResponse.json({ error: "Purge execution failed" }, { status: 500 });
  }
});
