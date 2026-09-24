/*
  Warnings:

  - Made the column `mustChangePassword` on table `Partner` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
UPDATE "Partner" SET "mustChangePassword" = false WHERE "mustChangePassword" IS NULL;
ALTER TABLE "Partner" ALTER COLUMN "mustChangePassword" SET NOT NULL;

-- AlterTable
ALTER TABLE "PartnerPayoutProfile" ALTER COLUMN "method" SET DEFAULT 'GCASH',
ALTER COLUMN "status" SET DEFAULT 'VERIFIED';

-- AlterTable
ALTER TABLE "PartnerSequence" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "DuelMatch_status_player2Id_idx" ON "DuelMatch"("status", "player2Id");

-- CreateIndex
CREATE INDEX "DuelMatch_player2Id_idx" ON "DuelMatch"("player2Id");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Partner_partnerId_idx" ON "Partner"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerPayoutProfile_status_idx" ON "PartnerPayoutProfile"("status");

-- CreateIndex
CREATE INDEX "PartnerPayoutProfile_method_idx" ON "PartnerPayoutProfile"("method");

-- CreateIndex
CREATE INDEX "Question_bankType_deletedAt_category_subtopic_idx" ON "Question"("bankType", "deletedAt", "category", "subtopic");

-- CreateIndex
CREATE INDEX "Referral_holdingUntil_idx" ON "Referral"("holdingUntil");
