-- AlterTable
ALTER TABLE "ExamResult" ADD COLUMN "attemptId" TEXT,
ADD COLUMN "submissionHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ExamResult_attemptId_key" ON "ExamResult"("attemptId");
