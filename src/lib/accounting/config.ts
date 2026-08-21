// Relative Path: src/lib/accounting/config.ts
import { FinancialSettingsConfig } from "./types";

export const FINANCIAL_SETTING_KEYS = {
  ACCOUNTING_LIVE_MODE: "ACCOUNTING_LIVE_MODE",
  PARTNER_PROGRAM_ENABLED: "PARTNER_PROGRAM_ENABLED",
  PAYOUTS_ENABLED: "PAYOUTS_ENABLED",
  DEFAULT_PARTNER_HOLDING_DAYS: "DEFAULT_PARTNER_HOLDING_DAYS",
  DEFAULT_PARTNER_MIN_PAYOUT: "DEFAULT_PARTNER_MIN_PAYOUT",
  AUTO_RECONCILIATION_ENABLED: "AUTO_RECONCILIATION_ENABLED",
} as const;

export const DEFAULT_FINANCIAL_CONFIG: FinancialSettingsConfig = {
  accountingLiveMode: false,
  partnerProgramEnabled: false,
  payoutsEnabled: false,
  defaultPartnerHoldingDays: 7,
  defaultPartnerMinPayoutCentavos: 15000, // ₱150.00
  autoReconciliationEnabled: true,
};
