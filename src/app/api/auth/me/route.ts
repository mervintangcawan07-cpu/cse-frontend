// Relative Path: src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated) {
      cookieStore.delete("cse_session");

      if (authentication.code === "SESSION_MISMATCH") {
        return NextResponse.json({
          user: null,
          kicked: true,
          reason: "CONCURRENT_LOGIN",
          message: "Your account was logged in from another device.",
        }, { status: 200 });
      }

      return NextResponse.json({ user: null }, { status: 200 });
    }

    const { user, sessionId } = authentication.session;

    const now = new Date();
    const INACTIVITY_LIMIT_MINUTES = 30;

    // 🔒 30-MINUTE INACTIVITY AUTO-LOGOUT GUARD
    if (user.lastActiveAt) {
      const minutesInactive =
        (now.getTime() - new Date(user.lastActiveAt).getTime()) / (1000 * 60);

      if (minutesInactive >= INACTIVITY_LIMIT_MINUTES) {
        await prisma.user.updateMany({
          where: {
            id: user.id,
            activeSessionId: sessionId,
          },
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

    // 🔒 REAL-WORLD SUBSCRIPTION EXPIRATION GUARD (Safe conditional CAS)
    if (user.paidUntil && user.paidUntil < now && user.role !== "ADMIN") {
      isPaid = false;
      await prisma.user.updateMany({
        where: {
          id: user.id,
          paidUntil: { lt: now },
        },
        data: { isPaid: false },
      });
    }

    // Update only while this exact session remains live. This closes the race
    // where another login rotates activeSessionId during the request.
    const activityUpdate = await prisma.user.updateMany({
      where: {
        id: user.id,
        isBanned: false,
        deletedAt: null,
        activeSessionId: sessionId,
      },
      data: { lastActiveAt: now },
    });

    if (activityUpdate.count !== 1) {
      cookieStore.delete("cse_session");
      return NextResponse.json({ user: null }, { status: 200 });
    }

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
