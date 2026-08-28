import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAccountOperational } from "@/lib/accountLifecycle";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing verification token" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired verification token" }, { status: 400 });
    }

    if (!isAccountOperational(user)) {
      return NextResponse.json({ error: "Invalid or expired verification token" }, { status: 400 });
    }

    const verificationUpdate = await prisma.user.updateMany({
      where: {
        id: user.id,
        isBanned: false,
        deletedAt: null,
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    if (verificationUpdate.count !== 1) {
      return NextResponse.json({ error: "Invalid or expired verification token" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Email verified successfully!" });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json({ error: "Failed to verify email" }, { status: 500 });
  }
}
