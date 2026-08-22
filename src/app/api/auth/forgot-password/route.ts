import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";
import {
  AUTH_LIMITER,
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from "@/lib/ratelimit";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitKey = `auth:forgot-password:${clientIp}`;

    // 🔒 Limit: 5 forgot password requests per 10 seconds per IP
    const rateResult = await checkRateLimit(AUTH_LIMITER, rateLimitKey);
    if (!rateResult.success) {
      return createRateLimitResponse(
        rateResult,
        "Too many password reset requests. Please wait a moment before trying again."
      );
    }

    const body = await request.json();
    const { email } = body;

    const genericSuccessResponse = NextResponse.json({
      success: true,
      message: "If an account exists with this email, a reset link has been sent.",
    });

    if (!email) {
      return genericSuccessResponse;
    }

    const formattedEmail = String(email).toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: formattedEmail },
    });

    if (!user) {
      return genericSuccessResponse;
    }

    // 🔒 CRITICAL SECURITY GUARD: DISABLE ADMIN FORGOT PASSWORD WITHOUT REVEALING ROLE
    if (user.role === "ADMIN") {
      console.warn(`[SECURITY ALERT] Password reset attempt blocked for ADMIN account: ${user.email}`);
      return genericSuccessResponse;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 3600 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    await sendPasswordResetEmail(user.email, resetToken);

    return genericSuccessResponse;
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a reset link has been sent.",
    });
  }
}