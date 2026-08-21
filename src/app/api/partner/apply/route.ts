// Relative Path: src/app/api/partner/apply/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  AUTH_LIMITER,
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from "@/lib/ratelimit";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitKey = `partner_apply:${clientIp}`;

    const rateResult = await checkRateLimit(AUTH_LIMITER, rateLimitKey);
    if (!rateResult.success) {
      return createRateLimitResponse(
        rateResult,
        "Too many application attempts. Please wait a moment before trying again."
      );
    }

    const body = await request.json();
    const {
      applicantName,
      organizationName,
      email,
      phone,
      type,
      socialUrl,
      audienceSize,
      proposedSlug,
      pitchReason,
    } = body;

    if (!applicantName || !organizationName || !email || !socialUrl) {
      return NextResponse.json(
        { error: "Name, organization/channel name, email, and social URL are required." },
        { status: 400 }
      );
    }

    const formattedEmail = String(email).toLowerCase().trim();

    // Check if an application is already pending
    const existing = await prisma.partnerApplication.findFirst({
      where: {
        email: formattedEmail,
        status: "PENDING",
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error:
            "You already have a pending application under review. Our team will contact you within 24-48 hours.",
        },
        { status: 400 }
      );
    }

    // Clean proposed slug if provided
    let cleanSlug: string | null = null;
    if (proposedSlug) {
      cleanSlug = String(proposedSlug)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }

    const application = await prisma.partnerApplication.create({
      data: {
        applicantName: String(applicantName).trim(),
        organizationName: String(organizationName).trim(),
        email: formattedEmail,
        phone: phone ? String(phone).trim() : null,
        type: type || "CONTENT_CREATOR",
        socialUrl: String(socialUrl).trim(),
        audienceSize: audienceSize ? String(audienceSize).trim() : null,
        proposedSlug: cleanSlug,
        pitchReason: pitchReason ? String(pitchReason).trim() : null,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      applicationId: application.id,
      message:
        "Thank you! Your partner application has been submitted successfully. Our team reviews applications within 24-48 hours and will send your portal login credentials via email.",
    });
  } catch (error) {
    console.error("[PARTNER_APPLY_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to submit application. Please try again." },
      { status: 500 }
    );
  }
}
