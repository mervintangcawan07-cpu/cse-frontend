import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";
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
    const rateLimitKey = `auth:resend-verification:${clientIp}`;

    // 🔒 Limit: 5 verification resend attempts per 10 seconds per IP
    const rateResult = await checkRateLimit(AUTH_LIMITER, rateLimitKey);
    if (!rateResult.success) {
      return createRateLimitResponse(
        rateResult,
        "Too many verification requests. Please wait a moment before trying again."
      );
    }

    const body = await request.json();
    const { email } = body;

    const genericSuccessResponse = NextResponse.json({
      success: true,
      message: "If an unverified account exists, a new link has been sent.",
    });

    if (!email) {
      return genericSuccessResponse;
    }

    const formattedEmail = String(email).toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: formattedEmail },
    });

    if (!user || user.isEmailVerified || !isAccountOperational(user)) {
      return genericSuccessResponse;
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 3600 * 1000);

    const tokenUpdate = await prisma.user.updateMany({
      where: {
        id: user.id,
        isBanned: false,
        deletedAt: null,
        isEmailVerified: false,
      },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    if (tokenUpdate.count !== 1) {
      return genericSuccessResponse;
    }

    await sendVerificationEmail(user.email, verificationToken);

    return NextResponse.json({
      success: true,
      message: "A new verification link has been sent to your email.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({
      success: true,
      message: "If an unverified account exists, a new link has been sent.",
    });
  }
}
