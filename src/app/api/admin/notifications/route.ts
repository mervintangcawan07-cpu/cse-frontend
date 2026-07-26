import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { title, message, type = "SYSTEM", targetUserId } = body;

    if (!title || !message) {
      return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
    }

    // Create system broadcast (targetUserId = null broadcasts to all examinees)
    const notification = await prisma.notification.create({
      data: {
        userId: targetUserId || null,
        title: String(title).trim(),
        message: String(message).trim(),
        type: String(type).trim(),
      },
    });

    // Log admin activity
    await prisma.activityLog.create({
      data: {
        userId: String(session.userId),
        action: "BROADCAST_NOTIFICATION_SENT",
        metadata: JSON.stringify({ title, type, targetUserId }),
      },
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error("Create broadcast notification error:", error);
    return NextResponse.json({ error: "Failed to dispatch notification" }, { status: 500 });
  }
}