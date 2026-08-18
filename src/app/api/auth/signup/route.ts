import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendVerificationEmail } from "@/lib/email";
import {
  AUTH_LIMITER,
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from "@/lib/ratelimit";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitKey = `signup:${clientIp}`;

    // 🔒 Limit: 5 signup requests per 10 seconds per IP via Upstash distributed rate limiter
    const rateResult = await checkRateLimit(AUTH_LIMITER, rateLimitKey);
    if (!rateResult.success) {
      return createRateLimitResponse(rateResult, "Too many signup attempts. Please wait a moment before trying again.");
    }

    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const formattedEmail = String(email).toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: formattedEmail },
    });

    if (existingUser) {
      return NextResponse.json({ error: "Email is already registered" }, { status: 400 });
    }

    // Hash the password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate Verification Token (Valid for 24 Hours)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 3600 * 1000);

    // Create the user with verification fields
    const newUser = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: formattedEmail,
        password: hashedPassword,
        isEmailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    // Send the verification link via Resend
    await sendVerificationEmail(newUser.email, verificationToken);

    return NextResponse.json({
      success: true,
      message: "Account created! Please check your email to verify your account before logging in.",
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}