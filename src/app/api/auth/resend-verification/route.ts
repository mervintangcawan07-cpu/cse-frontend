import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const formattedEmail = String(email).toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: formattedEmail },
    });

    if (!user || user.isEmailVerified) {
      return NextResponse.json({
        success: true,
        message: "If an unverified account exists, a new link has been sent.",
      });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 3600 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    await sendVerificationEmail(user.email, verificationToken);

    return NextResponse.json({
      success: true,
      message: "A new verification link has been sent to your email.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ error: "Failed to resend verification email" }, { status: 500 });
  }
}