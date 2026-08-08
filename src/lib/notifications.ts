// Relative Path: src/lib/notifications.ts
import { prisma } from "@/lib/prisma";

export async function createNotification({
  userId,
  title,
  message,
  type = "INFO",
}: {
  userId: string;
  title: string;
  message: string;
  type?: "INFO" | "CLASSMATE_REQUEST" | "DIRECT_MESSAGE" | "STUDY_ROOM" | "EVENT_REMINDER";
}) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
      },
    });
  } catch (error) {
    console.error("[CREATE_NOTIFICATION_ERROR]", error);
  }
}