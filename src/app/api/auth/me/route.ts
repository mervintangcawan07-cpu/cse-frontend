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
      },
    });

    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const now = new Date();
    let isPaid = user.isPaid;

    // 🔒 REAL-WORLD EXPIRATION GUARD
    // Revokes access if the paidUntil date has passed for non-admin accounts
    if (user.paidUntil && user.paidUntil < now && user.role !== "ADMIN") {
      isPaid = false;
      await prisma.user.update({
        where: { id: user.id },
        data: { isPaid: false },
      });
    }

    return NextResponse.json({
      user: {
        ...user,
        isPaid,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}