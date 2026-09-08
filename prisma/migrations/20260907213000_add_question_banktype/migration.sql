-- CreateEnum
CREATE TYPE "QuestionBankType" AS ENUM ('ORDINARY', 'ELIMINATION');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "bankType" "QuestionBankType";

-- CreateIndex
CREATE INDEX "Question_bankType_idx" ON "Question"("bankType");
