import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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

    const body = await req.json();
    const { name, email, password, referralCode } = body;

    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email is already registered." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          name: typeof name === "string" ? name.trim() : null,
          email: cleanEmail,
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
    } catch (createError) {
      if (
        createError instanceof Prisma.PrismaClientKnownRequestError &&
        createError.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "An account with this email address already exists." },
          { status: 409 }
        );
      }
      throw createError;
    }

    // 🎁 Referral & Partner Attribution
    try {
      const { ReferralService } = await import("@/lib/referral/referralService");
      const { PartnerService } = await import("@/lib/accounting/partnerService");
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();

      const campaignSource =
        body.campaignSource ||
        body.src ||
        cookieStore.get("cse_campaign_source")?.value ||
        "direct";

      const effectiveCode =
        referralCode ||
        cookieStore.get("cse_partner_ref")?.value ||
        cookieStore.get("cse_ref")?.value;

      if (effectiveCode) {
        const partner = await PartnerService.resolvePartnerByCodeOrSlug(effectiveCode);
        if (partner) {
          await PartnerService.recordPartnerAttributionOnSignup({
            referredUserId: user.id,
            codeOrSlug: effectiveCode,
            campaignSource,
          });
        } else {
          await ReferralService.recordAttributionOnSignup({
            referredUserId: user.id,
            referralCodeString: effectiveCode,
            ipAddress: clientIp,
            userAgent: req.headers.get("user-agent"),
          });
        }
      }
    } catch (attributionErr) {
      console.error("[Attribution Register Warning]:", attributionErr);
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