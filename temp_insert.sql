INSERT INTO "SystemSetting" ("id", "key", "value", "updatedAt") VALUES ('test-restore-id', 'RESTORE_TEST_KEY', 'BEFORE_RESTORE_VALUE', NOW()) ON CONFLICT DO NOTHING;
