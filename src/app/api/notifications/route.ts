// Relative Path: src/app/api/notifications/route.ts
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // optional filter
    const category = searchParams.get("category"); // optional group filter

    const whereClause: Prisma.NotificationWhereInput = {
      OR: [
        { userId },
        { userId: null, receipts: { none: { userId, isDismissed: true } } },
      ],
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

    const notificationRows = await prisma.notification.findMany({
      where: whereClause,
      include: {
        receipts: { where: { userId }, select: { isRead: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    const notifications = notificationRows.map(({ receipts, ...notification }) => ({
      ...notification,
      isRead: notification.userId === null
        ? (receipts[0] ? receipts[0].isRead : notification.isRead)
        : notification.isRead,
    }));

    const unreadCount = await prisma.notification.count({
      where: {
        OR: [
          { userId, isRead: false },
          {
            userId: null,
            OR: [
              { receipts: { some: { userId, isRead: false, isDismissed: false } } },
              { isRead: false, receipts: { none: { userId } } },
            ],
          },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("[NOTIFICATIONS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    const body = await request.json();
    const { notificationId, action } = body; // action: 'READ' | 'DELETE'

    if (!notificationId) {
      return NextResponse.json({ error: "Missing notification ID" }, { status: 400 });
    }

    const notif = await prisma.notification.findUnique({
      where: { id: String(notificationId) },
    });

    if (!notif || (notif.userId !== null && notif.userId !== userId)) {
      return NextResponse.json({ error: "Notification not found or forbidden" }, { status: 404 });
    }

    if (notif.userId === null) {
      const notificationIdString = String(notificationId);
      await prisma.notificationReceipt.upsert({
        where: { notificationId_userId: { notificationId: notificationIdString, userId } },
        create: {
          notificationId: notificationIdString,
          userId,
          isRead: action !== "DELETE",
          isDismissed: action === "DELETE",
        },
        update: action === "DELETE" ? { isDismissed: true } : { isRead: true },
      });
      return NextResponse.json({
        success: true,
        message: action === "DELETE" ? "Notification deleted" : "Notification marked as read",
      });
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
  } catch (error) {
    console.error("[NOTIFICATIONS_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const notificationId = searchParams.get("id");

    if (action === "CLEAR_READ") {
      await prisma.$transaction(async (tx) => {
        await tx.notification.deleteMany({ where: { userId, isRead: true } });
        await tx.notificationReceipt.updateMany({
          where: { userId, isRead: true },
          data: { isDismissed: true },
        });
        const legacyRead = await tx.notification.findMany({
          where: {
            userId: null,
            isRead: true,
            receipts: { none: { userId } },
          },
          select: { id: true },
        });
        if (legacyRead.length > 0) {
          await tx.notificationReceipt.createMany({
            data: legacyRead.map(({ id }) => ({
              notificationId: id,
              userId,
              isRead: true,
              isDismissed: true,
            })),
            skipDuplicates: true,
          });
        }
      });
      return NextResponse.json({ success: true, message: "Read notifications cleared" });
    }

    if (notificationId) {
      const notif = await prisma.notification.findUnique({
        where: { id: String(notificationId) },
      });

      if (!notif || (notif.userId !== null && notif.userId !== userId)) {
        return NextResponse.json({ error: "Notification not found or forbidden" }, { status: 404 });
      }

      if (notif.userId === null) {
        const notificationIdString = String(notificationId);
        await prisma.notificationReceipt.upsert({
          where: { notificationId_userId: { notificationId: notificationIdString, userId } },
          create: { notificationId: notificationIdString, userId, isDismissed: true },
          update: { isDismissed: true },
        });
        return NextResponse.json({ success: true, message: "Notification deleted" });
      }

      await prisma.notification.delete({
        where: { id: String(notificationId) },
      });
      return NextResponse.json({ success: true, message: "Notification deleted" });
    }

    return NextResponse.json({ error: "Invalid delete parameters" }, { status: 400 });
  } catch (error) {
    console.error("[NOTIFICATIONS_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to delete notifications" }, { status: 500 });
  }
}
