// Relative Path: src/app/api/admin/accounting/taxes/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { TaxService } from "@/lib/accounting/taxService";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const [taxConfigs, taxRecords] = await Promise.all([
      prisma.taxConfiguration.findMany({
        orderBy: { createdAt: "desc" },
      }),
      prisma.taxRecord.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: { taxConfig: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      taxConfigs,
      taxRecords,
    });
  } catch (error) {
    console.error("[ADMIN_TAXES_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch tax configurations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, taxType, rate, fixedAmountCentavos, calculationBasis, notes } = body;

    if (!name) {
      return NextResponse.json({ error: "Tax policy name is required" }, { status: 400 });
    }

    const config = await TaxService.createTaxConfig({
      name,
      taxType: taxType || "OTHER_TAX",
      rate: rate ?? 0.0,
      fixedAmountCentavos: fixedAmountCentavos ? Math.round(fixedAmountCentavos * 100) : 0,
      calculationBasis: calculationBasis || "CUSTOMER_PAYMENT",
      notes,
      adminUserId: user.id,
    });

    return NextResponse.json({
      success: true,
      config,
      message: `Tax policy '${config.name}' created successfully!`,
    });
  } catch (error: any) {
    console.error("[ADMIN_TAXES_POST_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to create tax config" }, { status: 500 });
  }
}
