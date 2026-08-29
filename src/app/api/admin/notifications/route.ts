import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

// Helper to verify Admin authorization
async function getAdminSession() {
  const user = await getAuthenticatedUser();
  if (user?.role !== "ADMIN") return null;
  return user;
}

// 1. GET: Fetch all broadcast announcements for the admin history list
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

// 2. POST: Dispatch a new broadcast announcement (Title + Message)
export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { title, message, type = "SYSTEM", targetUserId } = body;

    if (!title || !message) {
      return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
    }

    // Create system broadcast (targetUserId = null broadcasts to all users)
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
        userId: session.id,
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

// 3. DELETE: Remove an announcement by ID
export async function DELETE(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
    }

    const deleted = await prisma.notification.delete({
      where: { id },
    });

    // Log admin deletion activity
    await prisma.activityLog.create({
      data: {
        userId: session.id,
        action: "BROADCAST_NOTIFICATION_DELETED",
        metadata: JSON.stringify({ notificationId: id, title: deleted.title }),
      },
    });

    return NextResponse.json({ success: true, message: "Announcement deleted successfully" });
  } catch (error) {
    console.error("Delete broadcast notification error:", error);
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
  }
}
