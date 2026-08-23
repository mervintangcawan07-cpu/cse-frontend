import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/serverAuth";

// 1. GET USERS WITH SEARCH & SUBSCRIPTION STATS
export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    const users = await prisma.user.findMany({
      where: query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isPaid: true,
        planType: true,
        paidUntil: true,
        createdAt: true,
        _count: {
          select: { results: true },
        },
      },
      take: 100,
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("[ADMIN_USERS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// 2. UPDATE USER PRO ACCESS, DURATION, OR ROLE
export async function PATCH(req: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { userId, isPaid, role, action } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      // 🔒 Acquire Level 4 User-Entitlement advisory lock
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`user-entitlement:${userId}`}, 0)
        )::text AS lock_result
      `;

      const targetUser = await tx.user.findUnique({ where: { id: userId } });
      if (!targetUser) {
        return { notFound: true, user: null };
      }

      // Typed as Prisma.UserUpdateInput to resolve strict Enum type checking
      const updateData: Prisma.UserUpdateInput = {};

      if (role !== undefined) updateData.role = role as any;

      // Handle specific duration actions for offline payments or manual overrides
      if (action) {
        const now = new Date();
        const baseDate =
          targetUser.paidUntil && targetUser.paidUntil > now
            ? new Date(targetUser.paidUntil)
            : new Date(now);

        if (action === "REVOKE") {
          updateData.isPaid = false;
          updateData.planType = null;
          updateData.paidUntil = new Date(0);
        } else if (action === "EXTEND_30") {
          baseDate.setDate(baseDate.getDate() + 30);
          updateData.isPaid = true;
          updateData.planType = "1_MONTH";
          updateData.paidUntil = baseDate;
        } else if (action === "EXTEND_180") {
          baseDate.setDate(baseDate.getDate() + 180);
          updateData.isPaid = true;
          updateData.planType = "6_MONTHS";
          updateData.paidUntil = baseDate;
        } else if (action === "EXTEND_365") {
          baseDate.setDate(baseDate.getDate() + 365);
          updateData.isPaid = true;
          updateData.planType = "1_YEAR";
          updateData.paidUntil = baseDate;
        }
      } else if (isPaid !== undefined) {
        updateData.isPaid = Boolean(isPaid);
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          isPaid: true,
          role: true,
          planType: true,
          paidUntil: true,
        },
      });

      // Activity Log
      if (user) {
        await tx.activityLog.create({
          data: {
            userId: user.id,
            action: "ADMIN_USER_UPDATED",
            metadata: JSON.stringify({ targetUserId: userId, action, isPaid, role }),
          },
        }).catch(() => null);
      }

      return { notFound: false, user: updatedUser };
    });

    if (transactionResult.notFound) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: transactionResult.user });
  } catch (error) {
    console.error("[ADMIN_USERS_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}