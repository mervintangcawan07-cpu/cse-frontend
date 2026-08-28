import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PUT(request: Request) {
  try {
    const authenticatedSession = await getAuthenticatedSession(request);
    if (!authenticatedSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user: authenticatedUser, sessionId } = authenticatedSession;
    const userId = authenticatedUser.id;
    const body = await request.json();
    const { name, currentPassword, newPassword } = body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const updateData: { name?: string; password?: string } = {};

    // 1. Handle Name Update
    if (name && name.trim() !== "") {
      updateData.name = name.trim();
    }

    // 2. Handle Password Change
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to set a new password." },
          { status: 400 }
        );
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Incorrect current password." },
          { status: 400 }
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters long." },
          { status: 400 }
        );
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: "No changes submitted." });
    }

    const profileUpdate = await prisma.user.updateMany({
      where: {
        id: userId,
        isBanned: false,
        deletedAt: null,
        activeSessionId: sessionId,
      },
      data: updateData,
    });

    if (profileUpdate.count !== 1) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isPaid: true },
    });

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully!",
      user: updatedUser,
    });
  } catch (error) {
    console.error("[PROFILE_UPDATE_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
