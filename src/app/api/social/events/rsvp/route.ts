// Relative Path: src/app/api/social/events/rsvp/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

    const body = await request.json();
    const { eventId, status } = body; // status: 'ATTENDING' | 'MAYBE' | 'DECLINED'

    if (!eventId || !status || !["ATTENDING", "MAYBE", "DECLINED"].includes(status)) {
      return NextResponse.json({ error: "Invalid event ID or RSVP status" }, { status: 400 });
    }

    const event = await prisma.studyEvent.findUnique({
      where: { id: String(eventId) },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const existingRsvp = await prisma.studyEventRSVP.findUnique({
      where: { eventId_userId: { eventId: String(eventId), userId } },
    });

    if (existingRsvp) {
      await prisma.studyEventRSVP.update({
        where: { id: existingRsvp.id },
        data: { status },
      });
    } else {
      await prisma.studyEventRSVP.create({
        data: {
          eventId: String(eventId),
          userId,
          status,
        },
      });
    }

    // 🔔 Dispatch event reminder alert if attending
    if (status === "ATTENDING") {
      await createNotification({
        userId,
        type: "EVENT_RSVP",
        title: "Event RSVP Confirmed 📅",
        message: `You're confirmed for "${event.title}" on ${new Date(event.scheduledAt).toLocaleDateString([], { month: "short", day: "numeric" })} at ${new Date(event.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
      });
    }

    return NextResponse.json({ success: true, message: `RSVP status set to ${status}` });
  } catch (error: any) {
    console.error("[EVENT_RSVP_ERROR]", error);
    return NextResponse.json({ error: "Failed to update RSVP status", details: error?.message }, { status: 500 });
  }
}
