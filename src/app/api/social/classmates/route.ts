// Relative Path: src/app/api/social/classmates/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { resolveUserPresence } from "@/lib/social/presence";

const USER_STUDY_SELECT = {
  id: true,
  name: true,
  isPaid: true,
  lastActiveAt: true,
  studyProfile: {
    select: {
      displayName: true,
      avatar: true,
      bio: true,
      studyGoal: true,
      studyInterests: true,
      experienceLevel: true,
      presenceStatus: true,
      customStatusText: true,
      customStatusEmoji: true,
      showActivity: true,
      showBio: true,
      showStudyGoal: true,
      showInterests: true,
    },
  },
};

function formatUserWithPresence(user: any) {
  if (!user) return null;
  const presence = resolveUserPresence(user.lastActiveAt, user.studyProfile);
  return {
    ...user,
    presence,
    isOnline: presence.isOnline,
  };
}

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
        sender: { select: USER_STUDY_SELECT },
        receiver: { select: USER_STUDY_SELECT },
      },
    });

    const relatedUserIds = new Set<string>([userId]);
    relations.forEach((r) => {
      relatedUserIds.add(r.senderId);
      relatedUserIds.add(r.receiverId);
    });

    if (type === "suggested") {
      const rawSuggested = await prisma.user.findMany({
        where: {
          id: { notIn: Array.from(relatedUserIds) },
        },
        select: USER_STUDY_SELECT,
        orderBy: { lastActiveAt: "desc" },
        take: 10,
      });

      const suggested = rawSuggested.map(formatUserWithPresence);
      return NextResponse.json({ success: true, suggested });
    }

    if (type === "search" && query.trim()) {
      const results = await prisma.user.findMany({
        where: {
          id: { not: userId },
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { studyProfile: { displayName: { contains: query, mode: "insensitive" } } },
          ],
        },
        select: USER_STUDY_SELECT,
        take: 15,
      });

      const formattedResults = results.map((u) => {
        const rel = relations.find(
          (r) => (r.senderId === u.id && r.receiverId === userId) || (r.senderId === userId && r.receiverId === u.id)
        );
        const userWithPres = formatUserWithPresence(u);
        return {
          ...userWithPres,
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
      const formattedOther = formatUserWithPresence(otherUser);

      if (r.status === "ACCEPTED") {
        classmates.push({ relationId: r.id, user: formattedOther });
      } else if (r.status === "PENDING") {
        if (r.receiverId === userId) {
          pendingIncoming.push({ relationId: r.id, sender: formattedOther, createdAt: r.createdAt });
        } else {
          pendingOutgoing.push({ relationId: r.id, receiver: formattedOther, createdAt: r.createdAt });
        }
      }
    });

    const rawSuggested = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(relatedUserIds) },
      },
      select: USER_STUDY_SELECT,
      orderBy: { lastActiveAt: "desc" },
      take: 8,
    });

    const suggested = rawSuggested.map(formatUserWithPresence);

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

    if (!targetUserId || targetUserId === userId) {
      return NextResponse.json({ error: "Invalid target user" }, { status: 400 });
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
      return NextResponse.json({ error: "Relation already exists", status: existing.status }, { status: 400 });
    }

    const relation = await prisma.classmateRelation.create({
      data: {
        senderId: userId,
        receiverId: targetUserId,
        status: "PENDING",
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            studyProfile: { select: { displayName: true } },
          },
        },
      },
    });

    const senderDisplayName = relation.sender.studyProfile?.displayName || relation.sender.name || "A fellow examinee";

    await createNotification({
      userId: targetUserId,
      type: "CLASSMATE_REQUEST",
      title: "New Classmate Request",
      message: `${senderDisplayName} sent you a study classmate invitation!`,
    });

    return NextResponse.json({ success: true, relation });
  } catch (error: any) {
    console.error("[CLASSMATES_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to send classmate request", details: error?.message }, { status: 500 });
  }
}