// Relative Path: src/app/api/admin/accounting/settings/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_FINANCIAL_CONFIG, FINANCIAL_SETTING_KEYS } from "@/lib/accounting/config";
import { FinancialSettingsConfig } from "@/lib/accounting/types";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const settingsRows = await prisma.financialSetting.findMany();
    const configMap = new Map(settingsRows.map((r) => [r.key, r.value]));

    const config: FinancialSettingsConfig = {
      accountingLiveMode:
        configMap.get(FINANCIAL_SETTING_KEYS.ACCOUNTING_LIVE_MODE) === "true",
      partnerProgramEnabled:
        configMap.get(FINANCIAL_SETTING_KEYS.PARTNER_PROGRAM_ENABLED) === "true",
      payoutsEnabled:
        configMap.get(FINANCIAL_SETTING_KEYS.PAYOUTS_ENABLED) === "true",
      defaultPartnerHoldingDays: parseInt(
        configMap.get(FINANCIAL_SETTING_KEYS.DEFAULT_PARTNER_HOLDING_DAYS) || "7",
        10
      ),
      defaultPartnerMinPayoutCentavos: parseInt(
        configMap.get(FINANCIAL_SETTING_KEYS.DEFAULT_PARTNER_MIN_PAYOUT) || "15000",
        10
      ),
      autoReconciliationEnabled:
        configMap.get(FINANCIAL_SETTING_KEYS.AUTO_RECONCILIATION_ENABLED) !== "false",
    };

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("[ADMIN_ACCOUNTING_SETTINGS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch financial settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const updates = [
      { key: FINANCIAL_SETTING_KEYS.ACCOUNTING_LIVE_MODE, value: String(body.accountingLiveMode ?? false) },
      { key: FINANCIAL_SETTING_KEYS.PARTNER_PROGRAM_ENABLED, value: String(body.partnerProgramEnabled ?? false) },
      { key: FINANCIAL_SETTING_KEYS.PAYOUTS_ENABLED, value: String(body.payoutsEnabled ?? false) },
      { key: FINANCIAL_SETTING_KEYS.DEFAULT_PARTNER_HOLDING_DAYS, value: String(body.defaultPartnerHoldingDays ?? 7) },
      { key: FINANCIAL_SETTING_KEYS.DEFAULT_PARTNER_MIN_PAYOUT, value: String(body.defaultPartnerMinPayoutCentavos ?? 15000) },
      { key: FINANCIAL_SETTING_KEYS.AUTO_RECONCILIATION_ENABLED, value: String(body.autoReconciliationEnabled ?? true) },
    ];

    for (const item of updates) {
      await prisma.financialSetting.upsert({
        where: { key: item.key },
        update: { value: item.value, updatedBy: user.id },
        create: { key: item.key, value: item.value, updatedBy: user.id },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Financial configuration saved successfully!",
    });
  } catch (error) {
    console.error("[ADMIN_ACCOUNTING_SETTINGS_PUT_ERROR]", error);
    return NextResponse.json({ error: "Failed to save financial settings" }, { status: 500 });
  }
}
