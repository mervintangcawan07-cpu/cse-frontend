// Relative Path: src/app/api/social/classmates/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const type = searchParams.get("type") || "all";

    const relations = await prisma.classmateRelation.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: { select: { id: true, name: true, email: true, isPaid: true, lastActiveAt: true } },
        receiver: { select: { id: true, name: true, email: true, isPaid: true, lastActiveAt: true } },
      },
    });

    const relatedUserIds = new Set<string>([userId]);
    relations.forEach((r) => {
      relatedUserIds.add(r.senderId);
      relatedUserIds.add(r.receiverId);
    });

    if (type === "suggested") {
      const suggested = await prisma.user.findMany({
        where: {
          id: { notIn: Array.from(relatedUserIds) },
        },
        select: {
          id: true,
          name: true,
          email: true,
          isPaid: true,
          lastActiveAt: true,
        },
        orderBy: { lastActiveAt: "desc" },
        take: 10,
      });

      return NextResponse.json({ success: true, suggested });
    }

    if (type === "search" && query.trim()) {
      const results = await prisma.user.findMany({
        where: {
          id: { not: userId },
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          isPaid: true,
          lastActiveAt: true,
        },
        take: 15,
      });

      const formattedResults = results.map((u) => {
        const rel = relations.find(
          (r) => (r.senderId === u.id && r.receiverId === userId) || (r.senderId === userId && r.receiverId === u.id)
        );
        return {
          ...u,
          relationStatus: rel ? rel.status : null,
          relationId: rel ? rel.id : null,
          isSender: rel ? rel.senderId === userId : false,
        };
      });

      return NextResponse.json({ success: true, results: formattedResults });
    }

    const classmates: any[] = [];
    const pendingIncoming: any[] = [];
    const pendingOutgoing: any[] = [];

    relations.forEach((r) => {
      const otherUser = r.senderId === userId ? r.receiver : r.sender;

      if (r.status === "ACCEPTED") {
        classmates.push({ relationId: r.id, user: otherUser });
      } else if (r.status === "PENDING") {
        if (r.receiverId === userId) {
          pendingIncoming.push({ relationId: r.id, sender: r.sender, createdAt: r.createdAt });
        } else {
          pendingOutgoing.push({ relationId: r.id, receiver: r.receiver, createdAt: r.createdAt });
        }
      }
    });

    const suggested = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(relatedUserIds) },
      },
      select: {
        id: true,
        name: true,
        email: true,
        isPaid: true,
        lastActiveAt: true,
      },
      orderBy: { lastActiveAt: "desc" },
      take: 6,
    });

    return NextResponse.json({
      success: true,
      classmates,
      pendingIncoming,
      pendingOutgoing,
      suggested,
    });
  } catch (error: any) {
    console.error("[CLASSMATES_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch classmate data", details: error?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    const body = await request.json();
    const { targetUserId } = body;

    if (!targetUserId || typeof targetUserId !== "string" || targetUserId === userId) {
      return NextResponse.json({ error: "Invalid classmate target user ID" }, { status: 400 });
    }

    const existing = await prisma.classmateRelation.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === "BLOCKED") {
        return NextResponse.json({ error: "Cannot send request to this user." }, { status: 403 });
      }
      if (existing.status === "ACCEPTED") {
        return NextResponse.json({ error: "Already connected as classmates." }, { status: 400 });
      }
      if (existing.status === "PENDING") {
        return NextResponse.json({ error: "A classmate request is already pending." }, { status: 400 });
      }
    }

    const senderUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const newRelation = await prisma.classmateRelation.create({
      data: {
        senderId: userId,
        receiverId: targetUserId,
        status: "PENDING",
      },
    });

    // Notify recipient
    await createNotification({
      userId: targetUserId,
      title: "New Classmate Invitation",
      message: `${senderUser?.name || "An examinee"} sent you a classmate request.`,
      type: "CLASSMATE_REQUEST",
    });

    return NextResponse.json({ success: true, relation: newRelation, message: "Classmate request sent!" });
  } catch (error: any) {
    console.error("[CLASSMATE_REQUEST_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to send classmate request", details: error?.message }, { status: 500 });
  }
}