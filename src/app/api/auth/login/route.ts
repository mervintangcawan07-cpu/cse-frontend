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

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const userRecord = user as { id: string; email: string; role: "USER" | "ADMIN"; isPaid: boolean };

    const token = await signJWT({
      userId: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
      isPaid: userRecord.isPaid,
    });

    const response = NextResponse.json(
      {
        message: "Authenticated successfully",
        user: {
          id: userRecord.id,
          email: userRecord.email,
          role: userRecord.role,
          isPaid: userRecord.isPaid,
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