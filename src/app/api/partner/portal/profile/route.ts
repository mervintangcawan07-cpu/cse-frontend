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

export async function PUT(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { contactName, contactPhone, tagline, description, facebookUrl, websiteUrl } = body;

    // Financial rates and terms are strictly protected and cannot be modified by partner
    const updated = await prisma.partner.update({
      where: { id: partner.id },
      data: {
        contactName: contactName !== undefined ? String(contactName).trim() : undefined,
        contactPhone: contactPhone !== undefined ? String(contactPhone).trim() : undefined,
        tagline: tagline !== undefined ? String(tagline).trim() : undefined,
        description: description !== undefined ? String(description).trim() : undefined,
        facebookUrl: facebookUrl !== undefined ? String(facebookUrl).trim() : undefined,
        websiteUrl: websiteUrl !== undefined ? String(websiteUrl).trim() : undefined,
      },
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
