// Relative Path: src/app/api/partner/portal/profile/route.ts
import { NextResponse } from "next/server";
import { requirePartnerAuth } from "@/lib/partnerAuth";
import { prisma } from "@/lib/prisma";
import { PartnerService } from "@/lib/accounting/partnerService";

export async function GET(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [dbPartner, payoutProfiles] = await Promise.all([
      prisma.partner.findUnique({
        where: { id: partner.id },
      }),
      PartnerService.listPayoutProfiles(partner.id),
    ]);

    if (!dbPartner) {
      return NextResponse.json({ error: "Partner record not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      partner: {
        id: dbPartner.id,
        partnerId: dbPartner.partnerId || dbPartner.code,
        code: dbPartner.code,
        slug: dbPartner.slug,
        name: dbPartner.name,
        type: dbPartner.type,
        status: dbPartner.status,
        contactEmail: dbPartner.contactEmail,
        contactName: dbPartner.contactName,
        contactPhone: dbPartner.contactPhone,
        tagline: dbPartner.tagline,
        badgeText: dbPartner.badgeText,
        description: dbPartner.description,
        facebookUrl: dbPartner.facebookUrl,
        websiteUrl: dbPartner.websiteUrl,
        commissionModel: dbPartner.commissionModel,
        commissionRate: dbPartner.commissionRate,
        holdingPeriodDays: dbPartner.holdingPeriodDays,
        minPayoutCentavos: dbPartner.minPayoutCentavos,
        agreementStart: dbPartner.agreementStart.toISOString(),
        agreementEnd: dbPartner.agreementEnd ? dbPartner.agreementEnd.toISOString() : null,
      },
      payoutProfiles,
    });
  } catch (error) {
    console.error("[PARTNER_PORTAL_PROFILE_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch partner profile" }, { status: 500 });
  }
}

function isValidHttpUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function PUT(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { contactName, contactPhone, tagline, description, facebookUrl, websiteUrl } = body;

    const data: Record<string, string> = {};

    if (contactName !== undefined) {
      if (typeof contactName !== "string" || contactName.trim().length > 100) {
        return NextResponse.json({ error: "Contact name must not exceed 100 characters" }, { status: 400 });
      }
      data.contactName = contactName.trim();
    }

    if (contactPhone !== undefined) {
      if (typeof contactPhone !== "string" || contactPhone.trim().length > 30) {
        return NextResponse.json({ error: "Contact phone must not exceed 30 characters" }, { status: 400 });
      }
      data.contactPhone = contactPhone.trim();
    }

    if (tagline !== undefined) {
      if (typeof tagline !== "string" || tagline.trim().length > 200) {
        return NextResponse.json({ error: "Tagline must not exceed 200 characters" }, { status: 400 });
      }
      data.tagline = tagline.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string" || description.trim().length > 2000) {
        return NextResponse.json({ error: "Description must not exceed 2000 characters" }, { status: 400 });
      }
      data.description = description.trim();
    }

    if (facebookUrl !== undefined) {
      const trimmedFb = typeof facebookUrl === "string" ? facebookUrl.trim() : "";
      if (trimmedFb !== "") {
        if (trimmedFb.length > 500 || !isValidHttpUrl(trimmedFb)) {
          return NextResponse.json({ error: "Facebook URL must be a valid HTTP(S) URL and under 500 characters" }, { status: 400 });
        }
        data.facebookUrl = trimmedFb;
      } else {
        data.facebookUrl = "";
      }
    }

    if (websiteUrl !== undefined) {
      const trimmedWeb = typeof websiteUrl === "string" ? websiteUrl.trim() : "";
      if (trimmedWeb !== "") {
        if (trimmedWeb.length > 500 || !isValidHttpUrl(trimmedWeb)) {
          return NextResponse.json({ error: "Website URL must be a valid HTTP(S) URL and under 500 characters" }, { status: 400 });
        }
        data.websiteUrl = trimmedWeb;
      } else {
        data.websiteUrl = "";
      }
    }

    // Financial rates and terms are strictly protected and cannot be modified by partner
    const updated = await prisma.partner.update({
      where: { id: partner.id },
      data,
    });

    return NextResponse.json({
      success: true,
      message: "Partner profile updated successfully!",
      partner: {
        partnerId: updated.partnerId || updated.code,
        name: updated.name,
        contactName: updated.contactName,
        contactPhone: updated.contactPhone,
        tagline: updated.tagline,
      },
    });
  } catch (error) {
    console.error("[PARTNER_PORTAL_PROFILE_PUT_ERROR]", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
