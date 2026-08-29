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

    const { subject, message } = await request.json();

    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }

    const newTicket = await prisma.supportTicket.create({
      data: {
        userId,
        userEmail,
        subject,
        message,
        status: "OPEN",
      },
    });

    return NextResponse.json({ success: true, ticket: newTicket });
  } catch (error) {
    console.error("[STUDENT_SUPPORT_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to submit support ticket" }, { status: 500 });
  }
}
