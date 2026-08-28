-- AlterTable
ALTER TABLE "User"
ADD COLUMN "anonymizedAt" TIMESTAMP(3),
ADD COLUMN "anonymizationVersion" INTEGER;
