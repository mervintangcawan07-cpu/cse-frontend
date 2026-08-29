// Relative Path: src/app/api/social/classmates/respond/route.ts
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
    const { relationId, action } = body;

    if (!relationId || !action) {
      return NextResponse.json({ error: "Missing relation ID or action" }, { status: 400 });
    }

    const relation = await prisma.classmateRelation.findUnique({
      where: { id: String(relationId) },
    });

    if (!relation || (relation.senderId !== userId && relation.receiverId !== userId)) {
      return NextResponse.json({ error: "Classmate request record not found or forbidden" }, { status: 404 });
    }

    if (action === "ACCEPT") {
      if (relation.receiverId !== userId) {
        return NextResponse.json({ error: "Only the recipient can accept a request" }, { status: 403 });
      }

      await prisma.classmateRelation.update({
        where: { id: String(relationId) },
        data: { status: "ACCEPTED" },
      });

      // 🔔 Dispatch notification to original sender
      const accepter = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          studyProfile: { select: { displayName: true } },
        },
      });

      const accepterDisplayName = accepter?.studyProfile?.displayName || accepter?.name || "A classmate";

      await createNotification({
        userId: relation.senderId,
        type: "CLASSMATE_ACCEPTED",
        title: "Classmate Request Accepted! 🎉",
        message: `${accepterDisplayName} accepted your classmate request. You can now chat and study together!`,
      });

      return NextResponse.json({ success: true, message: "Classmate request accepted!" });
    }

    if (action === "REJECT" || action === "CANCEL" || action === "REMOVE") {
      await prisma.classmateRelation.delete({
        where: { id: String(relationId) },
      });
      return NextResponse.json({ success: true, message: `Classmate relation updated (${action.toLowerCase()}ed).` });
    }

    if (action === "BLOCK") {
      await prisma.classmateRelation.update({
        where: { id: String(relationId) },
        data: { status: "BLOCKED" },
      });
      return NextResponse.json({ success: true, message: "User blocked successfully." });
    }

    return NextResponse.json({ error: "Invalid action specified" }, { status: 400 });
  } catch (error: any) {
    console.error("[CLASSMATE_RESPOND_ERROR]", error);
    return NextResponse.json({ error: "Failed to respond to classmate request", details: error?.message }, { status: 500 });
  }
}