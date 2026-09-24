import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import {
  PartnerOnboardingError,
  PartnerService,
  buildPartnerSetupDeliveryResult,
} from "@/lib/accounting/partnerService";
import { handleAccountingError } from "@/lib/errors/apiErrorHandler";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let user: any;
  try {
    const authResult = await requireAdminAuth(request);
    user = authResult.user;
    if (authResult.errorResponse) return authResult.errorResponse;
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
    return handleAccountingError("ADMIN_PARTNER_RESEND_SETUP", error, { actorId: user?.id });
  }
}
