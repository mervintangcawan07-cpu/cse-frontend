// Relative Path: src/lib/accounting/types.ts

export type LedgerEntryType = "DEBIT" | "CREDIT";

export type AccountCategory =
  | "CASH_PAYMONGO"
  | "REVENUE_PREMIUM"
  | "EXPENSE_PAYMENT_FEE"
  | "EXPENSE_REFERRAL"
  | "LIABILITY_REFERRAL_PAYABLE"
  | "EXPENSE_PARTNER"
  | "LIABILITY_PARTNER_PAYABLE"
  | "EXPENSE_TAX"
  | "LIABILITY_TAX_PAYABLE"
  | "EXPENSE_OPERATIONAL"
  | "ADJUSTMENT_SUSPENSE";

export type FinancialTransactionType =
  | "PAYMENT_RECEIVED"
  | "PAYMONGO_FEE"
  | "REFERRAL_COMMISSION"
  | "PARTNER_COMMISSION"
  | "TAX_PROVISION"
  | "DEDUCTION_EXPENSE"
  | "REFUND_REVERSAL"
  | "CHARGEBACK_REVERSAL"
  | "PAYOUT_DISBURSEMENT"
  | "MANUAL_ADJUSTMENT";

export type PartnerType =
  | "FACEBOOK_PAGE"
  | "CONTENT_CREATOR"
  | "HOST"
  | "AFFILIATE"
  | "SCHOOL"
  | "ORGANIZATION"
  | "MARKETING_PARTNER"
  | "EVENT_PARTNER"
  | "OTHER";

export type PartnerStatus = "ACTIVE" | "PENDING" | "SUSPENDED" | "EXPIRED" | "TERMINATED" | "ARCHIVED";

export type PartnerCommissionModel =
  | "PERCENTAGE_OF_GROSS"
  | "PERCENTAGE_OF_CUSTOMER_PAYMENT"
  | "PERCENTAGE_OF_NET_AFTER_CONFIGURED_DEDUCTIONS"
  | "FIXED_PER_PURCHASE"
  | "FIXED_PER_REFERRAL"
  | "CUSTOM_RULE";

export type TaxType = "VAT" | "PERCENTAGE_TAX" | "WITHHOLDING_TAX" | "OTHER_TAX";

export type TaxCalculationBasis =
  | "GROSS_SALE"
  | "CUSTOMER_PAYMENT"
  | "NET_REVENUE"
  | "COMMISSION"
  | "PAYOUT"
  | "OTHER";

export type PayoutMethod = "GCASH" | "BANK_TRANSFER" | "MAYA";

export type PayoutStatus =
  | "REQUESTED"
  | "RESERVED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PROCESSING"
  | "PAID"
  | "REJECTED"
  | "CANCELLED"
  | "FAILED"
  | "REVERSED";

export type TaxStatus = "ACTIVE" | "INACTIVE" | "DRAFT" | "ARCHIVED";

export type DeductionCategory =
  | "ADVERTISING"
  | "HOSTING"
  | "MARKETING"
  | "PLATFORM_COSTS"
  | "PARTNER_EXPENSES"
  | "PROMOTIONAL_COSTS"
  | "ADMINISTRATIVE_COSTS"
  | "OTHER_EXPENSE";

export type AccountingPeriodStatus = "OPEN" | "CLOSED" | "LOCKED";

export type ReconciliationStatus =
  | "MATCHED"
  | "MISMATCHED"
  | "MISSING"
  | "DUPLICATE"
  | "PENDING"
  | "MANUALLY_RESOLVED";

export interface WaterfallSummary {
  grossPremiumSalesCentavos: number;
  grossSalesCount: number;

  discountsCentavos: number;
  discountCount: number;

  customerPaymentsCentavos: number;
  customerPaymentCount: number;

  paymongoFeesCentavos: number;
  paymongoFeeCount: number;

  refundsCentavos: number;
  refundCount: number;

  chargebacksCentavos: number;
  chargebackCount: number;

  referralRewardsCentavos: number;
  referralRewardCount: number;

  partnerCommissionsCentavos: number;
  partnerCommissionCount: number;

  taxProvisionsCentavos: number;
  taxRecordCount: number;

  otherDeductionsCentavos: number;
  otherDeductionCount: number;

  netAccountingResultCentavos: number;

  // Liabilities and Cash balances
  availableBalanceCentavos: number;
  pendingLiabilitiesCentavos: number;
  paidReferralRewardsCentavos: number;
  paidPartnerCommissionsCentavos: number;
  pendingPayoutsCentavos: number;
  unreconciledTransactionsCount: number;

  currency: string;
}

export interface CalculationExplanation {
  itemName: string;
  amountCentavos: number;
  formattedAmount: string;
  formula: string;
  ruleExplanation: string;
  baseAmountCentavos?: number;
  effectiveRate?: number;
  underlyingRecordsCount: number;
  drillDownEndpoint: string;
}

export interface DrillDownItem {
  id: string;
  date: string;
  reference: string;
  description: string;
  customerName?: string;
  customerEmail?: string;
  planType?: string;
  amountCentavos: number;
  status: string;
  meta?: Record<string, any>;
}

export interface FinancialSettingsConfig {
  accountingLiveMode: boolean;
  partnerProgramEnabled: boolean;
  payoutsEnabled: boolean;
  defaultPartnerHoldingDays: number;
  defaultPartnerMinPayoutCentavos: number;
  autoReconciliationEnabled: boolean;
}
