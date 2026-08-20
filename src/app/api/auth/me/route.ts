// Relative Path: src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { id: String(session.userId) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isPaid: true,
        paidUntil: true,
        planType: true,
        activeSessionId: true,
        lastActiveAt: true,
      },
    });

    if (!user) {
      cookieStore.delete("cse_session");
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // 🔒 SINGLE ACTIVE SESSION GUARD (Concurrent Device Invalidation)
    const sessionActiveId = String(session.activeSessionId || session.sessionId || "");
    if (
      sessionActiveId &&
      user.activeSessionId &&
      user.activeSessionId !== sessionActiveId
    ) {
      cookieStore.delete("cse_session");
      return NextResponse.json({
        user: null,
        kicked: true,
        reason: "CONCURRENT_LOGIN",
        message: "Your account was logged in from another device.",
      }, { status: 200 });
    }

    const now = new Date();
    const INACTIVITY_LIMIT_MINUTES = 30;

    // 🔒 30-MINUTE INACTIVITY AUTO-LOGOUT GUARD
    if (user.lastActiveAt) {
      const minutesInactive =
        (now.getTime() - new Date(user.lastActiveAt).getTime()) / (1000 * 60);

      if (minutesInactive >= INACTIVITY_LIMIT_MINUTES) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            activeSessionId: null,
            lastActiveAt: null,
          },
        });
        cookieStore.delete("cse_session");
        return NextResponse.json({ user: null }, { status: 200 });
      }
    }

    let isPaid = user.isPaid;
    const updateData: { lastActiveAt: Date; isPaid?: boolean } = {
      lastActiveAt: now,
    };

    // 🔒 REAL-WORLD SUBSCRIPTION EXPIRATION GUARD
    if (user.paidUntil && user.paidUntil < now && user.role !== "ADMIN") {
      isPaid = false;
      updateData.isPaid = false;
    }

    // Update lastActiveAt timestamp & subscription state
    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isPaid,
        paidUntil: user.paidUntil,
        planType: user.planType,
        lastActiveAt: now,
      },
    });
  } catch (error) {
    console.error("[AUTH_ME_ERROR]", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}