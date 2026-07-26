import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("cse_session")?.value;
  if (!token) return null;

  const session = await verifyJWT(token);
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: String(session.userId) },
    select: { id: true, role: true },
  });

  if (user?.role !== "ADMIN") return null;
  return session;
}

// 1. GET USERS WITH SEARCH & SUBSCRIPTION STATS
export async function GET(request: Request) {
  try {
    const adminSession = await verifyAdmin();
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

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
    const adminSession = await verifyAdmin();
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, isPaid, role, action } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let updateData: { isPaid?: boolean; role?: string; planType?: string | null; paidUntil?: Date | null } = {};

    if (role !== undefined) updateData.role = role;

    // Handle specific duration actions for offline payments or manual overrides
    if (action) {
      const now = new Date();
      const baseDate =
        targetUser.paidUntil && targetUser.paidUntil > now
          ? new Date(targetUser.paidUntil)
          : new Date(now);

      if (action === "REVOKE") {
        updateData = {
          ...updateData,
          isPaid: false,
          planType: null,
          paidUntil: new Date(0),
        };
      } else if (action === "EXTEND_30") {
        baseDate.setDate(baseDate.getDate() + 30);
        updateData = {
          ...updateData,
          isPaid: true,
          planType: "1_MONTH",
          paidUntil: baseDate,
        };
      } else if (action === "EXTEND_180") {
        baseDate.setDate(baseDate.getDate() + 180);
        updateData = {
          ...updateData,
          isPaid: true,
          planType: "6_MONTHS",
          paidUntil: baseDate,
        };
      } else if (action === "EXTEND_365") {
        baseDate.setDate(baseDate.getDate() + 365);
        updateData = {
          ...updateData,
          isPaid: true,
          planType: "1_YEAR",
          paidUntil: baseDate,
        };
      }
    } else if (isPaid !== undefined) {
      updateData.isPaid = Boolean(isPaid);
    }

    const updatedUser = await prisma.user.update({
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
    await prisma.activityLog.create({
      data: {
        userId: String(adminSession.userId),
        action: "ADMIN_USER_UPDATED",
        metadata: JSON.stringify({ targetUserId: userId, action, isPaid, role }),
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("[ADMIN_USERS_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}