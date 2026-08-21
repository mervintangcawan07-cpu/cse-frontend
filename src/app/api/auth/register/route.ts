import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  AUTH_LIMITER,
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from "@/lib/ratelimit";

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rateLimitKey = `register:${clientIp}`;

    // 🔒 Limit: 5 registration requests per 10 seconds per IP via Upstash distributed rate limiter
    const rateResult = await checkRateLimit(AUTH_LIMITER, rateLimitKey);
    if (!rateResult.success) {
      return createRateLimitResponse(rateResult, "Too many registration attempts. Please wait a moment before trying again.");
    }

    const { name, email, password, referralCode } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email is already registered." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "USER",
        isPaid: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isPaid: true,
      },
    });

    // 🎁 Referral Attribution & Code Generation
    try {
      const { ReferralService } = await import("@/lib/referral/referralService");
      await ReferralService.getOrCreateReferralCode(user.id).catch(() => null);

      if (referralCode) {
        await ReferralService.recordAttributionOnSignup({
          referredUserId: user.id,
          referralCodeString: referralCode,
          ipAddress: clientIp,
          userAgent: req.headers.get("user-agent"),
        });
      }
    } catch (referralErr) {
      console.error("[Referral Register Warning]:", referralErr);
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("[REGISTER_ERROR]", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}