import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("[SUPPORT_TICKETS_GET]", error);
    return NextResponse.json({ error: "Failed to load tickets" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, status, adminNotes } = await request.json();

    // 1. Update the Support Ticket
    const updatedTicket = await prisma.supportTicket.update({
      where: { id },
      data: { status, adminNotes },
    });

    // 2. Identify the target student ID
    let targetUserId = updatedTicket.userId;

    if (!targetUserId && updatedTicket.userEmail) {
      const student = await prisma.user.findUnique({
        where: { email: updatedTicket.userEmail },
        select: { id: true },
      });
      if (student) targetUserId = student.id;
    }

    // 3. Auto-generate In-App Notification
    if (targetUserId) {
      const statusLabel =
        status === "RESOLVED"
          ? "Resolved ✅"
          : status === "IN_PROGRESS"
          ? "In Progress ⏳"
          : "Pending Review 📩";

      const truncatedSubject =
        updatedTicket.subject.length > 28
          ? `${updatedTicket.subject.slice(0, 28)}...`
          : updatedTicket.subject;

      const notePreview = adminNotes
        ? ` Admin Note: "${adminNotes.slice(0, 80)}${adminNotes.length > 80 ? "..." : ""}"`
        : "";

      await prisma.notification.create({
        data: {
          userId: targetUserId,
          title: `Support Ticket Updated: ${truncatedSubject}`,
          message: `Your support inquiry status changed to "${statusLabel}".${notePreview}`,
          type: "SYSTEM",
          isRead: false,
        },
      });
    }

    return NextResponse.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    console.error("[SUPPORT_TICKETS_PUT]", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}