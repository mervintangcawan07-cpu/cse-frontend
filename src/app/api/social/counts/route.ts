// Relative Path: src/app/api/social/counts/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

    // Parallel execution across all 6 count queries using Promise.all
    const [
      unreadNotifications,
      pendingClassmates,
      unreadMessages,
      activeRooms,
      upcomingEvents,
      clubsCount,
    ] = await Promise.all([
      // 1. Unread Alerts / Notifications
      prisma.notification.count({
        where: {
          OR: [{ userId }, { userId: null }],
          isRead: false,
        },
      }),

      // 2. Incoming Classmate Requests
      prisma.classmateRelation.count({
        where: {
          receiverId: userId,
          status: "PENDING",
        },
      }),

      // 3. Unread Direct Messages
      prisma.directMessage.count({
        where: {
          conversation: {
            participants: {
              some: { userId },
            },
          },
          senderId: { not: userId },
          state: { not: "READ" },
        },
      }),

      // 4. Active Study Rooms
      prisma.studyRoom.count({
        where: {
          state: "ACTIVE",
          OR: [
            { isPublic: true },
            { participants: { some: { userId } } },
          ],
        },
      }),

      // 5. Upcoming Review Events
      prisma.studyEvent.count({
        where: {
          scheduledAt: { gte: new Date() },
          isPublic: true,
        },
      }),

      // 6. Active Study Clubs
      prisma.studyClub.count({
        where: {
          isPublic: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      counts: {
        unreadNotifications,
        pendingClassmates,
        unreadMessages,
        activeRooms,
        upcomingEvents,
        clubsCount,
      },
    });
  } catch (error: any) {
    console.error("[SOCIAL_COUNTS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch counts", details: error?.message }, { status: 500 });
  }
}