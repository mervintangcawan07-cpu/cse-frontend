-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AccountCategory" AS ENUM ('CASH_PAYMONGO', 'REVENUE_PREMIUM', 'EXPENSE_PAYMENT_FEE', 'EXPENSE_REFERRAL', 'LIABILITY_REFERRAL_PAYABLE', 'EXPENSE_PARTNER', 'LIABILITY_PARTNER_PAYABLE', 'EXPENSE_TAX', 'LIABILITY_TAX_PAYABLE', 'EXPENSE_OPERATIONAL', 'ADJUSTMENT_SUSPENSE');

-- CreateEnum
CREATE TYPE "public"."AccountingPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');

-- CreateEnum
CREATE TYPE "public"."ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."BackupStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'VERIFYING', 'VERIFIED', 'FAILED', 'VERIFICATION_FAILED', 'RESTORE_PENDING', 'RESTORING', 'RESTORED', 'RESTORE_FAILED');

-- CreateEnum
CREATE TYPE "public"."BackupType" AS ENUM ('DAILY', 'MANUAL', 'PRE_RESTORE_EMERGENCY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "public"."BackupVerificationStatus" AS ENUM ('UNVERIFIED', 'PASSED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "public"."ClassmateStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "public"."ClubMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "public"."DeductionCategory" AS ENUM ('ADVERTISING', 'HOSTING', 'MARKETING', 'PLATFORM_COSTS', 'PARTNER_EXPENSES', 'PROMOTIONAL_COSTS', 'ADMINISTRATIVE_COSTS', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "public"."DuelStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'FINISHED', 'WAITING_FOR_ACCEPT', 'DECLINED');

-- CreateEnum
CREATE TYPE "public"."EventRSVPStatus" AS ENUM ('ATTENDING', 'MAYBE', 'DECLINED');

-- CreateEnum
CREATE TYPE "public"."FinancialTransactionType" AS ENUM ('PAYMENT_RECEIVED', 'PAYMONGO_FEE', 'REFERRAL_COMMISSION', 'PARTNER_COMMISSION', 'TAX_PROVISION', 'DEDUCTION_EXPENSE', 'REFUND_REVERSAL', 'CHARGEBACK_REVERSAL', 'PAYOUT_DISBURSEMENT', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "public"."MessageState" AS ENUM ('SENT', 'DELIVERED', 'READ');

-- CreateEnum
CREATE TYPE "public"."PartnerCommissionModel" AS ENUM ('PERCENTAGE_OF_GROSS', 'PERCENTAGE_OF_CUSTOMER_PAYMENT', 'PERCENTAGE_OF_NET_AFTER_CONFIGURED_DEDUCTIONS', 'FIXED_PER_PURCHASE', 'FIXED_PER_REFERRAL', 'CUSTOM_RULE');

-- CreateEnum
CREATE TYPE "public"."PartnerStatus" AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED', 'EXPIRED', 'TERMINATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."PartnerType" AS ENUM ('FACEBOOK_PAGE', 'CONTENT_CREATOR', 'HOST', 'AFFILIATE', 'SCHOOL', 'ORGANIZATION', 'MARKETING_PARTNER', 'EVENT_PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PayoutMethod" AS ENUM ('GCASH', 'BANK_TRANSFER', 'MAYA');

-- CreateEnum
CREATE TYPE "public"."PayoutStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED', 'CANCELLED', 'FAILED', 'RESERVED', 'REVERSED');

-- CreateEnum
CREATE TYPE "public"."ReconciliationStatus" AS ENUM ('MATCHED', 'MISMATCHED', 'MISSING', 'DUPLICATE', 'PENDING', 'MANUALLY_RESOLVED');

-- CreateEnum
CREATE TYPE "public"."ReferralRewardType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "public"."ReferralRiskLevel" AS ENUM ('LOW_RISK', 'REVIEW', 'SUSPICIOUS', 'BLOCKED');

-- CreateEnum
CREATE TYPE "public"."ReferralStatus" AS ENUM ('CLICKED', 'REGISTERED', 'PENDING_PREMIUM', 'QUALIFIED', 'REWARD_PENDING', 'AVAILABLE', 'PAYOUT_REQUESTED', 'PAID', 'REJECTED', 'CANCELLED', 'REFUNDED', 'REVERSED', 'SUSPICIOUS');

-- CreateEnum
CREATE TYPE "public"."RewardLedgerStatus" AS ENUM ('PENDING', 'AVAILABLE', 'PAID', 'REVERSED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."RoomParticipantRole" AS ENUM ('HOST', 'MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "public"."RoomState" AS ENUM ('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."StudyPostTopic" AS ENUM ('QUESTION_HELP', 'EXAM_INTEL', 'MINDSET_VENT', 'STUDY_HACKS');

-- CreateEnum
CREATE TYPE "public"."StudyReactionType" AS ENUM ('GOT_IT', 'SAME_STRUGGLE', 'HIGH_YIELD', 'KEEP_PUSHING');

-- CreateEnum
CREATE TYPE "public"."TaxCalculationBasis" AS ENUM ('GROSS_SALE', 'CUSTOMER_PAYMENT', 'NET_REVENUE', 'COMMISSION', 'PAYOUT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."TaxStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."TaxType" AS ENUM ('VAT', 'PERCENTAGE_TAX', 'WITHHOLDING_TAX', 'OTHER_TAX');

-- CreateEnum
CREATE TYPE "public"."VoucherCodeStatus" AS ENUM ('UNUSED', 'REDEEMED', 'REVOKED');

-- CreateEnum
CREATE TYPE "public"."VoucherStatus" AS ENUM ('ACTIVE', 'FULLY_REDEEMED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "public"."AccountingAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "previousState" TEXT,
    "newState" TEXT,
    "amountCentavos" INTEGER,
    "reason" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AccountingPeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Backup" (
    "id" TEXT NOT NULL,
    "backupType" "public"."BackupType" NOT NULL DEFAULT 'MANUAL',
    "status" "public"."BackupStatus" NOT NULL DEFAULT 'PENDING',
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 's3',
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "databaseVersion" TEXT DEFAULT 'PostgreSQL',
    "schemaVersion" TEXT DEFAULT '1.0.0',
    "verificationStatus" "public"."BackupVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationMessage" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "triggeredBy" TEXT DEFAULT 'SYSTEM',
    "errorMessage" TEXT,
    "expiresAt" TIMESTAMP(3),
    "protected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "restoredAt" TIMESTAMP(3),

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BackupAuditLog" (
    "id" TEXT NOT NULL,
    "backupId" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BackupPayload" (
    "filename" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupPayload_pkey" PRIMARY KEY ("filename")
);

-- CreateTable
CREATE TABLE "public"."Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CSCAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceUrl" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CSCAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CSCDownload" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CSCDownload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CSCExamSchedule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "appOpeningDate" TIMESTAMP(3),
    "appClosingDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "officialLink" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CSCExamSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClassmateRelation" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" "public"."ClassmateStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassmateRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Conversation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailyQuestionAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateString" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userAnswer" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyQuestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DirectMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "state" "public"."MessageState" NOT NULL DEFAULT 'SENT',
    "replyToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DirectMessageParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessageParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DuelMatch" (
    "id" TEXT NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player1Name" TEXT NOT NULL DEFAULT 'Examinee 1',
    "player2Id" TEXT,
    "player2Name" TEXT,
    "status" "public"."DuelStatus" NOT NULL DEFAULT 'WAITING',
    "questions" JSONB NOT NULL,
    "p1Score" INTEGER NOT NULL DEFAULT 0,
    "p2Score" INTEGER NOT NULL DEFAULT 0,
    "p1Current" INTEGER NOT NULL DEFAULT 0,
    "p2Current" INTEGER NOT NULL DEFAULT 0,
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "challengedUserId" TEXT,

    CONSTRAINT "DuelMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExamCategoryResult" (
    "id" TEXT NOT NULL,
    "examResultId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "incorrect" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "timeSpentSec" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamCategoryResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExamDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'All',
    "answersJson" TEXT NOT NULL,
    "questionsJson" TEXT NOT NULL,
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "timeLeft" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExamResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "totalItems" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "incorrect" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detailsJson" TEXT,
    "examType" TEXT NOT NULL DEFAULT 'FULL_MOCK',
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "timeSpentSec" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinancialAdjustment" (
    "id" TEXT NOT NULL,
    "adjustmentNumber" TEXT NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "direction" "public"."LedgerEntryType" NOT NULL,
    "category" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinancialDeduction" (
    "id" TEXT NOT NULL,
    "category" "public"."DeductionCategory" NOT NULL DEFAULT 'OTHER_EXPENSE',
    "description" TEXT NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "periodId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinancialLedgerEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "transactionId" TEXT,
    "transactionType" "public"."FinancialTransactionType" NOT NULL,
    "accountCategory" "public"."AccountCategory" NOT NULL,
    "entryType" "public"."LedgerEntryType" NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "sourceEntity" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinancialSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."Flashcard" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'General',
    "front" TEXT,
    "back" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "answer" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "explanation" TEXT,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "question" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Handbook" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pages" TEXT NOT NULL,
    "lastUpdated" TEXT NOT NULL DEFAULT 'Official Ref',
    "fileData" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT 'document.pdf',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Handbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InstitutionalVoucherBatch" (
    "id" TEXT NOT NULL,
    "batchRef" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "planType" TEXT NOT NULL DEFAULT 'ANNUAL',
    "durationDays" INTEGER NOT NULL DEFAULT 365,
    "totalCodes" INTEGER NOT NULL,
    "redeemedCount" INTEGER NOT NULL DEFAULT 0,
    "pricePerCodeCentavos" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."VoucherStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionalVoucherBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InstitutionalVoucherCode" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "public"."VoucherCodeStatus" NOT NULL DEFAULT 'UNUSED',
    "redeemedBy" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "accessUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionalVoucherCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LoginHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Partner" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."PartnerType" NOT NULL DEFAULT 'FACEBOOK_PAGE',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "status" "public"."PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "commissionModel" "public"."PartnerCommissionModel" NOT NULL DEFAULT 'PERCENTAGE_OF_CUSTOMER_PAYMENT',
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "fixedCommissionCentavos" INTEGER DEFAULT 0,
    "holdingPeriodDays" INTEGER NOT NULL DEFAULT 7,
    "minPayoutCentavos" INTEGER NOT NULL DEFAULT 15000,
    "agreementStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agreementEnd" TIMESTAMP(3),
    "payoutMethod" "public"."PayoutMethod" NOT NULL DEFAULT 'GCASH',
    "accountNumberEncrypted" TEXT,
    "accountName" TEXT,
    "bankName" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "avatarUrl" TEXT,
    "badgeText" TEXT DEFAULT 'Official Partner',
    "description" TEXT,
    "discountPercent" DOUBLE PRECISION DEFAULT 0.0,
    "facebookUrl" TEXT,
    "passwordHash" TEXT,
    "slug" TEXT,
    "tagline" TEXT,
    "websiteUrl" TEXT,
    "partnerId" TEXT,
    "setupToken" TEXT,
    "setupTokenExpires" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpires" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN DEFAULT false,
    "tempPasswordHash" TEXT,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PartnerApplication" (
    "id" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "type" "public"."PartnerType" NOT NULL DEFAULT 'CONTENT_CREATOR',
    "socialUrl" TEXT NOT NULL,
    "audienceSize" TEXT,
    "proposedSlug" TEXT,
    "pitchReason" TEXT,
    "status" "public"."ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdPartnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PartnerAttribution" (
    "id" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignSource" TEXT,

    CONSTRAINT "PartnerAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PartnerCommission" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "purchaseAmountCentavos" INTEGER NOT NULL,
    "commissionModel" "public"."PartnerCommissionModel" NOT NULL,
    "effectiveRate" DOUBLE PRECISION NOT NULL,
    "commissionAmountCentavos" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "status" "public"."RewardLedgerStatus" NOT NULL DEFAULT 'PENDING',
    "holdingUntil" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "campaignSource" TEXT,

    CONSTRAINT "PartnerCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PartnerPayout" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "method" "public"."PayoutMethod" NOT NULL DEFAULT 'GCASH',
    "accountNumberEncrypted" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT,
    "status" "public"."PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "adminNotes" TEXT,
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "transactionRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PartnerPayoutProfile" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "method" "public"."PayoutMethod" NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "accountNumberEncrypted" TEXT NOT NULL,
    "bankName" TEXT,
    "accountType" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPayoutProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PartnerRateHistory" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "commissionModel" "public"."PartnerCommissionModel" NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "fixedCommissionCentavos" INTEGER,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "reason" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerRateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PartnerSequence" (
    "id" TEXT NOT NULL DEFAULT 'PARTNER_ID_SEQ',
    "currentValue" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentVal" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "PartnerSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PricingPlan" (
    "id" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Question" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" TEXT[],
    "answerIndex" INTEGER NOT NULL,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imageUrl" TEXT,
    "optionA" TEXT,
    "optionB" TEXT,
    "optionC" TEXT,
    "optionD" TEXT,
    "subtopic" TEXT NOT NULL DEFAULT 'General',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "commonTrap" TEXT,
    "difficulty" TEXT DEFAULT 'MEDIUM',
    "eliminationStrategy" TEXT,
    "examTip" TEXT,
    "skillTested" TEXT,
    "stepByStep" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "whyA" TEXT,
    "whyB" TEXT,
    "whyC" TEXT,
    "whyD" TEXT,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuestionFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReadingMaterial" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReconciliationRecord" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "matchedTransactionId" TEXT,
    "status" "public"."ReconciliationStatus" NOT NULL DEFAULT 'MATCHED',
    "discrepancyCentavos" INTEGER NOT NULL DEFAULT 0,
    "discrepancyNotes" TEXT,
    "reconciledBy" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Referral" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "status" "public"."ReferralStatus" NOT NULL DEFAULT 'PENDING_PREMIUM',
    "qualifyingPaymentId" TEXT,
    "qualifyingAmount" INTEGER,
    "effectiveRate" DOUBLE PRECISION,
    "rewardAmount" INTEGER,
    "holdingUntil" TIMESTAMP(3),
    "riskLevel" "public"."ReferralRiskLevel" NOT NULL DEFAULT 'LOW_RISK',
    "riskNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualifiedAt" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReferralAttribution" (
    "id" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReferralAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "previousState" TEXT,
    "newState" TEXT,
    "amountCentavos" INTEGER,
    "reason" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReferralCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReferralPayout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "method" "public"."PayoutMethod" NOT NULL DEFAULT 'GCASH',
    "accountNumberEncrypted" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT,
    "status" "public"."PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "adminNotes" TEXT,
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "transactionRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReferralProgramSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralProgramSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."ReferralReward" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "purchaseAmountCentavos" INTEGER NOT NULL,
    "rewardType" "public"."ReferralRewardType" NOT NULL DEFAULT 'PERCENTAGE',
    "effectiveRate" DOUBLE PRECISION NOT NULL,
    "rewardAmountCentavos" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "status" "public"."RewardLedgerStatus" NOT NULL DEFAULT 'PENDING',
    "holdingUntil" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudyClub" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'General Study',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyClub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudyClubMember" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."ClubMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyClubMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudyEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "topic" TEXT NOT NULL DEFAULT 'General Review',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "hostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudyEventRSVP" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."EventRSVPStatus" NOT NULL DEFAULT 'ATTENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyEventRSVP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudyNote" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT[],
    "tips" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "videoUrl" TEXT,

    CONSTRAINT "StudyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudyPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "topic" "public"."StudyPostTopic" NOT NULL DEFAULT 'QUESTION_HELP',
    "title" TEXT,
    "content" TEXT NOT NULL,
    "hasSpoiler" BOOLEAN NOT NULL DEFAULT false,
    "spoilerContent" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StudyPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudyPostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StudyPostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudyPostReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reactionType" "public"."StudyReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyPostReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudyRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "topic" TEXT NOT NULL DEFAULT 'General Review',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "maxParticipants" INTEGER NOT NULL DEFAULT 10,
    "inviteCode" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "state" "public"."RoomState" NOT NULL DEFAULT 'ACTIVE',
    "hostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "allowMemberChat" BOOLEAN NOT NULL DEFAULT true,
    "allowMemberScreenShare" BOOLEAN NOT NULL DEFAULT true,
    "allowMemberWhiteboard" BOOLEAN NOT NULL DEFAULT true,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "activeQuestionId" TEXT,
    "activeTopicImage" TEXT,
    "activeTopicMeta" JSONB,
    "activeTopicType" TEXT,

    CONSTRAINT "StudyRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudyRoomMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyRoomMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudyRoomParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."RoomParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canDraw" BOOLEAN NOT NULL DEFAULT true,
    "canShare" BOOLEAN NOT NULL DEFAULT true,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StudyRoomParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudyTogetherProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatar" TEXT,
    "ageRange" TEXT,
    "gender" TEXT,
    "bio" VARCHAR(160),
    "studyGoal" TEXT,
    "studyInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceLevel" TEXT,
    "studyPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availability" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" TEXT DEFAULT 'English',
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "showActivity" BOOLEAN NOT NULL DEFAULT true,
    "showAgeRange" BOOLEAN NOT NULL DEFAULT false,
    "showAvailability" BOOLEAN NOT NULL DEFAULT true,
    "showBio" BOOLEAN NOT NULL DEFAULT true,
    "showGender" BOOLEAN NOT NULL DEFAULT false,
    "showInterests" BOOLEAN NOT NULL DEFAULT true,
    "showPreferences" BOOLEAN NOT NULL DEFAULT true,
    "showStudyGoal" BOOLEAN NOT NULL DEFAULT true,
    "customStatusEmoji" VARCHAR(10),
    "customStatusText" VARCHAR(60),
    "presenceStatus" TEXT DEFAULT 'ONLINE',

    CONSTRAINT "StudyTogetherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncLog" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "isError" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncStatus" (
    "id" TEXT NOT NULL DEFAULT 'csc_sync_status',
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextSyncAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."TaxConfiguration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxType" "public"."TaxType" NOT NULL DEFAULT 'OTHER_TAX',
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "fixedAmountCentavos" INTEGER DEFAULT 0,
    "calculationBasis" "public"."TaxCalculationBasis" NOT NULL DEFAULT 'CUSTOMER_PAYMENT',
    "status" "public"."TaxStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirationDate" TIMESTAMP(3),
    "applicableTransactionType" TEXT DEFAULT 'ALL',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaxRecord" (
    "id" TEXT NOT NULL,
    "taxConfigId" TEXT NOT NULL,
    "transactionId" TEXT,
    "partnerPayoutId" TEXT,
    "referralPayoutId" TEXT,
    "taxableAmountCentavos" INTEGER NOT NULL,
    "appliedRate" DOUBLE PRECISION NOT NULL,
    "taxAmountCentavos" INTEGER NOT NULL,
    "calculationBasis" "public"."TaxCalculationBasis" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROVISIONED',
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkoutSessionId" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "amount" INTEGER NOT NULL,
    "planType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "discountAmountCentavos" INTEGER DEFAULT 0,
    "feeAmountCentavos" INTEGER DEFAULT 0,
    "grossAmountCentavos" INTEGER,
    "netSettlementCentavos" INTEGER,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "paidUntil" TIMESTAMP(3),
    "planType" TEXT,
    "emailVerificationExpires" TIMESTAMP(3),
    "emailVerificationToken" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordResetExpires" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "activeSessionId" TEXT,
    "lastActiveAt" TIMESTAMP(3),
    "banReason" TEXT,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserMistake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userAnswer" INTEGER,
    "incorrectCount" INTEGER NOT NULL DEFAULT 1,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isMastered" BOOLEAN NOT NULL DEFAULT false,
    "masteredAt" TIMESTAMP(3),

    CONSTRAINT "UserMistake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserStreak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingAuditLog_action_idx" ON "public"."AccountingAuditLog"("action" ASC);

-- CreateIndex
CREATE INDEX "AccountingAuditLog_actorId_idx" ON "public"."AccountingAuditLog"("actorId" ASC);

-- CreateIndex
CREATE INDEX "AccountingAuditLog_createdAt_idx" ON "public"."AccountingAuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AccountingAuditLog_targetType_targetId_idx" ON "public"."AccountingAuditLog"("targetType" ASC, "targetId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_name_key" ON "public"."AccountingPeriod"("name" ASC);

-- CreateIndex
CREATE INDEX "AccountingPeriod_startDate_endDate_idx" ON "public"."AccountingPeriod"("startDate" ASC, "endDate" ASC);

-- CreateIndex
CREATE INDEX "AccountingPeriod_status_idx" ON "public"."AccountingPeriod"("status" ASC);

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "public"."ActivityLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "public"."ActivityLog"("userId" ASC);

-- CreateIndex
CREATE INDEX "Backup_backupType_idx" ON "public"."Backup"("backupType" ASC);

-- CreateIndex
CREATE INDEX "Backup_createdAt_idx" ON "public"."Backup"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Backup_status_idx" ON "public"."Backup"("status" ASC);

-- CreateIndex
CREATE INDEX "Backup_verificationStatus_idx" ON "public"."Backup"("verificationStatus" ASC);

-- CreateIndex
CREATE INDEX "BackupAuditLog_action_idx" ON "public"."BackupAuditLog"("action" ASC);

-- CreateIndex
CREATE INDEX "BackupAuditLog_backupId_idx" ON "public"."BackupAuditLog"("backupId" ASC);

-- CreateIndex
CREATE INDEX "BackupAuditLog_createdAt_idx" ON "public"."BackupAuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Bookmark_userId_idx" ON "public"."Bookmark"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_targetType_targetId_key" ON "public"."Bookmark"("userId" ASC, "targetType" ASC, "targetId" ASC);

-- CreateIndex
CREATE INDEX "CSCAnnouncement_category_idx" ON "public"."CSCAnnouncement"("category" ASC);

-- CreateIndex
CREATE INDEX "CSCAnnouncement_publishedAt_idx" ON "public"."CSCAnnouncement"("publishedAt" DESC);

-- CreateIndex
CREATE INDEX "CSCDownload_category_idx" ON "public"."CSCDownload"("category" ASC);

-- CreateIndex
CREATE INDEX "CSCExamSchedule_examDate_idx" ON "public"."CSCExamSchedule"("examDate" ASC);

-- CreateIndex
CREATE INDEX "CSCExamSchedule_status_idx" ON "public"."CSCExamSchedule"("status" ASC);

-- CreateIndex
CREATE INDEX "ClassmateRelation_receiverId_status_idx" ON "public"."ClassmateRelation"("receiverId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ClassmateRelation_senderId_receiverId_key" ON "public"."ClassmateRelation"("senderId" ASC, "receiverId" ASC);

-- CreateIndex
CREATE INDEX "ClassmateRelation_senderId_status_idx" ON "public"."ClassmateRelation"("senderId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "ClassmateRelation_status_idx" ON "public"."ClassmateRelation"("status" ASC);

-- CreateIndex
CREATE INDEX "Conversation_updatedAt_idx" ON "public"."Conversation"("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "DailyQuestionAttempt_dateString_idx" ON "public"."DailyQuestionAttempt"("dateString" ASC);

-- CreateIndex
CREATE INDEX "DailyQuestionAttempt_questionId_idx" ON "public"."DailyQuestionAttempt"("questionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DailyQuestionAttempt_userId_dateString_key" ON "public"."DailyQuestionAttempt"("userId" ASC, "dateString" ASC);

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "public"."DirectMessage"("conversationId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_state_idx" ON "public"."DirectMessage"("conversationId" ASC, "state" ASC);

-- CreateIndex
CREATE INDEX "DirectMessage_createdAt_idx" ON "public"."DirectMessage"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "DirectMessage_replyToId_idx" ON "public"."DirectMessage"("replyToId" ASC);

-- CreateIndex
CREATE INDEX "DirectMessage_senderId_idx" ON "public"."DirectMessage"("senderId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DirectMessageParticipant_conversationId_userId_key" ON "public"."DirectMessageParticipant"("conversationId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "DirectMessageParticipant_userId_idx" ON "public"."DirectMessageParticipant"("userId" ASC);

-- CreateIndex
CREATE INDEX "DuelMatch_challengedUserId_idx" ON "public"."DuelMatch"("challengedUserId" ASC);

-- CreateIndex
CREATE INDEX "DuelMatch_player1Id_idx" ON "public"."DuelMatch"("player1Id" ASC);

-- CreateIndex
CREATE INDEX "DuelMatch_status_createdAt_idx" ON "public"."DuelMatch"("status" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ExamCategoryResult_category_idx" ON "public"."ExamCategoryResult"("category" ASC);

-- CreateIndex
CREATE INDEX "ExamCategoryResult_examResultId_category_idx" ON "public"."ExamCategoryResult"("examResultId" ASC, "category" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExamDraft_userId_key" ON "public"."ExamDraft"("userId" ASC);

-- CreateIndex
CREATE INDEX "ExamResult_createdAt_idx" ON "public"."ExamResult"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "ExamResult_examType_idx" ON "public"."ExamResult"("examType" ASC);

-- CreateIndex
CREATE INDEX "ExamResult_userId_createdAt_idx" ON "public"."ExamResult"("userId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "public"."FeatureFlag"("key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAdjustment_adjustmentNumber_key" ON "public"."FinancialAdjustment"("adjustmentNumber" ASC);

-- CreateIndex
CREATE INDEX "FinancialAdjustment_createdAt_idx" ON "public"."FinancialAdjustment"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "FinancialAdjustment_status_idx" ON "public"."FinancialAdjustment"("status" ASC);

-- CreateIndex
CREATE INDEX "FinancialDeduction_category_idx" ON "public"."FinancialDeduction"("category" ASC);

-- CreateIndex
CREATE INDEX "FinancialDeduction_date_idx" ON "public"."FinancialDeduction"("date" DESC);

-- CreateIndex
CREATE INDEX "FinancialDeduction_status_idx" ON "public"."FinancialDeduction"("status" ASC);

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_accountCategory_idx" ON "public"."FinancialLedgerEntry"("accountCategory" ASC);

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_createdAt_idx" ON "public"."FinancialLedgerEntry"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_effectiveDate_idx" ON "public"."FinancialLedgerEntry"("effectiveDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_entryNumber_key" ON "public"."FinancialLedgerEntry"("entryNumber" ASC);

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_periodId_idx" ON "public"."FinancialLedgerEntry"("periodId" ASC);

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_sourceEntity_sourceId_idx" ON "public"."FinancialLedgerEntry"("sourceEntity" ASC, "sourceId" ASC);

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_transactionType_idx" ON "public"."FinancialLedgerEntry"("transactionType" ASC);

-- CreateIndex
CREATE INDEX "Flashcard_category_topic_idx" ON "public"."Flashcard"("category" ASC, "topic" ASC);

-- CreateIndex
CREATE INDEX "Flashcard_deletedAt_idx" ON "public"."Flashcard"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "Handbook_category_idx" ON "public"."Handbook"("category" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionalVoucherBatch_batchRef_key" ON "public"."InstitutionalVoucherBatch"("batchRef" ASC);

-- CreateIndex
CREATE INDEX "InstitutionalVoucherBatch_createdAt_idx" ON "public"."InstitutionalVoucherBatch"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "InstitutionalVoucherBatch_institutionName_idx" ON "public"."InstitutionalVoucherBatch"("institutionName" ASC);

-- CreateIndex
CREATE INDEX "InstitutionalVoucherBatch_status_idx" ON "public"."InstitutionalVoucherBatch"("status" ASC);

-- CreateIndex
CREATE INDEX "InstitutionalVoucherCode_batchId_status_idx" ON "public"."InstitutionalVoucherCode"("batchId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "InstitutionalVoucherCode_code_idx" ON "public"."InstitutionalVoucherCode"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionalVoucherCode_code_key" ON "public"."InstitutionalVoucherCode"("code" ASC);

-- CreateIndex
CREATE INDEX "InstitutionalVoucherCode_redeemedBy_idx" ON "public"."InstitutionalVoucherCode"("redeemedBy" ASC);

-- CreateIndex
CREATE INDEX "LoginHistory_createdAt_idx" ON "public"."LoginHistory"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "LoginHistory_email_idx" ON "public"."LoginHistory"("email" ASC);

-- CreateIndex
CREATE INDEX "LoginHistory_status_idx" ON "public"."LoginHistory"("status" ASC);

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "public"."Notification"("isRead" ASC);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "public"."Notification"("userId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "public"."Notification"("userId" ASC, "isRead" ASC);

-- CreateIndex
CREATE INDEX "Partner_code_idx" ON "public"."Partner"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_code_key" ON "public"."Partner"("code" ASC);

-- CreateIndex
CREATE INDEX "Partner_createdAt_idx" ON "public"."Partner"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_partnerId_key" ON "public"."Partner"("partnerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_resetToken_key" ON "public"."Partner"("resetToken" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_setupToken_key" ON "public"."Partner"("setupToken" ASC);

-- CreateIndex
CREATE INDEX "Partner_slug_idx" ON "public"."Partner"("slug" ASC);

-- CreateIndex
CREATE INDEX "Partner_status_idx" ON "public"."Partner"("status" ASC);

-- CreateIndex
CREATE INDEX "Partner_type_idx" ON "public"."Partner"("type" ASC);

-- CreateIndex
CREATE INDEX "PartnerApplication_createdAt_idx" ON "public"."PartnerApplication"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "PartnerApplication_email_idx" ON "public"."PartnerApplication"("email" ASC);

-- CreateIndex
CREATE INDEX "PartnerApplication_status_idx" ON "public"."PartnerApplication"("status" ASC);

-- CreateIndex
CREATE INDEX "PartnerAttribution_campaignSource_idx" ON "public"."PartnerAttribution"("campaignSource" ASC);

-- CreateIndex
CREATE INDEX "PartnerAttribution_expiresAt_idx" ON "public"."PartnerAttribution"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "PartnerAttribution_partnerId_idx" ON "public"."PartnerAttribution"("partnerId" ASC);

-- CreateIndex
CREATE INDEX "PartnerAttribution_referredUserId_idx" ON "public"."PartnerAttribution"("referredUserId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAttribution_referredUserId_key" ON "public"."PartnerAttribution"("referredUserId" ASC);

-- CreateIndex
CREATE INDEX "PartnerCommission_campaignSource_idx" ON "public"."PartnerCommission"("campaignSource" ASC);

-- CreateIndex
CREATE INDEX "PartnerCommission_createdAt_idx" ON "public"."PartnerCommission"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "PartnerCommission_holdingUntil_idx" ON "public"."PartnerCommission"("holdingUntil" ASC);

-- CreateIndex
CREATE INDEX "PartnerCommission_partnerId_status_idx" ON "public"."PartnerCommission"("partnerId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "PartnerCommission_status_idx" ON "public"."PartnerCommission"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCommission_transactionId_key" ON "public"."PartnerCommission"("transactionId" ASC);

-- CreateIndex
CREATE INDEX "PartnerPayout_createdAt_idx" ON "public"."PartnerPayout"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "PartnerPayout_partnerId_status_idx" ON "public"."PartnerPayout"("partnerId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "PartnerPayout_status_idx" ON "public"."PartnerPayout"("status" ASC);

-- CreateIndex
CREATE INDEX "PartnerPayoutProfile_partnerId_idx" ON "public"."PartnerPayoutProfile"("partnerId" ASC);

-- CreateIndex
CREATE INDEX "PartnerRateHistory_effectiveDate_idx" ON "public"."PartnerRateHistory"("effectiveDate" ASC);

-- CreateIndex
CREATE INDEX "PartnerRateHistory_partnerId_idx" ON "public"."PartnerRateHistory"("partnerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PricingPlan_planType_key" ON "public"."PricingPlan"("planType" ASC);

-- CreateIndex
CREATE INDEX "Question_category_subtopic_idx" ON "public"."Question"("category" ASC, "subtopic" ASC);

-- CreateIndex
CREATE INDEX "Question_deletedAt_idx" ON "public"."Question"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "Question_difficulty_idx" ON "public"."Question"("difficulty" ASC);

-- CreateIndex
CREATE INDEX "Question_subtopic_idx" ON "public"."Question"("subtopic" ASC);

-- CreateIndex
CREATE INDEX "QuestionFlag_questionId_idx" ON "public"."QuestionFlag"("questionId" ASC);

-- CreateIndex
CREATE INDEX "QuestionFlag_status_idx" ON "public"."QuestionFlag"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionFlag_userId_questionId_key" ON "public"."QuestionFlag"("userId" ASC, "questionId" ASC);

-- CreateIndex
CREATE INDEX "ReadingMaterial_category_idx" ON "public"."ReadingMaterial"("category" ASC);

-- CreateIndex
CREATE INDEX "ReconciliationRecord_createdAt_idx" ON "public"."ReconciliationRecord"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReconciliationRecord_sourceType_sourceId_idx" ON "public"."ReconciliationRecord"("sourceType" ASC, "sourceId" ASC);

-- CreateIndex
CREATE INDEX "ReconciliationRecord_status_idx" ON "public"."ReconciliationRecord"("status" ASC);

-- CreateIndex
CREATE INDEX "Referral_createdAt_idx" ON "public"."Referral"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Referral_inviterId_status_idx" ON "public"."Referral"("inviterId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Referral_qualifyingPaymentId_key" ON "public"."Referral"("qualifyingPaymentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "public"."Referral"("referredUserId" ASC);

-- CreateIndex
CREATE INDEX "Referral_riskLevel_idx" ON "public"."Referral"("riskLevel" ASC);

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "public"."Referral"("status" ASC);

-- CreateIndex
CREATE INDEX "ReferralAttribution_expiresAt_idx" ON "public"."ReferralAttribution"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "ReferralAttribution_inviterId_idx" ON "public"."ReferralAttribution"("inviterId" ASC);

-- CreateIndex
CREATE INDEX "ReferralAttribution_referralCodeId_idx" ON "public"."ReferralAttribution"("referralCodeId" ASC);

-- CreateIndex
CREATE INDEX "ReferralAttribution_referredUserId_idx" ON "public"."ReferralAttribution"("referredUserId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralAttribution_referredUserId_key" ON "public"."ReferralAttribution"("referredUserId" ASC);

-- CreateIndex
CREATE INDEX "ReferralAuditLog_action_idx" ON "public"."ReferralAuditLog"("action" ASC);

-- CreateIndex
CREATE INDEX "ReferralAuditLog_actorId_idx" ON "public"."ReferralAuditLog"("actorId" ASC);

-- CreateIndex
CREATE INDEX "ReferralAuditLog_createdAt_idx" ON "public"."ReferralAuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReferralAuditLog_targetType_targetId_idx" ON "public"."ReferralAuditLog"("targetType" ASC, "targetId" ASC);

-- CreateIndex
CREATE INDEX "ReferralCode_code_idx" ON "public"."ReferralCode"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "public"."ReferralCode"("code" ASC);

-- CreateIndex
CREATE INDEX "ReferralCode_userId_idx" ON "public"."ReferralCode"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_userId_key" ON "public"."ReferralCode"("userId" ASC);

-- CreateIndex
CREATE INDEX "ReferralPayout_createdAt_idx" ON "public"."ReferralPayout"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReferralPayout_status_idx" ON "public"."ReferralPayout"("status" ASC);

-- CreateIndex
CREATE INDEX "ReferralPayout_userId_status_idx" ON "public"."ReferralPayout"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "ReferralReward_createdAt_idx" ON "public"."ReferralReward"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReferralReward_holdingUntil_idx" ON "public"."ReferralReward"("holdingUntil" ASC);

-- CreateIndex
CREATE INDEX "ReferralReward_inviterId_status_idx" ON "public"."ReferralReward"("inviterId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_referralId_key" ON "public"."ReferralReward"("referralId" ASC);

-- CreateIndex
CREATE INDEX "ReferralReward_status_idx" ON "public"."ReferralReward"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_transactionId_key" ON "public"."ReferralReward"("transactionId" ASC);

-- CreateIndex
CREATE INDEX "StudyClub_category_idx" ON "public"."StudyClub"("category" ASC);

-- CreateIndex
CREATE INDEX "StudyClub_isPublic_idx" ON "public"."StudyClub"("isPublic" ASC);

-- CreateIndex
CREATE INDEX "StudyClub_ownerId_idx" ON "public"."StudyClub"("ownerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StudyClubMember_clubId_userId_key" ON "public"."StudyClubMember"("clubId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "StudyClubMember_userId_idx" ON "public"."StudyClubMember"("userId" ASC);

-- CreateIndex
CREATE INDEX "StudyEvent_hostId_idx" ON "public"."StudyEvent"("hostId" ASC);

-- CreateIndex
CREATE INDEX "StudyEvent_isPublic_idx" ON "public"."StudyEvent"("isPublic" ASC);

-- CreateIndex
CREATE INDEX "StudyEvent_scheduledAt_idx" ON "public"."StudyEvent"("scheduledAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StudyEventRSVP_eventId_userId_key" ON "public"."StudyEventRSVP"("eventId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "StudyEventRSVP_userId_idx" ON "public"."StudyEventRSVP"("userId" ASC);

-- CreateIndex
CREATE INDEX "StudyNote_category_idx" ON "public"."StudyNote"("category" ASC);

-- CreateIndex
CREATE INDEX "StudyPost_authorId_idx" ON "public"."StudyPost"("authorId" ASC);

-- CreateIndex
CREATE INDEX "StudyPost_createdAt_idx" ON "public"."StudyPost"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "StudyPost_deletedAt_idx" ON "public"."StudyPost"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "StudyPost_isPinned_idx" ON "public"."StudyPost"("isPinned" ASC);

-- CreateIndex
CREATE INDEX "StudyPost_topic_idx" ON "public"."StudyPost"("topic" ASC);

-- CreateIndex
CREATE INDEX "StudyPostComment_authorId_idx" ON "public"."StudyPostComment"("authorId" ASC);

-- CreateIndex
CREATE INDEX "StudyPostComment_deletedAt_idx" ON "public"."StudyPostComment"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "StudyPostComment_postId_createdAt_idx" ON "public"."StudyPostComment"("postId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "StudyPostReaction_postId_idx" ON "public"."StudyPostReaction"("postId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StudyPostReaction_postId_userId_reactionType_key" ON "public"."StudyPostReaction"("postId" ASC, "userId" ASC, "reactionType" ASC);

-- CreateIndex
CREATE INDEX "StudyPostReaction_userId_idx" ON "public"."StudyPostReaction"("userId" ASC);

-- CreateIndex
CREATE INDEX "StudyRoom_activeQuestionId_idx" ON "public"."StudyRoom"("activeQuestionId" ASC);

-- CreateIndex
CREATE INDEX "StudyRoom_hostId_idx" ON "public"."StudyRoom"("hostId" ASC);

-- CreateIndex
CREATE INDEX "StudyRoom_inviteCode_idx" ON "public"."StudyRoom"("inviteCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StudyRoom_inviteCode_key" ON "public"."StudyRoom"("inviteCode" ASC);

-- CreateIndex
CREATE INDEX "StudyRoom_isPublic_idx" ON "public"."StudyRoom"("isPublic" ASC);

-- CreateIndex
CREATE INDEX "StudyRoom_state_idx" ON "public"."StudyRoom"("state" ASC);

-- CreateIndex
CREATE INDEX "StudyRoomMessage_createdAt_idx" ON "public"."StudyRoomMessage"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "StudyRoomMessage_roomId_createdAt_idx" ON "public"."StudyRoomMessage"("roomId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "StudyRoomMessage_senderId_idx" ON "public"."StudyRoomMessage"("senderId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StudyRoomParticipant_roomId_userId_key" ON "public"."StudyRoomParticipant"("roomId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "StudyRoomParticipant_userId_idx" ON "public"."StudyRoomParticipant"("userId" ASC);

-- CreateIndex
CREATE INDEX "StudyTogetherProfile_profileCompleted_idx" ON "public"."StudyTogetherProfile"("profileCompleted" ASC);

-- CreateIndex
CREATE INDEX "StudyTogetherProfile_userId_idx" ON "public"."StudyTogetherProfile"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StudyTogetherProfile_userId_key" ON "public"."StudyTogetherProfile"("userId" ASC);

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "public"."SupportTicket"("status" ASC);

-- CreateIndex
CREATE INDEX "SupportTicket_userEmail_idx" ON "public"."SupportTicket"("userEmail" ASC);

-- CreateIndex
CREATE INDEX "SyncLog_createdAt_idx" ON "public"."SyncLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "SystemSetting_deletedAt_idx" ON "public"."SystemSetting"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "TaxConfiguration_effectiveDate_idx" ON "public"."TaxConfiguration"("effectiveDate" ASC);

-- CreateIndex
CREATE INDEX "TaxConfiguration_status_idx" ON "public"."TaxConfiguration"("status" ASC);

-- CreateIndex
CREATE INDEX "TaxConfiguration_taxType_idx" ON "public"."TaxConfiguration"("taxType" ASC);

-- CreateIndex
CREATE INDEX "TaxRecord_effectiveDate_idx" ON "public"."TaxRecord"("effectiveDate" DESC);

-- CreateIndex
CREATE INDEX "TaxRecord_taxConfigId_idx" ON "public"."TaxRecord"("taxConfigId" ASC);

-- CreateIndex
CREATE INDEX "TaxRecord_transactionId_idx" ON "public"."TaxRecord"("transactionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_checkoutSessionId_key" ON "public"."Transaction"("checkoutSessionId" ASC);

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "public"."Transaction"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "public"."Transaction"("status" ASC);

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "public"."Transaction"("userId" ASC);

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "public"."User"("deletedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerificationToken_key" ON "public"."User"("emailVerificationToken" ASC);

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "public"."User"("passwordResetToken" ASC);

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "public"."UserBadge"("userId" ASC, "badgeId" ASC);

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "public"."UserBadge"("userId" ASC);

-- CreateIndex
CREATE INDEX "UserMistake_questionId_idx" ON "public"."UserMistake"("questionId" ASC);

-- CreateIndex
CREATE INDEX "UserMistake_userId_isMastered_idx" ON "public"."UserMistake"("userId" ASC, "isMastered" ASC);

-- CreateIndex
CREATE INDEX "UserMistake_userId_lastAttemptAt_idx" ON "public"."UserMistake"("userId" ASC, "lastAttemptAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UserMistake_userId_questionId_key" ON "public"."UserMistake"("userId" ASC, "questionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserStreak_userId_key" ON "public"."UserStreak"("userId" ASC);

-- AddForeignKey
ALTER TABLE "public"."BackupAuditLog" ADD CONSTRAINT "BackupAuditLog_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "public"."Backup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassmateRelation" ADD CONSTRAINT "ClassmateRelation_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassmateRelation" ADD CONSTRAINT "ClassmateRelation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyQuestionAttempt" ADD CONSTRAINT "DailyQuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyQuestionAttempt" ADD CONSTRAINT "DailyQuestionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DirectMessage" ADD CONSTRAINT "DirectMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "public"."DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DirectMessageParticipant" ADD CONSTRAINT "DirectMessageParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DirectMessageParticipant" ADD CONSTRAINT "DirectMessageParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamCategoryResult" ADD CONSTRAINT "ExamCategoryResult_examResultId_fkey" FOREIGN KEY ("examResultId") REFERENCES "public"."ExamResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamDraft" ADD CONSTRAINT "ExamDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamResult" ADD CONSTRAINT "ExamResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinancialDeduction" ADD CONSTRAINT "FinancialDeduction_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "public"."AccountingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "public"."AccountingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InstitutionalVoucherCode" ADD CONSTRAINT "InstitutionalVoucherCode_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."InstitutionalVoucherBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerAttribution" ADD CONSTRAINT "PartnerAttribution_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerCommission" ADD CONSTRAINT "PartnerCommission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerCommission" ADD CONSTRAINT "PartnerCommission_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerPayout" ADD CONSTRAINT "PartnerPayout_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerPayoutProfile" ADD CONSTRAINT "PartnerPayoutProfile_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerRateHistory" ADD CONSTRAINT "PartnerRateHistory_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestionFlag" ADD CONSTRAINT "QuestionFlag_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestionFlag" ADD CONSTRAINT "QuestionFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Referral" ADD CONSTRAINT "Referral_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Referral" ADD CONSTRAINT "Referral_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "public"."ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "public"."ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralCode" ADD CONSTRAINT "ReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralPayout" ADD CONSTRAINT "ReferralPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralReward" ADD CONSTRAINT "ReferralReward_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralReward" ADD CONSTRAINT "ReferralReward_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "public"."Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralReward" ADD CONSTRAINT "ReferralReward_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralReward" ADD CONSTRAINT "ReferralReward_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyClub" ADD CONSTRAINT "StudyClub_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyClubMember" ADD CONSTRAINT "StudyClubMember_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."StudyClub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyClubMember" ADD CONSTRAINT "StudyClubMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyEvent" ADD CONSTRAINT "StudyEvent_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyEventRSVP" ADD CONSTRAINT "StudyEventRSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."StudyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyEventRSVP" ADD CONSTRAINT "StudyEventRSVP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyPost" ADD CONSTRAINT "StudyPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyPostComment" ADD CONSTRAINT "StudyPostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyPostComment" ADD CONSTRAINT "StudyPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."StudyPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyPostReaction" ADD CONSTRAINT "StudyPostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."StudyPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyPostReaction" ADD CONSTRAINT "StudyPostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyRoom" ADD CONSTRAINT "StudyRoom_activeQuestionId_fkey" FOREIGN KEY ("activeQuestionId") REFERENCES "public"."Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyRoom" ADD CONSTRAINT "StudyRoom_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyRoomMessage" ADD CONSTRAINT "StudyRoomMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."StudyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyRoomMessage" ADD CONSTRAINT "StudyRoomMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyRoomParticipant" ADD CONSTRAINT "StudyRoomParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."StudyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyRoomParticipant" ADD CONSTRAINT "StudyRoomParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudyTogetherProfile" ADD CONSTRAINT "StudyTogetherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxRecord" ADD CONSTRAINT "TaxRecord_taxConfigId_fkey" FOREIGN KEY ("taxConfigId") REFERENCES "public"."TaxConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxRecord" ADD CONSTRAINT "TaxRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserMistake" ADD CONSTRAINT "UserMistake_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserMistake" ADD CONSTRAINT "UserMistake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserStreak" ADD CONSTRAINT "UserStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
