import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signJWT } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // 💡 Sanitize email input (removes accidental spaces & lowercase conversion)
    const cleanEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

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

    const token = await signJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
      isPaid: user.isPaid,
    });

    const response = NextResponse.json(
      {
        message: "Authenticated successfully",
        user: {
          id: user.id,
          email: user.email,
          name: user.name, // 👈 Included name for Navbar/localStorage
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
      path: "/", // 👈 Guarantees cookie availability across all routes (/exam, /mock-exam)
      maxAge: 60 * 60 * 24 * 7, // 7 Days
    });

    return response;
  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}