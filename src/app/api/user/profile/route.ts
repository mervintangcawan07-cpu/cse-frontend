import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized: Session expired." }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = String(session.userId);
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

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, isPaid: true },
    });

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