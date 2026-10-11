-- GovStudyX Phase 4B5: enforce receipt ownership after receipt table creation.
-- Forward-only; no User or NotificationReceipt rows are deleted or rewritten.
-- Fail closed if any legacy receipt refers to a nonexistent User.
DO $receipt_user_fk$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "NotificationReceipt" AS r
        LEFT JOIN "User" AS u ON u."id" = r."userId"
        WHERE u."id" IS NULL
    ) THEN
        RAISE EXCEPTION 'NotificationReceipt contains orphaned userId values; migration aborted without cleanup';
    END IF;
END
$receipt_user_fk$;

ALTER TABLE "NotificationReceipt"
    ADD CONSTRAINT "NotificationReceipt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
