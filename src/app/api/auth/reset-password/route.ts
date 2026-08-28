import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  AUTH_LIMITER,
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from "@/lib/ratelimit";
import { isAccountOperational } from "@/lib/accountLifecycle";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitKey = `auth:reset-password:${clientIp}`;

    // 🔒 Limit: 5 password reset attempts per 10 seconds per IP
    const rateResult = await checkRateLimit(AUTH_LIMITER, rateLimitKey);
    if (!rateResult.success) {
      return createRateLimitResponse(
        rateResult,
        "Too many password reset attempts. Please wait a moment before trying again."
      );
    }

    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json({ error: "Token and new password are required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired password reset token" }, { status: 400 });
    }

    if (user.role === "ADMIN") {
      return NextResponse.json({ error: "Admin password resets are disabled" }, { status: 403 });
    }

    if (!isAccountOperational(user)) {
      return NextResponse.json({ error: "Invalid or expired password reset token" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const passwordUpdate = await prisma.user.updateMany({
      where: {
        id: user.id,
        role: "USER",
        isBanned: false,
        deletedAt: null,
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    if (passwordUpdate.count !== 1) {
      return NextResponse.json({ error: "Invalid or expired password reset token" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Password reset successful! You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
