-- Per-user read/dismissal state for admin broadcasts (Notification.userId IS NULL).
-- No existing Notification records are modified or dropped by this migration.
CREATE TABLE "NotificationReceipt" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationReceipt_notificationId_userId_key"
    ON "NotificationReceipt"("notificationId", "userId");
CREATE INDEX "NotificationReceipt_userId_isRead_isDismissed_idx"
    ON "NotificationReceipt"("userId", "isRead", "isDismissed");
ALTER TABLE "NotificationReceipt"
    ADD CONSTRAINT "NotificationReceipt_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
