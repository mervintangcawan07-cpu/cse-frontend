// Relative Path: src/app/api/admin/users/action/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireSudo } from "@/middleware/requireSudo";

export const POST = requireSudo(async (request: NextRequest) => {
  try {
    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated && authentication.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !authentication.authenticated ||
      authentication.session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { action, userId, banReason, newPassword } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (action === "BAN") {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: true,
          banReason: banReason || "Violated platform terms of service.",
          activeSessionId: null, // Force immediate logout
        },
      });
      return NextResponse.json({ success: true, message: "User account banned successfully.", user: updatedUser });
    }

    if (action === "UNBAN") {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: false,
          banReason: null,
        },
      });
      return NextResponse.json({ success: true, message: "User account unbanned successfully.", user: updatedUser });
    }

    if (action === "RESET_PASSWORD") {
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          activeSessionId: null, // Force re-login with new credentials
        },
      });

      return NextResponse.json({ success: true, message: "User password reset successfully." });
    }

    return NextResponse.json({ error: "Invalid action type" }, { status: 400 });
  } catch (error) {
    console.error("[ADMIN_USER_ACTION_ERROR]", error);
    return NextResponse.json({ error: "Failed to perform user action" }, { status: 500 });
  }
});
