// Relative Path: src/app/api/notifications/read-all/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    await prisma.$transaction(async (tx) => {
      await tx.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      const broadcasts = await tx.notification.findMany({
        where: { userId: null },
        select: { id: true },
      });
      if (broadcasts.length > 0) {
        await tx.notificationReceipt.createMany({
          data: broadcasts.map(({ id }) => ({ notificationId: id, userId, isRead: true })),
          skipDuplicates: true,
        });
        await tx.notificationReceipt.updateMany({
          where: { userId, notification: { userId: null } },
          data: { isRead: true },
        });
      }
    });

    return NextResponse.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("[NOTIFICATIONS_READ_ALL_ERROR]", error);
    return NextResponse.json({ error: "Failed to mark notifications as read" }, { status: 500 });
  }
}
