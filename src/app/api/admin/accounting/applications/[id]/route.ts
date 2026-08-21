import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/serverAuth";
import { PartnerService } from "@/lib/accounting/partnerService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { action, commissionRate, customSlug, initialPassword, adminNotes } = body;

    const application = await prisma.partnerApplication.findUnique({
      where: { id },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (action === "REJECT") {
      const updated = await prisma.partnerApplication.update({
        where: { id },
        data: {
          status: "REJECTED",
          adminNotes: adminNotes || undefined,
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Application for ${application.organizationName} has been rejected.`,
        application: updated,
      });
    }

    if (action === "APPROVE") {
      const effectiveSlug = customSlug || application.proposedSlug || undefined;
      const effectivePassword = initialPassword || "GovStudyX2026!";
      const rate = commissionRate !== undefined ? parseFloat(commissionRate) : 10.0;

      // Create the official Partner record
      const partner = await PartnerService.createPartner({
        name: application.organizationName,
        slug: effectiveSlug,
        password: effectivePassword,
        type: application.type,
        contactName: application.applicantName,
        contactEmail: application.email,
        contactPhone: application.phone || undefined,
        commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
        commissionRate: rate,
        holdingPeriodDays: 7,
        minPayoutCentavos: 15000,
        tagline: `Official Partner for 2026 Civil Service Review`,
        badgeText: "Official Partner",
        notes: `Approved from online application (${application.id}). Social: ${application.socialUrl}`,
        adminUserId: user.id,
      });

      // Update application to APPROVED
      await prisma.partnerApplication.update({
        where: { id },
        data: {
          status: "APPROVED",
          createdPartnerId: partner.id,
          adminNotes: adminNotes || undefined,
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      const partnerLandingUrl = `https://govstudyx.com/p/${partner.slug || partner.code}`;

      return NextResponse.json({
        success: true,
        message: `Partner "${partner.name}" approved successfully!`,
        partner: {
          id: partner.id,
          name: partner.name,
          code: partner.code,
          slug: partner.slug,
          landingUrl: partnerLandingUrl,
          loginUrl: "https://govstudyx.com/partner/login",
          initialPassword: effectivePassword,
        },
      });
    }

    return NextResponse.json({ error: "Invalid action. Use APPROVE or REJECT." }, { status: 400 });
  } catch (error: any) {
    console.error("[ADMIN_PARTNER_APPLICATION_ACTION_ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Failed to process application" },
      { status: 500 }
    );
  }
}
