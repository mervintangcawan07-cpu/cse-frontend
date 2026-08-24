import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/serverAuth";
import {
  PartnerOnboardingError,
  PartnerService,
  buildPartnerSetupDeliveryResult,
} from "@/lib/accounting/partnerService";
import { getSiteUrl } from "@/lib/config/site";

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
    if (Object.prototype.hasOwnProperty.call(body, "initialPassword")) {
      return NextResponse.json(
        { error: "Initial passwords are not accepted. Partners must use the secure setup link." },
        { status: 400 }
      );
    }

    const { action, commissionRate, customSlug, adminNotes } = body;

    if (action === "REJECT") {
      const application = await prisma.partnerApplication.findUnique({
        where: { id },
        select: { id: true, organizationName: true, status: true, createdPartnerId: true },
      });
      if (!application) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }
      if (application.status !== "PENDING" || application.createdPartnerId) {
        return NextResponse.json(
          { error: "This application has already been processed." },
          { status: 409 }
        );
      }

      const rejected = await prisma.partnerApplication.updateMany({
        where: { id, status: "PENDING", createdPartnerId: null },
        data: {
          status: "REJECTED",
          adminNotes: adminNotes || undefined,
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });
      if (rejected.count !== 1) {
        return NextResponse.json(
          { error: "This application changed while it was being rejected." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Application for ${application.organizationName} has been rejected.`,
      });
    }

    if (action === "APPROVE") {
      const parsedRate = commissionRate === undefined ? 10 : Number(commissionRate);
      if (!Number.isFinite(parsedRate)) {
        return NextResponse.json(
          { error: "Commission rate must be a valid number." },
          { status: 400 }
        );
      }

      const result = await PartnerService.approvePartnerApplication({
        applicationId: id,
        commissionRate: parsedRate,
        customSlug: customSlug ? String(customSlug) : undefined,
        adminNotes: adminNotes ? String(adminNotes) : undefined,
        adminUserId: user.id,
      });
      const partner = result.partner;
      const deliveryResult = buildPartnerSetupDeliveryResult(
        "APPROVED",
        partner.name,
        result.deliveryStatus
      );

      return NextResponse.json({
        ...deliveryResult,
        partner: {
          id: partner.id,
          partnerId: partner.partnerId || partner.code,
          name: partner.name,
          code: partner.code,
          slug: partner.slug,
          status: partner.status,
          contactEmail: partner.contactEmail,
          landingUrl: `${getSiteUrl()}/p/${partner.slug || partner.code}`,
        },
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use APPROVE or REJECT." },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error("[ADMIN_PARTNER_APPLICATION_ACTION_ERROR]", error);
    if (error instanceof PartnerOnboardingError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "MISSING_EMAIL" ? 400 : 409;
      return NextResponse.json({ error: error.message }, { status });
    }
    const errorCode = (error as { code?: string })?.code;
    if (errorCode === "P2002" || errorCode === "P2034") {
      return NextResponse.json(
        { error: "This application was already processed or conflicts with an existing partner." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to process partner application." },
      { status: 500 }
    );
  }
}
