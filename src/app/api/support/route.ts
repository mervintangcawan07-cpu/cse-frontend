import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SUPPORT_TICKET_LIMITER,
  checkRateLimit,
  createRateLimitResponse,
} from "@/lib/ratelimit";

// GET: Retrieve current user's support tickets
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const userId = session.id as string;
    const userEmail = session.email as string;

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
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const userId = session.id as string;
    const userEmail = session.email as string;
    const rateLimitUserId = String(session.userId || session.id);

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
