-- GovStudyX Phase 4B5: independently verifiable admin-notification management scope.
-- Historical rows are UNVERIFIED and are never inferred to be admin-created.
-- Server-authenticated administrative creation is the sole path assigning ADMIN.
-- Forward-only; no existing notification or receipt is deleted.
ALTER TABLE "Notification"
    ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'UNVERIFIED';

CREATE INDEX "Notification_origin_createdAt_idx"
    ON "Notification"("origin", "createdAt" DESC);
