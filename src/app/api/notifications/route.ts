import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ notifications: [] }, { status: 200 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId) {
      return NextResponse.json({ notifications: [] }, { status: 200 });
    }

    const userId = String(session.userId);

    // Fetch notifications directed specifically to user or broadcast system alerts
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [{ userId }, { userId: null }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return NextResponse.json({ notifications: [] }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { notificationId } = body;

    if (notificationId) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
    } else {
      // Mark all as read
      await prisma.notification.updateMany({
        where: { OR: [{ userId: String(session.userId) }, { userId: null }] },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark notifications read error:", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}