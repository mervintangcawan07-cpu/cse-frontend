// Relative Path: src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signJWT } from "@/lib/auth";
import {
  AUTH_LIMITER,
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from "@/lib/ratelimit";
import {
  checkAccountLockout,
  recordFailedAttempt,
  resetFailedAttempts,
} from "@/lib/accountLockout";
import { recordLoginFailure } from "@/lib/systemHealthMonitor";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitKey = `login:${clientIp}`;

    // 🔒 Limit: 5 login requests per 10 seconds per IP via Upstash distributed rate limiter
    const rateResult = await checkRateLimit(AUTH_LIMITER, rateLimitKey);
    if (!rateResult.success) {
      return createRateLimitResponse(rateResult, "Too many login attempts. Please wait a moment before trying again.");
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // 💡 Sanitize email input
    const cleanEmail = String(email).trim().toLowerCase();

    // 🔒 Check if account is locked out due to previous failed password attempts
    const { isLocked, remainingSeconds } = checkAccountLockout(cleanEmail);
    if (isLocked) {
      const minutes = Math.ceil(remainingSeconds / 60);
      return NextResponse.json(
        {
          error: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`,
        },
        {
          status: 423, // 423 Locked
          headers: { "Retry-After": String(remainingSeconds) },
        }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user || !user.password) {
      recordLoginFailure();
      const failure = recordFailedAttempt(cleanEmail);
      if (failure.isLocked) {
        const mins = Math.ceil(failure.remainingSeconds / 60);
        return NextResponse.json(
          { error: `Account locked after 5 failed attempts. Try again in ${mins} minutes.` },
          { status: 423 }
        );
      }
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      recordLoginFailure();
      const failure = recordFailedAttempt(cleanEmail);
      if (failure.isLocked) {
        const mins = Math.ceil(failure.remainingSeconds / 60);
        return NextResponse.json(
          { error: `Account locked after 5 failed attempts. Try again in ${mins} minutes.` },
          { status: 423 }
        );
      }
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // 🔒 Reset failed attempts on successful password verification
    resetFailedAttempts(cleanEmail);

    // 🔒 Require Email Verification (Admins bypass verification)
    if (!user.isEmailVerified && user.role !== "ADMIN") {
      return NextResponse.json(
        {
          error: "Please verify your email address before logging in. Check your inbox for the verification link.",
          unverified: true,
          email: user.email,
        },
        { status: 403 }
      );
    }

    // 🆔 Generate active session ID & update session timestamp prior to JWT issuance
    const activeSessionId = crypto.randomUUID();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        activeSessionId,
        lastActiveAt: new Date(),
      },
    });

    const token = await signJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
      isPaid: user.isPaid,
      sessionId: activeSessionId,
    });

    const response = NextResponse.json(
      {
        message: "Authenticated successfully",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isPaid: user.isPaid,
        },
      },
      { status: 200 }
    );

    response.cookies.set("cse_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 Days
    });

    return response;
  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}