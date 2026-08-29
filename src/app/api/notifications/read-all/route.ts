// Relative Path: src/app/api/notifications/read-all/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    await prisma.notification.updateMany({
      where: {
        OR: [{ userId }, { userId: null }],
        isRead: false,
      },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true, message: "All notifications marked as read" });
  } catch (error: any) {
    console.error("[NOTIFICATIONS_READ_ALL_ERROR]", error);
    return NextResponse.json({ error: "Failed to mark notifications as read", details: error?.message }, { status: 500 });
  }
}
