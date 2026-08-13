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
    const filter = searchParams.get("filter") || "ALL"; // ALL | SAME_DATE | OTHER_DATES | NO_DATE

    // 1. Fetch current caller's profile to compute relevance matching
    const caller = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        studyProfile: {
          select: {
            displayName: true,
            studyGoal: true,
            experienceLevel: true,
            studyInterests: true,
          },
        },
      },
    });

    const callerGoal = caller?.studyProfile?.studyGoal?.trim().toLowerCase() || null;
    const callerInterests = caller?.studyProfile?.studyInterests || [];
    const callerLevel = caller?.studyProfile?.experienceLevel?.trim().toLowerCase() || null;

    // 2. Fetch all classmate relations involving the caller
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

    // Helper to score candidate relevance without excluding anyone
    const evaluateCandidate = (candidate: any) => {
      let score = 0;
      const candGoal = candidate.studyProfile?.studyGoal;
      const candGoalNorm = candGoal?.trim().toLowerCase() || null;
      const candInterests = candidate.studyProfile?.studyInterests || [];
      const candLevel = candidate.studyProfile?.experienceLevel?.trim().toLowerCase() || null;

      // Same CSE target date or exam goal (+100)
      const hasSameGoal = Boolean(callerGoal && candGoalNorm && candGoalNorm === callerGoal);
      if (hasSameGoal) {
        score += 100;
      }

      // Same experience level (+20)
      if (callerLevel && candLevel && candLevel === callerLevel) {
        score += 20;
      }

      // Shared study interests (+10 per shared interest)
      const sharedInterests = candInterests.filter((interest: string) =>
        callerInterests.some((ci: string) => ci.toLowerCase() === interest.toLowerCase())
      );
      score += sharedInterests.length * 10;

      // Recency bonus (+10 for today, +5 for this week)
      if (candidate.lastActiveAt) {
        const hoursAgo = (Date.now() - new Date(candidate.lastActiveAt).getTime()) / (1000 * 60 * 60);
        if (hoursAgo < 24) score += 10;
        else if (hoursAgo < 72) score += 5;
      }

      const hasGoal = Boolean(candGoal && candGoal.trim());

      return {
        score,
        hasSameGoal,
        hasGoal,
        targetExamGoal: candidate.studyProfile?.showStudyGoal !== false ? candGoal : null,
        sharedInterests: candidate.studyProfile?.showInterests !== false ? sharedInterests : [],
      };
    };

    // 3. Search Mode (Broad search across name, display name, study goal, bio, interests)
    if (type === "search" && query.trim()) {
      const results = await prisma.user.findMany({
        where: {
          id: { not: userId },
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { studyProfile: { displayName: { contains: query, mode: "insensitive" } } },
            { studyProfile: { studyGoal: { contains: query, mode: "insensitive" } } },
            { studyProfile: { bio: { contains: query, mode: "insensitive" } } },
          ],
        },
        select: USER_STUDY_SELECT,
        take: 30,
      });

      const formattedResults = results.map((u) => {
        const rel = relations.find(
          (r) => (r.senderId === u.id && r.receiverId === userId) || (r.senderId === userId && r.receiverId === u.id)
        );
        const evalData = evaluateCandidate(u);
        const userWithPres = formatUserWithPresence(u);
        return {
          ...userWithPres,
          ...evalData,
          relationStatus: rel ? rel.status : null,
          relationId: rel ? rel.id : null,
          isSender: rel ? rel.senderId === userId : false,
        };
      });

      // Sort search results by match relevance
      formattedResults.sort((a, b) => b.score - a.score);

      return NextResponse.json({ success: true, results: formattedResults });
    }

    // 4. Separate relations into Classmates, Pending Incoming, Pending Outgoing
    const classmates: any[] = [];
    const pendingIncoming: any[] = [];
    const pendingOutgoing: any[] = [];

    relations.forEach((r) => {
      const otherUser = r.senderId === userId ? r.receiver : r.sender;
      const formattedOther = formatUserWithPresence(otherUser);
      const evalData = evaluateCandidate(otherUser);

      const payload = {
        ...formattedOther,
        ...evalData,
      };

      if (r.status === "ACCEPTED") {
        classmates.push({ relationId: r.id, user: payload });
      } else if (r.status === "PENDING") {
        if (r.receiverId === userId) {
          pendingIncoming.push({ relationId: r.id, sender: payload, createdAt: r.createdAt });
        } else {
          pendingOutgoing.push({ relationId: r.id, receiver: payload, createdAt: r.createdAt });
        }
      }
    });

    // 5. Query candidate suggestions pool (all discoverable registered users not yet connected)
    const rawCandidates = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(relatedUserIds) },
      },
      select: USER_STUDY_SELECT,
      orderBy: { lastActiveAt: "desc" },
      take: 40,
    });

    // Evaluate and score all candidates
    let scoredCandidates = rawCandidates.map((c) => {
      const evalData = evaluateCandidate(c);
      const userWithPres = formatUserWithPresence(c);
      return {
        ...userWithPres,
        ...evalData,
      };
    });

    // Apply optional filter category
    if (filter === "SAME_DATE") {
      scoredCandidates = scoredCandidates.filter((c) => c.hasSameGoal);
    } else if (filter === "OTHER_DATES") {
      scoredCandidates = scoredCandidates.filter((c) => c.hasGoal && !c.hasSameGoal);
    } else if (filter === "NO_DATE") {
      scoredCandidates = scoredCandidates.filter((c) => !c.hasGoal);
    }
    // Note: If filter === "ALL" (default), all eligible candidates are preserved

    // Sort by relevance score descending (Same target dates rank first, followed by shared interests & other users)
    scoredCandidates.sort((a, b) => b.score - a.score);

    const suggested = scoredCandidates.slice(0, 20);

    return NextResponse.json({
      success: true,
      currentUserGoal: caller?.studyProfile?.studyGoal || null,
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