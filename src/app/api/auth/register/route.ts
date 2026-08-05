import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rateLimitKey = `register:${clientIp}`;

    // 🔒 Limit: 3 registration attempts per minute per IP
    const { allowed, resetSeconds } = checkRateLimit(rateLimitKey, 3, 60000);

    if (!allowed) {
      return NextResponse.json(
        {
          error: `Too many registration attempts. Please wait ${resetSeconds} seconds before trying again.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(resetSeconds) },
        }
      );
    }

    const { name, email, password } = await req.json();

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

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("[REGISTER_ERROR]", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}