import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/serverAuth";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const applications = await prisma.partnerApplication.findMany({
      where: status && status !== "ALL" ? { status: status as any } : undefined,
      orderBy: { createdAt: "desc" },
    });

    const pendingCount = await prisma.partnerApplication.count({
      where: { status: "PENDING" },
    });

    return NextResponse.json({
      success: true,
      pendingCount,
      total: applications.length,
      applications: applications.map((a) => ({
        id: a.id,
        applicantName: a.applicantName,
        organizationName: a.organizationName,
        email: a.email,
        phone: a.phone,
        type: a.type,
        socialUrl: a.socialUrl,
        audienceSize: a.audienceSize,
        proposedSlug: a.proposedSlug,
        pitchReason: a.pitchReason,
        status: a.status,
        adminNotes: a.adminNotes,
        createdPartnerId: a.createdPartnerId,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[ADMIN_PARTNER_APPLICATIONS_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch partner applications" },
      { status: 500 }
    );
  }
}
