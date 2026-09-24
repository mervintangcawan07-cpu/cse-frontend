import { NextResponse } from "next/server";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import {
  SUPPORT_TICKET_LIMITER,
  checkRateLimit,
  createRateLimitResponse,
} from "@/lib/ratelimit";

// GET: Retrieve current user's support tickets
export async function GET() {
  try {
    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated && authentication.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!authentication.authenticated) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = authentication.session.user.id;
    const userEmail = authentication.session.user.email;

    const tickets = await prisma.supportTicket.findMany({
      where: {
        OR: [
          { userId },
          { userEmail },
        ],
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("[STUDENT_SUPPORT_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch support tickets" }, { status: 500 });
  }
}

// POST: Create a new support ticket
export async function POST(request: Request) {
  try {
    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated && authentication.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!authentication.authenticated) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = authentication.session.user.id;
    const userEmail = authentication.session.user.email;
    const rateLimitUserId = userId;

    const rateResult = await checkRateLimit(
      SUPPORT_TICKET_LIMITER,
      `support-ticket:${rateLimitUserId}`
    );
    if (!rateResult.success) {
      return createRateLimitResponse(
        rateResult,
        "Too many support tickets submitted. Please wait before creating another ticket."
      );
    }

    const body = await request.json();
    const { subject, message } = body;

    if (typeof subject !== "string" || !subject.trim()) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    const trimmedSubject = subject.trim();
    if (trimmedSubject.length > 200) {
      return NextResponse.json({ error: "Subject must not exceed 200 characters" }, { status: 400 });
    }

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 5000) {
      return NextResponse.json({ error: "Message must not exceed 5000 characters" }, { status: 400 });
    }

    const newTicket = await prisma.supportTicket.create({
      data: {
        userId,
        userEmail,
        subject: trimmedSubject,
        message: trimmedMessage,
        status: "OPEN",
      },
    });

    return NextResponse.json({ success: true, ticket: newTicket });
  } catch (error) {
    console.error("[STUDENT_SUPPORT_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to submit support ticket" }, { status: 500 });
  }
}
