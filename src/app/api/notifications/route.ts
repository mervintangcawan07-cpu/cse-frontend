// Relative Path: src/app/api/notifications/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // optional filter
    const category = searchParams.get("category"); // optional group filter

    const whereClause: any = {
      OR: [{ userId }, { userId: null }],
    };

    if (type && type !== "ALL") {
      whereClause.type = type;
    } else if (category) {
      if (category === "CLASSMATES") {
        whereClause.type = { in: ["CLASSMATE_REQUEST", "CLASSMATE_ACCEPTED"] };
      } else if (category === "MESSAGES") {
        whereClause.type = "DIRECT_MESSAGE";
      } else if (category === "ROOMS_CLUBS") {
        whereClause.type = {
          in: [
            "STUDY_ROOM",
            "STUDY_ROOM_INVITE",
            "STUDY_ROOM_MODERATOR",
            "STUDY_CLUB",
            "STUDY_CLUB_INVITE",
            "STUDY_CLUB_MODERATOR",
            "STUDY_CLUB_TRANSFER",
          ],
        };
      } else if (category === "EVENTS") {
        whereClause.type = { in: ["EVENT_RSVP", "EVENT_REMINDER"] };
      }
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        OR: [{ userId }, { userId: null }],
        isRead: false,
      },
    });

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    console.error("[NOTIFICATIONS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch notifications", details: error?.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    const body = await request.json();
    const { notificationId, action } = body; // action: 'READ' | 'DELETE'

    if (!notificationId) {
      return NextResponse.json({ error: "Missing notification ID" }, { status: 400 });
    }

    const notif = await prisma.notification.findUnique({
      where: { id: String(notificationId) },
    });

    if (!notif || (notif.userId && notif.userId !== userId)) {
      return NextResponse.json({ error: "Notification not found or forbidden" }, { status: 404 });
    }

    if (action === "DELETE") {
      await prisma.notification.delete({
        where: { id: String(notificationId) },
      });
      return NextResponse.json({ success: true, message: "Notification deleted" });
    }

    // Default action: Mark as READ
    await prisma.notification.update({
      where: { id: String(notificationId) },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true, message: "Notification marked as read" });
  } catch (error: any) {
    console.error("[NOTIFICATIONS_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Failed to update notification", details: error?.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const notificationId = searchParams.get("id");

    if (action === "CLEAR_READ") {
      await prisma.notification.deleteMany({
        where: {
          userId,
          isRead: true,
        },
      });
      return NextResponse.json({ success: true, message: "Read notifications cleared" });
    }

    if (notificationId) {
      const notif = await prisma.notification.findUnique({
        where: { id: String(notificationId) },
      });

      if (!notif || (notif.userId && notif.userId !== userId)) {
        return NextResponse.json({ error: "Notification not found or forbidden" }, { status: 404 });
      }

      await prisma.notification.delete({
        where: { id: String(notificationId) },
      });
      return NextResponse.json({ success: true, message: "Notification deleted" });
    }

    return NextResponse.json({ error: "Invalid delete parameters" }, { status: 400 });
  } catch (error: any) {
    console.error("[NOTIFICATIONS_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to delete notifications", details: error?.message }, { status: 500 });
  }
}