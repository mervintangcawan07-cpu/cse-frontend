// Relative Path: src/app/api/admin/accounting/partners/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import {
  PartnerOnboardingError,
  PartnerService,
  buildPartnerSetupDeliveryResult,
  canResendPartnerSetupLink,
} from "@/lib/accounting/partnerService";
import { formatCentavosToPesos } from "@/lib/accounting/money";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const type = searchParams.get("type") || undefined;
    const q = searchParams.get("q") || undefined;

    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (type && type !== "ALL") where.type = type;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { contactEmail: { contains: q, mode: "insensitive" } },
      ];
    }

    const partners = await prisma.partner.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        commissions: { select: { purchaseAmountCentavos: true, commissionAmountCentavos: true, status: true } },
        _count: { select: { attributions: true, commissions: true } },
      },
    });

    const formatted = partners.map((p) => {
      let revenueCentavos = 0;
      let commissionCentavos = 0;
      let availableCentavos = 0;
      let paidCentavos = 0;

      p.commissions.forEach((c) => {
        revenueCentavos += c.purchaseAmountCentavos;
        if (c.status === "PAID") {
          commissionCentavos += c.commissionAmountCentavos;
          paidCentavos += c.commissionAmountCentavos;
        } else if (c.status === "AVAILABLE" || c.status === "PENDING") {
          commissionCentavos += c.commissionAmountCentavos;
          availableCentavos += c.commissionAmountCentavos;
        }
      });

      return {
        id: p.id,
        partnerId: p.partnerId || p.code,
        code: p.code,
        name: p.name,
        type: p.type,
        status: p.status,
        contactName: p.contactName,
        contactEmail: p.contactEmail,
        commissionModel: p.commissionModel,
        commissionRate: p.commissionRate,
        holdingPeriodDays: p.holdingPeriodDays,
        minPayoutCentavos: p.minPayoutCentavos,
        totalReferredCount: p._count.attributions,
        totalConversionsCount: p._count.commissions,
        totalRevenueCentavos: revenueCentavos,
        formattedRevenue: formatCentavosToPesos(revenueCentavos),
        totalCommissionCentavos: commissionCentavos,
        formattedCommission: formatCentavosToPesos(commissionCentavos),
        availableBalanceCentavos: availableCentavos,
        formattedAvailable: formatCentavosToPesos(availableCentavos),
        paidCentavos,
        canResendSetupLink: canResendPartnerSetupLink(p),
        createdAt: p.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      total: formatted.length,
      partners: formatted,
    });
  } catch (error) {
    console.error("[ADMIN_PARTNERS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch partners" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    if (Object.prototype.hasOwnProperty.call(body, "password")) {
      return NextResponse.json(
        { error: "Initial passwords are not accepted. Partners must use the secure setup link." },
        { status: 400 }
      );
    }

    const {
      name,
      code,
      slug,
      tagline,
      badgeText,
      description,
      type,
      contactName,
      contactEmail,
      contactPhone,
      commissionModel,
      commissionRate,
      fixedCommissionCentavos,
      holdingPeriodDays,
      minPayoutCentavos,
      notes,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Partner name is required" }, { status: 400 });
    }
    if (!contactEmail || !String(contactEmail).trim()) {
      return NextResponse.json(
        { error: "Contact email is required for secure partner setup." },
        { status: 400 }
      );
    }

    const partner = await PartnerService.createPartner({
      name,
      code,
      slug,
      tagline,
      badgeText,
      description,
      type: type || "FACEBOOK_PAGE",
      contactName,
      contactEmail: String(contactEmail),
      contactPhone,
      commissionModel: commissionModel || "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRate: commissionRate ?? 10.0,
      fixedCommissionCentavos: fixedCommissionCentavos ? Math.round(fixedCommissionCentavos * 100) : 0,
      holdingPeriodDays: holdingPeriodDays ?? 7,
      minPayoutCentavos: minPayoutCentavos ? Math.round(minPayoutCentavos * 100) : 15000,
      notes,
      adminUserId: user.id,
    });

    return NextResponse.json({
      ...buildPartnerSetupDeliveryResult("CREATED", partner.name, partner.deliveryStatus),
      partner: {
        id: partner.id,
        partnerId: partner.partnerId || partner.code,
        code: partner.code,
        slug: partner.slug,
        name: partner.name,
        type: partner.type,
        status: partner.status,
        contactEmail: partner.contactEmail,
      },
    });
  } catch (error: unknown) {
    console.error("[ADMIN_PARTNERS_POST_ERROR]", error);
    if (error instanceof PartnerOnboardingError) {
      const status = error.code === "MISSING_EMAIL" ? 400 : 409;
      return NextResponse.json({ error: error.message }, { status });
    }
    const errorCode = (error as { code?: string })?.code;
    if (errorCode === "P2002" || errorCode === "P2034") {
      return NextResponse.json(
        { error: "The partner could not be created because a conflicting record already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create partner." },
      { status: 500 }
    );
  }
}
