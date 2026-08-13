// Relative Path: src/lib/notifications.ts
import { prisma } from "@/lib/prisma";

export type SocialNotificationType =
  | "INFO"
  | "SYSTEM"
  | "CLASSMATE_REQUEST"
  | "CLASSMATE_ACCEPTED"
  | "DIRECT_MESSAGE"
  | "STUDY_ROOM"
  | "STUDY_ROOM_INVITE"
  | "STUDY_ROOM_MODERATOR"
  | "STUDY_CLUB"
  | "STUDY_CLUB_INVITE"
  | "STUDY_CLUB_MODERATOR"
  | "STUDY_CLUB_TRANSFER"
  | "EVENT_RSVP"
  | "EVENT_REMINDER"
  | "PROFILE_COMPLETED";

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: SocialNotificationType | string;
}

export async function createNotification({
  userId,
  title,
  message,
  type = "INFO",
}: CreateNotificationParams) {
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