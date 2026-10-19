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
      where: { origin: "ADMIN" },
      take: 50,
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const input = body as Record<string, unknown>;

    if (typeof input.title !== "string" || typeof input.message !== "string") {
      return NextResponse.json({ error: "Title and message must be strings" }, { status: 400 });
    }

    const title = input.title.trim();
    const message = input.message.trim();
    const rawType = input.type === undefined ? "SYSTEM" : input.type;

    if (typeof rawType !== "string") {
      return NextResponse.json({ error: "Invalid notification type" }, { status: 400 });
    }

    const type = rawType.trim();

    if (!title || title.length > 160 ||
        !message || message.length > 10000 ||
        !type || type.length > 64) {
      return NextResponse.json({ error: "Invalid notification field length" }, { status: 400 });
    }

    let targetUserId: string | null = null;

    if (input.targetUserId !== undefined && input.targetUserId !== null) {
      if (typeof input.targetUserId !== "string" ||
          !input.targetUserId.trim() ||
          input.targetUserId.trim().length > 128) {
        return NextResponse.json({ error: "Invalid target user ID" }, { status: 400 });
      }

      targetUserId = input.targetUserId.trim();

      const target = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, deletedAt: true, anonymizedAt: true },
      });

      if (!target || target.deletedAt !== null || target.anonymizedAt !== null) {
        return NextResponse.json({ error: "Target user unavailable" }, { status: 400 });
      }
    }

    const notification = await prisma.$transaction(async (tx) => {
      const created = await tx.notification.create({
        data: {
          userId: targetUserId,
          origin: "ADMIN",
          title,
          message,
          type,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.id,
          action: "BROADCAST_NOTIFICATION_SENT",
          metadata: JSON.stringify({ title, type, targetUserId }),
        },
      });

      return created;
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

    // Both ownership and deletion are enforced within the same transaction.
    // Unverified, support, and social notifications remain untouched.
    const deleted = await prisma.$transaction(async (tx) => {
      const matching = await tx.notification.findFirst({
        where: { id, origin: "ADMIN" },
        select: { id: true, title: true },
      });
      if (!matching) return null;

      const result = await tx.notification.deleteMany({
        where: { id, origin: "ADMIN" },
      });
      if (result.count !== 1) throw new Error("Admin notification deletion count mismatch");

      await tx.activityLog.create({
        data: {
          userId: session.id,
          action: "BROADCAST_NOTIFICATION_DELETED",
          metadata: JSON.stringify({ notificationId: id, title: matching.title }),
        },
      });
      return matching;
    });
    if (!deleted) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Announcement deleted successfully" });
  } catch (error) {
    console.error("Delete broadcast notification error:", error);
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
  }
}
