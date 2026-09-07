# Question BankType Backfill & Verification Guide

## Migration & Deployment Safety Notice

This document outlines the deployment, backfill, and verification sequence for the `bankType` discriminator column.

### Artifacts

- **Prisma Schema Migration (Additive):**
  `prisma/migrations/20260907213000_add_question_banktype/migration.sql`
  Adds `enum QuestionBankType`, nullable `Question.bankType`, and `Question_bankType_idx`. Non-destructive.
- **Standalone Backfill Script:**
  `prisma/migrations/backfill_question_banktype.sql`
  Contains idempotent backfill queries and read-only verification SQL.

---

## Deployment Sequence

1. **STAGE 1:** Deploy the additive schema migration (`20260907213000_add_question_banktype`).
2. **STAGE 2:** Deploy application code containing transitional ownership reads and explicit new writers (`bankType: "ORDINARY"` or `bankType: "ELIMINATION"`).
3. **STAGE 3:** Execute the manual idempotent backfill script (`backfill_question_banktype.sql`).
4. **STAGE 4:** Execute read-only verification queries to confirm:
   - `COUNT(*) WHERE "bankType" IS NULL = 0`
   - Zero lingering legacy-null elimination candidates.
5. **STAGE 5:** Perform functional smoke-testing across Practice, Mock Exam, Elimination Drill, Daily Question, and Trash.
6. **STAGE 6:** (Later cleanup deployment) Switch reads to strict `bankType`-only; remove transitional NULL fallbacks.
7. **STAGE 7:** (Final migration) Alter `bankType` to `NOT NULL` with no default.

---

## Standalone Manual Backfill SQL

```sql
-- Step 1: Set ELIMINATION for legacy elimination questions
UPDATE "Question"
SET "bankType" = 'ELIMINATION'::"QuestionBankType"
WHERE "bankType" IS NULL
  AND (
    LOWER(category) = 'elimination drill'
    OR LOWER(subtopic) LIKE '%elimination drill%'
  );

-- Step 2: Set ORDINARY for all remaining NULL rows
UPDATE "Question"
SET "bankType" = 'ORDINARY'::"QuestionBankType"
WHERE "bankType" IS NULL;

-- Verification
SELECT "bankType", COUNT(*) FROM "Question" GROUP BY "bankType";
SELECT COUNT(*) FROM "Question" WHERE "bankType" IS NULL;
```
