// Relative Path: src/app/api/social/events/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "upcoming";

    let whereClause: any = { isPublic: true };
    if (filter === "mine") {
      whereClause = {
        OR: [
          { hostId: userId },
          { rsvps: { some: { userId, status: "ATTENDING" } } },
        ],
      };
    } else {
      whereClause.scheduledAt = { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    }

    const events = await prisma.studyEvent.findMany({
      where: whereClause,
      include: {
        host: { select: { id: true, name: true, isPaid: true } },
        rsvps: { select: { id: true, userId: true, status: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    const formattedEvents = events.map((event) => {
      const myRsvp = event.rsvps.find((r) => r.userId === userId)?.status || null;
      const attendingCount = event.rsvps.filter((r) => r.status === "ATTENDING").length;

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        topic: event.topic,
        scheduledAt: event.scheduledAt,
        durationMin: event.durationMin,
        isPublic: event.isPublic,
        host: event.host,
        isHost: event.hostId === userId,
        attendingCount,
        myRsvp,
      };
    });

    return NextResponse.json({ success: true, events: formattedEvents });
  } catch (error: any) {
    console.error("[EVENTS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch study events", details: error?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = authenticatedUser.id;

    const body = await request.json();
    const { title, description, topic, scheduledAt, durationMin, isPublic } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Event title is required" }, { status: 400 });
    }

    if (!scheduledAt) {
      return NextResponse.json({ error: "Scheduled date & time is required" }, { status: 400 });
    }

    const event = await prisma.studyEvent.create({
      data: {
        title: title.trim(),
        description: description ? String(description).trim() : null,
        topic: topic ? String(topic).trim() : "General Review",
        scheduledAt: new Date(scheduledAt),
        durationMin: Number(durationMin) || 60,
        isPublic: isPublic !== false,
        hostId: userId,
        rsvps: {
          create: {
            userId,
            status: "ATTENDING",
          },
        },
      },
      include: {
        host: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, event, message: "Study event scheduled!" });
  } catch (error: any) {
    console.error("[EVENTS_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to create event", details: error?.message }, { status: 500 });
  }
}
