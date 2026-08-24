import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import {
  PartnerOnboardingError,
  PartnerService,
  buildPartnerSetupDeliveryResult,
} from "@/lib/accounting/partnerService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const result = await PartnerService.resendPartnerSetupLink({
      partnerId: id,
      adminUserId: user.id,
    });

    return NextResponse.json({
      ...buildPartnerSetupDeliveryResult(
        "RESENT",
        result.partnerName,
        result.deliveryStatus
      ),
      partner: {
        id: result.partnerId,
        partnerId: result.displayPartnerId,
      },
    });
  } catch (error) {
    console.error("[ADMIN_PARTNER_RESEND_SETUP_ERROR]", error);
    if (error instanceof PartnerOnboardingError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "MISSING_EMAIL"
            ? 400
            : 409;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json(
      { error: "Failed to refresh the partner setup link." },
      { status: 500 }
    );
  }
}
